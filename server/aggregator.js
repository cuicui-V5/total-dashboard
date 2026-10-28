import { fetchAllGlancesNodes } from './glances.js';
import { fetchUptimeKumaMetrics } from './kuma.js';
import { fetchAllBwhInstances } from './bwh.js';

let cachedData = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 5000; // 5-second server cache to ensure smooth responsiveness and prevent overloading nodes

/**
 * Parses environment configuration
 */
export function getFleetConfig() {
  const glancesAuth = {
    username: process.env.GLANCES_USERNAME || '',
    password: process.env.GLANCES_PASSWORD || ''
  };

  // GLANCES_NODES: id|label|url|tag,...
  const rawGlancesNodes = (process.env.GLANCES_NODES || '').split(',').map(item => item.trim()).filter(Boolean);
  const glancesNodes = rawGlancesNodes.map(item => {
    const [id, label, url, tag] = item.split('|');
    return { id, label: label || id, url, tag: tag || 'Server' };
  });

  const kumaConfig = {
    url: process.env.UPTIME_KUMA_URL || 'http://192.168.2.250:3001',
    apiKey: process.env.UPTIME_KUMA_API_KEY || ''
  };

  // BWH_INSTANCES: id|label|veid|api_key,...
  const rawBwh = (process.env.BWH_INSTANCES || '').split(',').map(item => item.trim()).filter(Boolean);
  const bwhInstances = rawBwh.map(item => {
    const [id, label, veid, apiKey] = item.split('|');
    return { id, label: label || id, veid, apiKey };
  });

  return {
    glancesAuth,
    glancesNodes,
    kumaConfig,
    bwhInstances
  };
}

/**
 * Fetch and aggregate entire fleet dashboard state
 */
export async function getAggregatedFleetData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedData && (now - lastFetchTimestamp < CACHE_TTL_MS)) {
    return cachedData;
  }

  const { glancesAuth, glancesNodes, kumaConfig, bwhInstances } = getFleetConfig();

  // Run all 3 major source queries concurrently
  const [glancesResults, kumaResult, bwhResults] = await Promise.all([
    fetchAllGlancesNodes(glancesNodes, glancesAuth),
    fetchUptimeKumaMetrics(kumaConfig.url, kumaConfig.apiKey),
    fetchAllBwhInstances(bwhInstances)
  ]);

  // Compute fleet summary statistics
  const totalGlances = glancesResults.length;
  const onlineGlances = glancesResults.filter(n => n.online).length;

  const onlineNodes = glancesResults.filter(n => n.online);
  const avgCpu = onlineNodes.length > 0
    ? Number((onlineNodes.reduce((acc, n) => acc + (n.cpu?.percent || 0), 0) / onlineNodes.length).toFixed(1))
    : 0;

  const avgMemory = onlineNodes.length > 0
    ? Number((onlineNodes.reduce((acc, n) => acc + (n.memory?.percent || 0), 0) / onlineNodes.length).toFixed(1))
    : 0;

  const totalNetworkRx = onlineNodes.reduce((acc, n) => acc + (n.network?.totalRxRate || 0), 0);
  const totalNetworkTx = onlineNodes.reduce((acc, n) => acc + (n.network?.totalTxRate || 0), 0);

  // Bandwidth Summary from BWH
  const totalBwhMonthly = bwhResults.reduce((acc, b) => acc + (b.bandwidth?.totalBytes || 0), 0);
  const totalBwhUsed = bwhResults.reduce((acc, b) => acc + (b.bandwidth?.usedBytes || 0), 0);
  const bwhUsagePercent = totalBwhMonthly > 0 ? Number(((totalBwhUsed / totalBwhMonthly) * 100).toFixed(1)) : 0;

  // Alerts
  const alerts = [];
  glancesResults.forEach(node => {
    if (!node.online) {
      alerts.push({ level: 'critical', source: node.label, message: `Node is offline (${node.error || 'timeout'})` });
    } else {
      if (node.cpu?.percent > 85) {
        alerts.push({ level: 'warning', source: node.label, message: `High CPU usage: ${node.cpu.percent}%` });
      }
      if (node.memory?.percent > 90) {
        alerts.push({ level: 'warning', source: node.label, message: `High Memory usage: ${node.memory.percent}%` });
      }
    }
  });

  kumaResult.monitors.forEach(mon => {
    if (mon.status === 'down') {
      alerts.push({ level: 'critical', source: `Uptime: ${mon.name}`, message: `Service is DOWN` });
    } else if (mon.certDaysRemaining !== null && mon.certDaysRemaining <= 14) {
      alerts.push({ level: 'warning', source: `SSL: ${mon.name}`, message: `Certificate expires in ${mon.certDaysRemaining} days` });
    }
  });

  bwhResults.forEach(vps => {
    if (vps.bandwidth?.percent > 80) {
      alerts.push({ level: 'warning', source: vps.label, message: `Bandwidth usage reached ${vps.bandwidth.percent}%` });
    }
  });

  const payload = {
    timestamp: new Date().toISOString(),
    summary: {
      fleetNodes: {
        total: totalGlances,
        online: onlineGlances,
        healthy: onlineGlances === totalGlances
      },
      kuma: {
        total: kumaResult.totalCount,
        up: kumaResult.upCount,
        healthPercent: kumaResult.healthPercent
      },
      fleetMetrics: {
        avgCpuPercent: avgCpu,
        avgMemoryPercent: avgMemory,
        totalRxSpeedBytes: totalNetworkRx,
        totalTxSpeedBytes: totalNetworkTx,
        bwhMonthlyBytes: totalBwhMonthly,
        bwhUsedBytes: totalBwhUsed,
        bwhUsagePercent
      },
      alerts
    },
    nodes: glancesResults,
    kuma: kumaResult,
    bwh: bwhResults
  };

  cachedData = payload;
  lastFetchTimestamp = now;

  return payload;
}
