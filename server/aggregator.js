import { fetchGlancesNode } from './glances.js';
import { fetchUptimeKumaMetrics } from './kuma.js';
import { fetchAllBwhInstances } from './bwh.js';
import { getHistoryDb, recordLatencySnapshot, seedFromOfficialKuma, cleanupRetention } from './kuma-db.js';

/**
 * Parses environment configuration
 */
export function getFleetConfig() {
  const glancesAuth = {
    username: process.env.GLANCES_USERNAME || '',
    password: process.env.GLANCES_PASSWORD || ''
  };

  const rawGlancesNodes = (process.env.GLANCES_NODES || '').split(',').map(item => item.trim()).filter(Boolean);
  const glancesNodes = rawGlancesNodes.map(item => {
    const [id, label, url, tag] = item.split('|');
    return { id, label: label || id, url, tag: tag || 'Server' };
  });

  const kumaConfig = {
    url: process.env.UPTIME_KUMA_URL || 'http://192.168.2.250:3001',
    apiKey: process.env.UPTIME_KUMA_API_KEY || ''
  };

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

// In-Memory Real-time State Store
const inMemoryStore = {
  nodesMap: new Map(), // node.id -> node state
  kumaData: { online: true, totalCount: 0, upCount: 0, downCount: 0, healthPercent: 100, monitors: [] },
  bwhData: [],
  nodePollingLocks: new Set(),
  kumaPollingLock: false,
  bwhPollingLock: false,
  isInitialized: false,
  lastSnapshot: null
};

/**
 * Build snapshot from in-memory state (Executed in 0ms)
 */
function buildFleetSnapshot() {
  const { glancesNodes } = getFleetConfig();
  
  // Reconstruct nodes in original configured order
  const nodes = glancesNodes.map(cfg => {
    return inMemoryStore.nodesMap.get(cfg.id) || {
      id: cfg.id,
      label: cfg.label,
      tag: cfg.tag,
      url: cfg.url,
      online: false,
      latencyMs: null,
      error: '正在建立连接...',
      system: { hostname: cfg.label, osName: 'Loading', uptime: '...' },
      cpu: { percent: 0, cores: 1, loadAvg: [0, 0, 0] },
      memory: { percent: 0, totalBytes: 0, usedBytes: 0 },
      swap: { percent: 0, totalBytes: 0, usedBytes: 0 },
      disks: [],
      network: { interfaces: [], totalRxRate: 0, totalTxRate: 0 },
      processes: { total: 0, running: 0, topList: [] },
      containers: [],
      sensors: [],
      lastUpdated: new Date().toISOString()
    };
  });

  const kuma = inMemoryStore.kumaData;
  const bwh = inMemoryStore.bwhData;

  // Summary Metrics
  const totalGlances = nodes.length;
  const onlineGlances = nodes.filter(n => n.online).length;
  const onlineNodes = nodes.filter(n => n.online);

  const avgCpu = onlineNodes.length > 0
    ? Number((onlineNodes.reduce((acc, n) => acc + (n.cpu?.percent || 0), 0) / onlineNodes.length).toFixed(1))
    : 0;

  const avgMemory = onlineNodes.length > 0
    ? Number((onlineNodes.reduce((acc, n) => acc + (n.memory?.percent || 0), 0) / onlineNodes.length).toFixed(1))
    : 0;

  const totalNetworkRx = onlineNodes.reduce((acc, n) => acc + (n.network?.totalRxRate || 0), 0);
  const totalNetworkTx = onlineNodes.reduce((acc, n) => acc + (n.network?.totalTxRate || 0), 0);

  const totalBwhMonthly = bwh.reduce((acc, b) => acc + (b.bandwidth?.totalBytes || 0), 0);
  const totalBwhUsed = bwh.reduce((acc, b) => acc + (b.bandwidth?.usedBytes || 0), 0);
  const bwhUsagePercent = totalBwhMonthly > 0 ? Number(((totalBwhUsed / totalBwhMonthly) * 100).toFixed(1)) : 0;

  const alerts = [];
  nodes.forEach(node => {
    if (!node.online) {
      alerts.push({ level: 'critical', source: node.label, message: `节点离线: ${node.error || '连接超时'}` });
    } else {
      if (node.cpu?.percent > 85) {
        alerts.push({ level: 'warning', source: node.label, message: `CPU 高负载: ${node.cpu.percent}%` });
      }
      if (node.memory?.percent > 90) {
        alerts.push({ level: 'warning', source: node.label, message: `内存占用过高: ${node.memory.percent}%` });
      }
    }
  });

  kuma.monitors.forEach(mon => {
    if (mon.status === 'down') {
      alerts.push({ level: 'critical', source: `Uptime: ${mon.name}`, message: `服务离线 (DOWN)` });
    } else if (mon.certDaysRemaining !== null && mon.certDaysRemaining <= 14) {
      alerts.push({ level: 'warning', source: `SSL 证书: ${mon.name}`, message: `证书将于 ${mon.certDaysRemaining} 天后到期` });
    }
  });

  const snapshot = {
    timestamp: new Date().toISOString(),
    isInstant: true,
    summary: {
      fleetNodes: {
        total: totalGlances,
        online: onlineGlances,
        healthy: onlineGlances === totalGlances && totalGlances > 0
      },
      kuma: {
        total: kuma.totalCount,
        up: kuma.upCount,
        healthPercent: kuma.healthPercent
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
    nodes,
    kuma,
    bwh
  };

  inMemoryStore.lastSnapshot = snapshot;
  return snapshot;
}

/**
 * Poll a single glances node independently in background
 */
async function pollSingleGlancesNode(node, auth) {
  if (inMemoryStore.nodePollingLocks.has(node.id)) return;
  inMemoryStore.nodePollingLocks.add(node.id);

  try {
    const prevData = inMemoryStore.nodesMap.get(node.id);
    const result = await fetchGlancesNode(node, auth, prevData);
    inMemoryStore.nodesMap.set(node.id, result);
  } catch (err) {
    console.error(`[Poller] Node ${node.label} poll error:`, err.message);
  } finally {
    inMemoryStore.nodePollingLocks.delete(node.id);
  }
}

/**
 * Poll Uptime Kuma in background
 */
let lastRecordedKumaTime = 0;

async function pollKuma(kumaConfig) {
  if (inMemoryStore.kumaPollingLock) return;
  inMemoryStore.kumaPollingLock = true;
  try {
    const res = await fetchUptimeKumaMetrics(kumaConfig.url, kumaConfig.apiKey);
    if (res && res.monitors?.length > 0) {
      inMemoryStore.kumaData = res;

      // Throttle recording to local SQLite timeseries every 10 seconds
      const now = Date.now();
      if (now - lastRecordedKumaTime >= 10000) {
        lastRecordedKumaTime = now;
        recordLatencySnapshot(res.monitors);
      }
    }
  } catch (err) {
    console.error('[Poller] Kuma poll error:', err.message);
  } finally {
    inMemoryStore.kumaPollingLock = false;
  }
}

/**
 * Poll BandwagonHost in background
 */
async function pollBwh(bwhInstances) {
  if (inMemoryStore.bwhPollingLock) return;
  inMemoryStore.bwhPollingLock = true;
  try {
    const res = await fetchAllBwhInstances(bwhInstances);
    if (res && res.length > 0) {
      inMemoryStore.bwhData = res;
    }
  } catch (err) {
    console.error('[Poller] BWH poll error:', err.message);
  } finally {
    inMemoryStore.bwhPollingLock = false;
  }
}

/**
 * Active Background Poller Engine
 * Starts independent interval workers for each node & service
 */
export function startBackgroundPoller() {
  if (inMemoryStore.isInitialized) return;
  inMemoryStore.isInitialized = true;

  const { glancesAuth, glancesNodes, kumaConfig, bwhInstances } = getFleetConfig();
  console.log(`📡 Background Poller Engine started. Managing ${glancesNodes.length} nodes, Uptime Kuma, and BWH...`);

  // Initialize SQLite history database and seed initial data from official Uptime Kuma
  try {
    getHistoryDb();
    seedFromOfficialKuma(kumaConfig.url, kumaConfig.apiKey);
  } catch (dbErr) {
    console.error('[Poller] Failed to init/seed local SQLite history:', dbErr.message);
  }

  // Schedule hourly 30-day retention cleanup
  setInterval(() => {
    cleanupRetention(30);
  }, 3600 * 1000);

  // Initial immediate poll for all data
  glancesNodes.forEach(node => pollSingleGlancesNode(node, glancesAuth));
  pollKuma(kumaConfig);
  pollBwh(bwhInstances);

  // Set up independent polling intervals:
  // LAN nodes: 5 seconds interval
  // Cloud/VPS nodes: 8 seconds interval
  glancesNodes.forEach(node => {
    const intervalMs = node.tag === 'LAN' ? 5000 : 8000;
    setInterval(() => {
      pollSingleGlancesNode(node, glancesAuth);
    }, intervalMs);
  });

  // Uptime Kuma: 5 seconds interval
  setInterval(() => {
    pollKuma(kumaConfig);
  }, 5000);

  // BandwagonHost: 30 seconds interval (prevents KiwiVM API rate limiting)
  setInterval(() => {
    pollBwh(bwhInstances);
  }, 30000);
}

/**
 * Instant API handler (< 1ms execution, never blocks client)
 */
export async function getAggregatedFleetData(forceRefresh = false) {
  // If force refresh requested, trigger background update in non-blocking fashion
  if (forceRefresh) {
    const { glancesAuth, glancesNodes, kumaConfig, bwhInstances } = getFleetConfig();
    glancesNodes.forEach(node => pollSingleGlancesNode(node, glancesAuth));
    pollKuma(kumaConfig);
    pollBwh(bwhInstances);
  }

  // Return the in-memory state snapshot immediately!
  return buildFleetSnapshot();
}
