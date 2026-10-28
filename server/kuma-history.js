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

// In-memory cache for API responses to keep dashboard snappy
const historyCache = new Map();

/**
 * Range configuration:
 * - 1h: 30s bucket (~120 points)
 * - 24h: 60s bucket (~1440 points)
 * - 7d: 30m bucket (~336 points)
 * - 30d: 60m bucket (~720 points)
 */
const RANGE_CONFIG = {
  '1h': {
    hours: 1,
    stepSec: 30,
    ttlMs: 20 * 1000,
    labelFormat: 'time',
    durationMs: 3600 * 1000
  },
  '24h': {
    hours: 24,
    stepSec: 60,
    ttlMs: 60 * 1000,
    labelFormat: 'time',
    durationMs: 24 * 3600 * 1000
  },
  '7d': {
    hours: 168,
    stepSec: 1800,
    ttlMs: 180 * 1000,
    labelFormat: 'datetime',
    durationMs: 7 * 24 * 3600 * 1000
  },
  '30d': {
    hours: 720,
    stepSec: 3600,
    ttlMs: 300 * 1000,
    labelFormat: 'datetime',
    durationMs: 30 * 24 * 3600 * 1000
  }
};

/**
 * Parse date string from Uptime Kuma (UTC) into epoch milliseconds
 */
function parseKumaTime(timeStr) {
  if (!timeStr) return 0;
  let clean = String(timeStr).trim();
  if (!clean.includes('T')) {
    clean = clean.replace(' ', 'T');
  }
  if (!clean.endsWith('Z')) {
    clean = clean + 'Z';
  }
  const t = new Date(clean).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Format timestamp in user's local timezone
 */
function formatTimeLabel(epochMs, formatType) {
  const d = new Date(epochMs);
  const pad = (n) => String(n).padStart(2, '0');
  
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());

  if (formatType === 'time') {
    return `${hours}:${minutes}`;
  } else if (formatType === 'datetime') {
    return `${month}-${day} ${hours}:${minutes}`;
  } else {
    return `${month}-${day}`;
  }
}

/**
 * Resample raw heartbeats onto a uniform time grid with forward-filling.
 * Guarantees continuous lines with no artificial drops to 0.
 */
function resampleHeartbeats(monitorsList, heartbeatMap, cfg) {
  const stepMs = cfg.stepSec * 1000;
  const nowMs = Date.now();

  let maxTime = 0;

  const parsedMonitors = monitorsList.map(m => {
    const rawList = heartbeatMap[String(m.id)] || [];
    const validHbs = [];

    for (const h of rawList) {
      const t = parseKumaTime(h.time);
      if (t > 0) {
        validHbs.push({
          time: t,
          ping: typeof h.ping === 'number' ? Number(h.ping.toFixed(1)) : 0,
          status: h.status ?? 1
        });
        if (t > maxTime) maxTime = t;
      }
    }

    validHbs.sort((a, b) => a.time - b.time);

    return {
      ...m,
      heartbeats: validHbs
    };
  });

  const gridEnd = maxTime > 0 ? Math.ceil(maxTime / stepMs) * stepMs : Math.floor(nowMs / stepMs) * stepMs;
  const gridStart = gridEnd - cfg.durationMs;
  const totalSteps = Math.max(1, Math.round((gridEnd - gridStart) / stepMs));

  const monitorStats = new Map();
  parsedMonitors.forEach(m => {
    monitorStats.set(m.name, {
      pings: [],
      upCount: 0,
      totalCount: 0,
      min: Infinity,
      max: 0
    });
  });

  // Pre-calculate initial known ping for each monitor
  const monitorState = new Map();
  parsedMonitors.forEach(m => {
    let initialPing = 0;
    let initialStatus = 1;

    const firstPingHb = m.heartbeats.find(h => h.ping > 0);
    if (firstPingHb) {
      initialPing = firstPingHb.ping;
      initialStatus = firstPingHb.status;
    }

    monitorState.set(m.name, {
      lastKnownPing: initialPing,
      lastKnownStatus: initialStatus,
      hbIndex: 0
    });
  });

  const timeline = [];

  for (let step = 0; step <= totalSteps; step++) {
    const pointTime = gridStart + step * stepMs;
    const windowStart = pointTime - stepMs / 2;
    const windowEnd = pointTime + stepMs / 2;

    const timeLabel = formatTimeLabel(pointTime, cfg.labelFormat);
    const point = {
      time: new Date(pointTime).toISOString(),
      timestamp: pointTime,
      label: timeLabel
    };

    for (const m of parsedMonitors) {
      const state = monitorState.get(m.name);
      const hbs = m.heartbeats;
      const matchedPings = [];

      while (state.hbIndex < hbs.length && hbs[state.hbIndex].time < windowStart) {
        if (hbs[state.hbIndex].ping > 0) {
          state.lastKnownPing = hbs[state.hbIndex].ping;
        }
        state.lastKnownStatus = hbs[state.hbIndex].status;
        state.hbIndex++;
      }

      let scanIdx = state.hbIndex;
      while (scanIdx < hbs.length && hbs[scanIdx].time < windowEnd) {
        const hb = hbs[scanIdx];
        if (hb.ping > 0) {
          matchedPings.push(hb.ping);
        }
        state.lastKnownPing = hb.ping > 0 ? hb.ping : state.lastKnownPing;
        state.lastKnownStatus = hb.status;
        scanIdx++;
      }
      state.hbIndex = scanIdx;

      let value = state.lastKnownPing;
      if (matchedPings.length > 0) {
        const sum = matchedPings.reduce((a, b) => a + b, 0);
        value = Number((sum / matchedPings.length).toFixed(1));
        state.lastKnownPing = value;
      }

      point[m.name] = value;
      point[`${m.name}_status`] = state.lastKnownStatus;

      const st = monitorStats.get(m.name);
      if (st) {
        st.totalCount++;
        if (state.lastKnownStatus === 1) st.upCount++;
        if (value > 0) {
          st.pings.push(value);
          if (value < st.min) st.min = value;
          if (value > st.max) st.max = value;
        }
      }
    }

    timeline.push(point);
  }

  const finalizedMonitors = parsedMonitors.map(m => {
    const st = monitorStats.get(m.name);
    const count = st?.pings?.length || 0;
    const avg = count > 0 ? Number((st.pings.reduce((a, b) => a + b, 0) / count).toFixed(1)) : 0;
    const min = count > 0 && st.min !== Infinity ? st.min : 0;
    const max = count > 0 ? st.max : 0;
    const uptime = st?.totalCount > 0 ? Number(((st.upCount / st.totalCount) * 100).toFixed(2)) : 100;

    const variance = count > 0 ? st.pings.reduce((acc, p) => acc + Math.pow(p - avg, 2), 0) / count : 0;
    const jitter = Number(Math.sqrt(variance).toFixed(1));

    return {
      id: m.id,
      name: m.name,
      type: m.type,
      url: m.url,
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
    monitors: finalizedMonitors,
    timeline
  };
}

/**
 * Fetch historical data purely over Uptime Kuma HTTP API
 */
export async function queryKumaHistory(range = '24h') {
  const cfg = RANGE_CONFIG[range] || RANGE_CONFIG['24h'];

  // Check in-memory cache
  const cached = historyCache.get(range);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const kumaUrl = process.env.UPTIME_KUMA_URL || 'http://192.168.2.250:3001';

  try {
    // 1. Fetch monitor list and historical heartbeats over pure HTTP API
    const [metaRes, hbRes] = await Promise.all([
      axios.get(`${kumaUrl}/api/status-page/default`, { timeout: 5000 }),
      axios.get(`${kumaUrl}/api/status-page/heartbeat/default?hours=${cfg.hours}`, { timeout: 10000 })
    ]);

    const monitorsList = [];
    if (metaRes.data?.publicGroupList) {
      let colorIdx = 0;
      for (const group of metaRes.data.publicGroupList) {
        for (const mon of group.monitorList || []) {
          monitorsList.push({
            id: mon.id,
            name: mon.name,
            type: mon.type,
            url: mon.url || '',
            color: MONITOR_COLORS[mon.name] || DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length]
          });
        }
      }
    }

    const heartbeatMap = hbRes.data?.heartbeatList || {};

    // 2. Uniform grid resampling & forward-fill
    const { monitors, timeline } = resampleHeartbeats(monitorsList, heartbeatMap, cfg);

    const result = {
      range,
      stepSec: cfg.stepSec,
      source: 'http-api',
      monitors,
      timeline,
      timestamp: new Date().toISOString()
    };

    // Store in cache
    historyCache.set(range, {
      data: result,
      expiresAt: Date.now() + cfg.ttlMs
    });

    return result;
  } catch (error) {
    console.error(`[Kuma History API] Error fetching range=${range}:`, error.message);
    // If cache has an older copy, return it
    if (cached) return cached.data;
    return null;
  }
}
