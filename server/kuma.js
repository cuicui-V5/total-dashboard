import axios from 'axios';

// Distinct colors for each monitor's chart line
const MONITOR_COLORS = {
  '搬瓦工1': '#3b82f6',     // Blue
  '搬瓦工2': '#6366f1',     // Indigo
  '甲骨文1': '#8b5cf6',     // Violet
  '甲骨文2': '#ec4899',     // Pink
  'ERX': '#10b981',        // Emerald
  '百度': '#f59e0b',        // Amber
  '山东联通dns': '#06b6d4',  // Cyan
};

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

/**
 * Fetch and parse Uptime Kuma Prometheus metrics and historical heartbeats
 */
export async function fetchUptimeKumaMetrics(kumaUrl, apiKey) {
  const startTime = Date.now();
  const basicAuthHeader = 'Basic ' + Buffer.from(`:${apiKey}`).toString('base64');

  try {
    // 1. Fetch Prometheus metrics and status-page heartbeats in parallel
    const [promRes, metaRes, heartbeatRes] = await Promise.allSettled([
      axios.get(`${kumaUrl}/metrics`, {
        headers: { 'Authorization': basicAuthHeader },
        timeout: 4000
      }),
      axios.get(`${kumaUrl}/api/status-page/default`, { timeout: 4000 }),
      axios.get(`${kumaUrl}/api/status-page/heartbeat/default`, { timeout: 4000 })
    ]);

    const latencyMs = Date.now() - startTime;

    // Parse status-page metadata (IDs to Names)
    const idToNameMap = new Map();
    const nameToIdMap = new Map();
    if (metaRes.status === 'fulfilled' && metaRes.value?.data?.publicGroupList) {
      for (const group of metaRes.value.data.publicGroupList) {
        for (const mon of group.monitorList || []) {
          idToNameMap.set(String(mon.id), mon.name);
          nameToIdMap.set(mon.name, String(mon.id));
        }
      }
    }

    // Heartbeats and 24h uptimes from status-page API
    const rawHeartbeats = (heartbeatRes.status === 'fulfilled' && heartbeatRes.value?.data?.heartbeatList) || {};
    const rawUptimeList = (heartbeatRes.status === 'fulfilled' && heartbeatRes.value?.data?.uptimeList) || {};

    // 2. Parse Prometheus metrics
    const text = (promRes.status === 'fulfilled' && promRes.value?.data) || '';
    const lines = text.split('\n');

    const monitorsMap = new Map();

    const parseLabels = (labelStr) => {
      const labels = {};
      const regex = /(\w+)="([^"]*)"/g;
      let match;
      while ((match = regex.exec(labelStr)) !== null) {
        labels[match[1]] = match[2];
      }
      return labels;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const match = line.match(/^([a-zA-Z_]+)\{([^}]+)\}\s+([0-9.eE+-]+)$/);
      if (!match) continue;

      const [, metricName, labelStr, valueStr] = match;
      if (!metricName.startsWith('monitor_')) continue;

      const labels = parseLabels(labelStr);
      const name = labels.monitor_name;
      if (!name) continue;

      const value = parseFloat(valueStr);

      if (!monitorsMap.has(name)) {
        monitorsMap.set(name, {
          id: nameToIdMap.get(name) || name,
          name,
          type: labels.monitor_type || 'ping',
          url: labels.monitor_url || '',
          hostname: labels.monitor_hostname || '',
          port: labels.monitor_port || '',
          status: 'unknown',
          statusCode: 0,
          pingMs: null,
          certDaysRemaining: null,
          certIsValid: null,
          uptime24h: 100,
          color: MONITOR_COLORS[name] || DEFAULT_COLORS[monitorsMap.size % DEFAULT_COLORS.length],
          stats: {
            minPing: null,
            maxPing: null,
            avgPing: null,
            jitter: null
          },
          heartbeats: []
        });
      }

      const item = monitorsMap.get(name);

      if (metricName === 'monitor_status') {
        item.statusCode = value;
        item.status = value === 1 ? 'up' : (value === 0 ? 'down' : (value === 2 ? 'pending' : 'maintenance'));
      } else if (metricName === 'monitor_response_time') {
        item.pingMs = Number(value.toFixed(1));
      } else if (metricName === 'monitor_cert_days_remaining') {
        item.certDaysRemaining = Math.round(value);
      } else if (metricName === 'monitor_cert_is_valid') {
        item.certIsValid = value === 1;
      }
    }

    // 3. Attach historical heartbeats and compute deep statistics for each monitor
    for (const [name, item] of monitorsMap.entries()) {
      const monId = nameToIdMap.get(name);
      const hbList = (monId && rawHeartbeats[monId]) || [];

      // Extract 24-hour uptime percentage
      const rawUptimeRatio = monId && rawUptimeList[`${monId}_24`];
      if (rawUptimeRatio !== undefined && rawUptimeRatio !== null) {
        item.uptime24h = Number((rawUptimeRatio * 100).toFixed(2));
      }

      if (hbList.length > 0) {
        item.heartbeats = hbList.map(h => ({
          status: h.status,
          time: h.time,
          ping: typeof h.ping === 'number' ? Number(h.ping.toFixed(1)) : item.pingMs || 0,
          msg: h.msg || ''
        }));

        // Calculate statistics
        const validPings = item.heartbeats.map(h => h.ping).filter(p => typeof p === 'number' && p > 0);
        if (validPings.length > 0) {
          const min = Math.min(...validPings);
          const max = Math.max(...validPings);
          const avg = validPings.reduce((a, b) => a + b, 0) / validPings.length;
          
          // Jitter (Standard Deviation)
          const variance = validPings.reduce((acc, p) => acc + Math.pow(p - avg, 2), 0) / validPings.length;
          const stdDev = Math.sqrt(variance);

          item.stats = {
            minPing: Number(min.toFixed(1)),
            maxPing: Number(max.toFixed(1)),
            avgPing: Number(avg.toFixed(1)),
            jitter: Number(stdDev.toFixed(1))
          };
        }
      }
    }

    // 4. Construct unified time-series dataset for multi-line latency chart
    // We sample up to 50 time points from the monitors
    const monitors = Array.from(monitorsMap.values());
    const upCount = monitors.filter(m => m.status === 'up').length;

    // Build timeline from the monitor with the most heartbeats (or all heartbeats)
    let longestHbMonitor = monitors[0];
    for (const m of monitors) {
      if ((m.heartbeats?.length || 0) > (longestHbMonitor?.heartbeats?.length || 0)) {
        longestHbMonitor = m;
      }
    }

    const timeline = [];
    const maxPoints = longestHbMonitor?.heartbeats?.length || 0;

    for (let i = 0; i < maxPoints; i++) {
      const baseHb = longestHbMonitor.heartbeats[i];
      if (!baseHb) continue;

      const rawTime = baseHb.time || '';
      // Format time label (e.g. "13:28")
      const timeParts = rawTime.split(' ');
      const timeLabel = timeParts[1] ? timeParts[1].substring(0, 5) : `T-${maxPoints - i}`;

      const point = {
        time: rawTime,
        label: timeLabel,
      };

      // Populate ping for each monitor at this index
      for (const m of monitors) {
        const hb = m.heartbeats?.[i];
        if (hb && typeof hb.ping === 'number') {
          point[m.name] = hb.ping;
        } else if (typeof m.pingMs === 'number') {
          point[m.name] = m.pingMs;
        }
      }

      timeline.push(point);
    }

    return {
      online: true,
      latencyMs,
      totalCount: monitors.length,
      upCount,
      downCount: monitors.length - upCount,
      healthPercent: monitors.length > 0 ? Number(((upCount / monitors.length) * 100).toFixed(1)) : 100,
      monitors,
      timeline,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    return {
      online: false,
      latencyMs: Date.now() - startTime,
      error: error.message,
      totalCount: 0,
      upCount: 0,
      downCount: 0,
      healthPercent: 0,
      monitors: [],
      timeline: [],
      lastUpdated: new Date().toISOString()
    };
  }
}
