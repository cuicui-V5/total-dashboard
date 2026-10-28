import fs from 'fs';
import path from 'path';

let DatabaseSync = null;
try {
  // Use Node.js 22 built-in SQLite module
  const sqliteModule = await import('node:sqlite');
  DatabaseSync = sqliteModule.DatabaseSync;
} catch (e) {
  // node:sqlite not available in this node runtime
}

// Colors for monitors
const MONITOR_COLORS = {
  '搬瓦工1': '#3b82f6',
  '搬瓦工2': '#6366f1',
  '甲骨文1': '#8b5cf6',
  '甲骨文2': '#ec4899',
  'ERX': '#10b981',
  '百度': '#f59e0b',
  '山东联通dns': '#06b6d4',
};

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

/**
 * Find database path
 */
function getDbPath() {
  const envPath = process.env.UPTIME_KUMA_DB_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidatePaths = [
    '/data/kuma.db',
    '/etc/uptime-kuma/kuma.db',
    path.join(process.cwd(), 'kuma.db'),
    path.join(process.cwd(), '../kuma.db')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Query historical aggregated data from SQLite directly
 */
export function queryKumaHistory(range = '24h') {
  const dbPath = getDbPath();
  if (!dbPath || !DatabaseSync) {
    return null;
  }

  let db = null;
  try {
    db = new DatabaseSync(dbPath, { open: true, readOnly: true });

    // 1. Get all active monitors
    const monitorsStmt = db.prepare('SELECT id, name, type, url FROM monitor WHERE active = 1 ORDER BY id ASC');
    const rawMonitors = monitorsStmt.all();
    const idToNameMap = new Map();
    const monitorsList = rawMonitors.map((m, idx) => {
      idToNameMap.set(Number(m.id), m.name);
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        url: m.url,
        color: MONITOR_COLORS[m.name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
      };
    });

    let sql = '';
    if (range === '1h') {
      // Last 1 hour: 50~60 granular samples
      sql = `
        SELECT 
          monitor_id,
          strftime('%H:%M', time) as time_label,
          time as bucket_time,
          ROUND(ping, 1) as avg_ping,
          ROUND(ping, 1) as min_ping,
          ROUND(ping, 1) as max_ping,
          status as is_up
        FROM heartbeat
        WHERE time > datetime('now', '-1 hour')
        ORDER BY time ASC
      `;
    } else if (range === '24h') {
      // Last 24 hours: 24 hourly buckets
      sql = `
        SELECT 
          monitor_id,
          strftime('%H:00', time) as time_label,
          strftime('%Y-%m-%d %H:00', time) as bucket_time,
          ROUND(AVG(ping), 1) as avg_ping,
          ROUND(MIN(ping), 1) as min_ping,
          ROUND(MAX(ping), 1) as max_ping,
          ROUND(SUM(CASE WHEN status = 1 THEN 1.0 ELSE 0.0 END) / COUNT(*) * 100, 2) as uptime_pct,
          COUNT(*) as samples
        FROM heartbeat
        WHERE time > datetime('now', '-24 hours')
        GROUP BY monitor_id, bucket_time
        ORDER BY bucket_time ASC
      `;
    } else if (range === '7d') {
      // Last 7 days: 4-hour buckets (42 points)
      sql = `
        SELECT 
          monitor_id,
          strftime('%m-%d %H:00', datetime((strftime('%s', time) / 14400) * 14400, 'unixepoch')) as time_label,
          datetime((strftime('%s', time) / 14400) * 14400, 'unixepoch') as bucket_time,
          ROUND(AVG(ping), 1) as avg_ping,
          ROUND(MIN(ping), 1) as min_ping,
          ROUND(MAX(ping), 1) as max_ping,
          ROUND(SUM(CASE WHEN status = 1 THEN 1.0 ELSE 0.0 END) / COUNT(*) * 100, 2) as uptime_pct,
          COUNT(*) as samples
        FROM heartbeat
        WHERE time > datetime('now', '-7 days')
        GROUP BY monitor_id, bucket_time
        ORDER BY bucket_time ASC
      `;
    } else if (range === '30d') {
      // Last 30 days: 30 daily buckets
      sql = `
        SELECT 
          monitor_id,
          strftime('%m-%d', time) as time_label,
          strftime('%Y-%m-%d', time) as bucket_time,
          ROUND(AVG(ping), 1) as avg_ping,
          ROUND(MIN(ping), 1) as min_ping,
          ROUND(MAX(ping), 1) as max_ping,
          ROUND(SUM(CASE WHEN status = 1 THEN 1.0 ELSE 0.0 END) / COUNT(*) * 100, 2) as uptime_pct,
          COUNT(*) as samples
        FROM heartbeat
        WHERE time > datetime('now', '-30 days')
        GROUP BY monitor_id, bucket_time
        ORDER BY bucket_time ASC
      `;
    }

    const rowsStmt = db.prepare(sql);
    const rows = rowsStmt.all();

    // Pivot rows into unified timeline
    // bucket_time -> { time, label, [monitorName]: avg_ping }
    const bucketMap = new Map();
    const monitorStatsMap = new Map();

    monitorsList.forEach(m => {
      monitorStatsMap.set(m.name, {
        pings: [],
        uptimePcts: [],
        min: 9999,
        max: 0
      });
    });

    for (const row of rows) {
      const monName = idToNameMap.get(Number(row.monitor_id));
      if (!monName) continue;

      const bucketKey = row.bucket_time;
      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, {
          time: row.bucket_time,
          label: row.time_label
        });
      }

      const point = bucketMap.get(bucketKey);
      point[monName] = row.avg_ping;

      // Accumulate stats
      const st = monitorStatsMap.get(monName);
      if (st && row.avg_ping > 0) {
        st.pings.push(row.avg_ping);
        if (row.uptime_pct !== undefined) st.uptimePcts.push(row.uptime_pct);
        if (row.min_ping < st.min) st.min = row.min_ping;
        if (row.max_ping > st.max) st.max = row.max_ping;
      }
    }

    const timeline = Array.from(bucketMap.values());

    // Compute summarized monitor stats for the selected range
    const monitorsWithStats = monitorsList.map(m => {
      const st = monitorStatsMap.get(m.name) || { pings: [], uptimePcts: [], min: 0, max: 0 };
      const count = st.pings.length;
      const avg = count > 0 ? Number((st.pings.reduce((a, b) => a + b, 0) / count).toFixed(1)) : 0;
      const min = count > 0 ? st.min : 0;
      const max = count > 0 ? st.max : 0;
      const uptimeAvg = st.uptimePcts.length > 0 
        ? Number((st.uptimePcts.reduce((a, b) => a + b, 0) / st.uptimePcts.length).toFixed(2)) 
        : 100;

      // Jitter
      const variance = count > 0 ? st.pings.reduce((acc, p) => acc + Math.pow(p - avg, 2), 0) / count : 0;
      const jitter = Number(Math.sqrt(variance).toFixed(1));

      return {
        ...m,
        uptime: uptimeAvg,
        stats: {
          avgPing: avg,
          minPing: min,
          maxPing: max,
          jitter
        }
      };
    });

    return {
      range,
      source: 'sqlite',
      monitors: monitorsWithStats,
      timeline,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('[Kuma History] SQLite query error:', err);
    return null;
  } finally {
    if (db) {
      try { db.close(); } catch {}
    }
  }
}
