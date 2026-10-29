import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import axios from 'axios';

// Distinct colors for each monitor
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

let dbInstance = null;

/**
 * Get or initialize SQLite Database
 */
export function getHistoryDb() {
  if (dbInstance) return dbInstance;

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'history.db');
  dbInstance = new DatabaseSync(dbPath);

  // High performance SQLite pragmas
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA synchronous = NORMAL;');
  dbInstance.exec('PRAGMA temp_store = MEMORY;');

  // Create table for local high-resolution time-series
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS kuma_latency_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id TEXT NOT NULL,
      monitor_name TEXT NOT NULL,
      ping REAL NOT NULL,
      status INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kuma_hist_time ON kuma_latency_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_kuma_hist_mon_time ON kuma_latency_history(monitor_name, timestamp);
  `);

  console.log(`[SQLite History] Initialized local time-series database at ${dbPath}`);
  return dbInstance;
}

/**
 * Record a high-resolution latency snapshot for all active monitors
 */
export function recordLatencySnapshot(monitors) {
  if (!monitors || monitors.length === 0) return;

  const db = getHistoryDb();
  const nowMs = Date.now();
  const isoTime = new Date(nowMs).toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO kuma_latency_history (monitor_id, monitor_name, ping, status, timestamp, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const m of monitors) {
    const ping = typeof m.pingMs === 'number' && m.pingMs >= 0 ? m.pingMs : 0;
    const isUp = m.status === 'up' ? 1 : 0;
    insertStmt.run(String(m.id || m.name), m.name, ping, isUp, nowMs, isoTime);
  }
}

/**
 * Seed historical data from official Uptime Kuma status page on initial run
 */
export async function seedFromOfficialKuma(kumaUrl, apiKey) {
  try {
    const db = getHistoryDb();
    const countRow = db.prepare('SELECT count(*) as count FROM kuma_latency_history').get();
    
    // Only seed if database is relatively new / has very few records
    if (countRow && countRow.count > 50) {
      return;
    }

    console.log('[SQLite History] Seeding initial historical data from official Uptime Kuma...');
    const [metaRes, hbRes] = await Promise.all([
      axios.get(`${kumaUrl}/api/status-page/default`, { timeout: 4000 }),
      axios.get(`${kumaUrl}/api/status-page/heartbeat/default`, { timeout: 4000 })
    ]);

    const idToNameMap = new Map();
    if (metaRes.data?.publicGroupList) {
      for (const group of metaRes.data.publicGroupList) {
        for (const mon of group.monitorList || []) {
          idToNameMap.set(String(mon.id), mon.name);
        }
      }
    }

    const heartbeatList = hbRes.data?.heartbeatList || {};
    const insertStmt = db.prepare(`
      INSERT INTO kuma_latency_history (monitor_id, monitor_name, ping, status, timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let seededCount = 0;
    for (const [monId, hbs] of Object.entries(heartbeatList)) {
      const monName = idToNameMap.get(monId) || `Monitor-${monId}`;
      for (const h of hbs) {
        if (!h.time) continue;
        let clean = String(h.time).trim();
        if (!clean.includes('T')) clean = clean.replace(' ', 'T');
        if (!clean.endsWith('Z')) clean = clean + 'Z';
        const epochMs = new Date(clean).getTime();
        if (isNaN(epochMs) || epochMs <= 0) continue;

        const ping = typeof h.ping === 'number' ? Number(h.ping.toFixed(1)) : 0;
        const status = h.status ?? 1;
        insertStmt.run(monId, monName, ping, status, epochMs, new Date(epochMs).toISOString());
        seededCount++;
      }
    }

    console.log(`[SQLite History] Seeded ${seededCount} historical data points from official Uptime Kuma`);
  } catch (err) {
    console.warn('[SQLite History] Initial seeding error (skipped):', err.message);
  }
}

/**
 * 30-Day Data Retention Cleanup: Delete records older than 30 days
 */
export function cleanupRetention(maxDays = 30) {
  try {
    const db = getHistoryDb();
    const cutoffMs = Date.now() - (maxDays * 24 * 3600 * 1000);
    const result = db.prepare('DELETE FROM kuma_latency_history WHERE timestamp < ?').run(cutoffMs);
    if (result.changes > 0) {
      console.log(`[SQLite History] Purged ${result.changes} records older than ${maxDays} days`);
    }
  } catch (err) {
    console.error('[SQLite History] Retention cleanup error:', err);
  }
}

/**
 * Balanced ~1,000-Point Range Configuration:
 * - 1h: 原始无损数据展示 (Raw timestamps captured by poller)
 * - 24h: 1分钟步长 (1,441 点)
 * - 7d: 10分钟步长 (1,009 点)
 * - 30d: 30分钟步长 (1,441 点)
 */
const RANGE_CONFIG = {
  '1h': {
    isRaw: true,
    durationMs: 3600 * 1000,
    stepSec: 0, // raw
    labelFormat: 'time-sec'
  },
  '24h': {
    isRaw: false,
    durationMs: 24 * 3600 * 1000,
    stepMs: 60 * 1000,
    stepSec: 60,
    labelFormat: 'time'
  },
  '7d': {
    isRaw: false,
    durationMs: 7 * 24 * 3600 * 1000,
    stepMs: 600 * 1000, // 10 minutes -> 1,008 points
    stepSec: 600,
    labelFormat: 'datetime'
  },
  '30d': {
    isRaw: false,
    durationMs: 30 * 24 * 3600 * 1000,
    stepMs: 1800 * 1000, // 30 minutes -> 1,440 points
    stepSec: 1800,
    labelFormat: 'datetime'
  }
};

function formatTimeLabel(epochMs, formatType) {
  const d = new Date(epochMs);
  const pad = (n) => String(n).padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());

  if (formatType === 'time-sec') {
    return `${hours}:${minutes}:${seconds}`;
  } else if (formatType === 'time') {
    return `${hours}:${minutes}`;
  } else {
    return `${month}-${day} ${hours}:${minutes}`;
  }
}

/**
 * Query high-resolution latency timeline from local SQLite database with Forward-Fill
 */
export function queryLatencyHistory(range = '24h') {
  const cfg = RANGE_CONFIG[range] || RANGE_CONFIG['24h'];
  const db = getHistoryDb();

  const nowMs = Date.now();
  const startTime = nowMs - cfg.durationMs;

  // 1. Get all known monitors in the database
  const distinctMonitors = db.prepare(`
    SELECT DISTINCT monitor_id, monitor_name
    FROM kuma_latency_history
    ORDER BY monitor_id ASC
  `).all();

  if (distinctMonitors.length === 0) {
    return {
      range,
      stepSec: cfg.stepSec,
      source: 'local-sqlite',
      monitors: [],
      timeline: [],
      timestamp: new Date().toISOString()
    };
  }

  const monitorsList = distinctMonitors.map((m, idx) => ({
    id: m.monitor_id,
    name: m.monitor_name,
    color: MONITOR_COLORS[m.monitor_name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
  }));

  // Pre-calculate initial known state for each monitor
  // Look for the closest known ping at or before startTime, or fallback to earliest recorded ping
  const lastKnownMap = new Map();
  for (const m of monitorsList) {
    let initialPing = 0;
    let initialStatus = 1;

    let nearest = db.prepare(`
      SELECT ping, status 
      FROM kuma_latency_history 
      WHERE monitor_name = ? AND ping > 0 AND timestamp <= ?
      ORDER BY timestamp DESC 
      LIMIT 1
    `).get(m.name, startTime);

    if (!nearest) {
      nearest = db.prepare(`
        SELECT ping, status 
        FROM kuma_latency_history 
        WHERE monitor_name = ? AND ping > 0
        ORDER BY timestamp ASC 
        LIMIT 1
      `).get(m.name);
    }

    if (nearest) {
      initialPing = nearest.ping;
      initialStatus = nearest.status;
    }

    lastKnownMap.set(m.name, { ping: initialPing, status: initialStatus });
  }

  const monitorStats = new Map();
  monitorsList.forEach(m => {
    monitorStats.set(m.name, {
      pings: [],
      upCount: 0,
      totalCount: 0,
      min: Infinity,
      max: 0
    });
  });

  const timeline = [];

  if (cfg.isRaw) {
    // ==========================================
    // 1H MODE: RAW DATA (原始数据展示)
    // ==========================================
    const rawRows = db.prepare(`
      SELECT 
        timestamp,
        monitor_name,
        ping,
        status
      FROM kuma_latency_history
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `).all(startTime, nowMs);

    // Group rows by raw captured timestamp
    const timestampMap = new Map();
    for (const row of rawRows) {
      if (!timestampMap.has(row.timestamp)) {
        timestampMap.set(row.timestamp, new Map());
      }
      timestampMap.get(row.timestamp).set(row.monitor_name, {
        ping: row.ping,
        status: row.status
      });
    }

    const sortedTimes = Array.from(timestampMap.keys()).sort((a, b) => a - b);

    for (const ptTime of sortedTimes) {
      const monMap = timestampMap.get(ptTime);
      const timeLabel = formatTimeLabel(ptTime, cfg.labelFormat);

      const point = {
        time: new Date(ptTime).toISOString(),
        timestamp: ptTime,
        label: timeLabel
      };

      for (const m of monitorsList) {
        const item = monMap ? monMap.get(m.name) : null;
        const lastState = lastKnownMap.get(m.name);

        let currentPing = lastState.ping;
        let currentStatus = lastState.status;

        if (item) {
          if (item.ping > 0) {
            currentPing = item.ping;
            lastState.ping = currentPing;
          }
          currentStatus = item.status;
          lastState.status = currentStatus;

          const st = monitorStats.get(m.name);
          if (st) {
            st.totalCount++;
            if (currentStatus === 1) st.upCount++;
            if (currentPing > 0) {
              st.pings.push(currentPing);
              if (currentPing < st.min) st.min = currentPing;
              if (currentPing > st.max) st.max = currentPing;
            }
          }
        }

        point[m.name] = currentPing;
        point[`${m.name}_status`] = currentStatus;
      }

      timeline.push(point);
    }
  } else {
    // ==========================================
    // 24H / 7D / 30D MODE: UNIFORM ~1,000-POINT BUCKETED AGGREGATION
    // ==========================================
    const gridEnd = Math.floor(nowMs / cfg.stepMs) * cfg.stepMs;
    const gridStart = gridEnd - cfg.durationMs;
    const totalSteps = Math.max(1, Math.round((gridEnd - gridStart) / cfg.stepMs));

    // NOTE: Explicit CAST(? AS INTEGER) ensures integer division in SQLite when bound via JS drivers
    const rows = db.prepare(`
      SELECT 
        monitor_name,
        (timestamp / CAST(? AS INTEGER)) * CAST(? AS INTEGER) AS bucket,
        ROUND(AVG(ping), 1) AS avg_ping,
        MIN(status) AS status,
        COUNT(*) AS samples
      FROM kuma_latency_history
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY monitor_name, bucket
      ORDER BY bucket ASC
    `).all(cfg.stepMs, cfg.stepMs, gridStart, gridEnd);

    const dataMap = new Map();
    for (const row of rows) {
      if (!dataMap.has(row.monitor_name)) {
        dataMap.set(row.monitor_name, new Map());
      }
      dataMap.get(row.monitor_name).set(row.bucket, {
        ping: row.avg_ping,
        status: row.status,
        samples: row.samples
      });
    }

    for (let step = 0; step <= totalSteps; step++) {
      const pointTime = gridStart + step * cfg.stepMs;
      const timeLabel = formatTimeLabel(pointTime, cfg.labelFormat);

      const point = {
        time: new Date(pointTime).toISOString(),
        timestamp: pointTime,
        label: timeLabel
      };

      for (const m of monitorsList) {
        const monData = dataMap.get(m.name);
        const bucketData = monData ? monData.get(pointTime) : null;
        const lastState = lastKnownMap.get(m.name);

        let currentPing = lastState.ping;
        let currentStatus = lastState.status;

        if (bucketData) {
          if (bucketData.ping > 0) {
            currentPing = bucketData.ping;
            lastState.ping = currentPing;
          }
          currentStatus = bucketData.status;
          lastState.status = currentStatus;

          const st = monitorStats.get(m.name);
          if (st) {
            st.totalCount += (bucketData.samples || 1);
            if (currentStatus === 1) st.upCount += (bucketData.samples || 1);
            if (currentPing > 0) {
              st.pings.push(currentPing);
              if (currentPing < st.min) st.min = currentPing;
              if (currentPing > st.max) st.max = currentPing;
            }
          }
        }

        point[m.name] = currentPing;
        point[`${m.name}_status`] = currentStatus;
      }

      timeline.push(point);
    }
  }

  // 4. Summarize stats for monitors
  const finalizedMonitors = monitorsList.map(m => {
    const st = monitorStats.get(m.name);
    const count = st?.pings?.length || 0;
    const avg = count > 0 ? Number((st.pings.reduce((a, b) => a + b, 0) / count).toFixed(1)) : (lastKnownMap.get(m.name)?.ping || 0);
    const min = count > 0 && st.min !== Infinity ? st.min : avg;
    const max = count > 0 ? st.max : avg;
    const uptime = st?.totalCount > 0 ? Number(((st.upCount / st.totalCount) * 100).toFixed(2)) : 100;

    const variance = count > 0 ? st.pings.reduce((acc, p) => acc + Math.pow(p - avg, 2), 0) / count : 0;
    const jitter = Number(Math.sqrt(variance).toFixed(1));

    return {
      id: m.id,
      name: m.name,
      color: m.color,
      uptime,
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
    stepSec: cfg.stepSec,
    isRaw: cfg.isRaw,
    source: 'local-sqlite',
    monitors: finalizedMonitors,
    timeline,
    timestamp: new Date().toISOString()
  };
}
