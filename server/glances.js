import axios from 'axios';
import http from 'http';

// Reusable HTTP Keep-Alive Agent to eliminate TCP handshake overhead on high-latency routes
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 25
});

/**
 * Fetch and normalize data from a single Glances node using pure lightweight quicklook API (~580 bytes)
 */
export async function fetchGlancesNode(node, auth, previousNodeData = null) {
  const startTime = Date.now();
  const basicAuthHeader = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  const prev = previousNodeData || {};

  // Cloud VPS nodes traverse transpacific routes with higher latency
  const isCloudNode = node.id?.includes('oracle') || node.id?.includes('bwh') || node.tag?.includes('VPS');
  const timeoutMs = isCloudNode ? 12000 : 5000;

  try {
    const response = await axios.get(`${node.url}/api/4/quicklook`, {
      headers: {
        'Authorization': basicAuthHeader,
        'Accept': 'application/json'
      },
      httpAgent,
      timeout: timeoutMs
    });

    const latencyMs = Date.now() - startTime;
    const qk = response.data || {};

    const cpuPercent = Number((qk.cpu ?? 0).toFixed(1));
    const cpuName = qk.cpu_name || prev.cpu?.name || 'CPU';
    const cpuCores = qk.cpu_phys_core || prev.cpu?.cores || 1;
    const cpuLogicalCores = qk.cpu_log_core || prev.cpu?.logicalCores || 1;
    const cpuHz = qk.cpu_hz_current ? Math.round(qk.cpu_hz_current / 1000000) : (prev.cpu?.frequencyMhz || null);
    const loadAvg = typeof qk.load === 'number' ? [Number(qk.load.toFixed(2)), 0, 0] : (prev.cpu?.loadAvg || [0, 0, 0]);

    const memPercent = Number((qk.mem ?? 0).toFixed(1));
    const swapPercent = Number((qk.swap ?? 0).toFixed(1));

    return {
      id: node.id,
      label: node.label,
      tag: node.tag || 'Server',
      url: node.url,
      online: true,
      failCount: 0,
      latencyMs,
      system: {
        hostname: prev.system?.hostname || node.label,
        osName: prev.system?.osName || 'Linux',
        platform: prev.system?.platform || '',
        uptime: prev.system?.uptime || 'Normal'
      },
      cpu: {
        percent: cpuPercent,
        name: cpuName,
        cores: cpuCores,
        logicalCores: cpuLogicalCores,
        frequencyMhz: cpuHz,
        loadAvg
      },
      memory: {
        percent: memPercent,
        totalBytes: prev.memory?.totalBytes || 0,
        usedBytes: prev.memory?.usedBytes || 0,
        availableBytes: prev.memory?.availableBytes || 0,
        cachedBytes: prev.memory?.cachedBytes || 0
      },
      swap: {
        percent: swapPercent,
        totalBytes: prev.swap?.totalBytes || 0,
        usedBytes: prev.swap?.usedBytes || 0
      },
      disks: prev.disks || [],
      network: prev.network || { interfaces: [], totalRxRate: 0, totalTxRate: 0 },
      processes: { total: 0, running: 0, topList: [] },
      containers: [],
      sensors: [],
      lastSeen: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    let friendlyError = error.message;
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      friendlyError = '网络延迟过高 (请求超时)';
    } else if (error.code === 'ECONNRESET') {
      friendlyError = '连接被重置 (网络波动)';
    } else if (error.code === 'ECONNREFUSED') {
      friendlyError = '端口未开放或服务未启动';
    }

    const currentFailCount = (prev.failCount || 0) + 1;
    // Allow 1 transient retry cycle before declaring offline
    const isGraceCycle = prev.online && currentFailCount < 2;

    return {
      id: node.id,
      label: node.label,
      tag: node.tag || 'Server',
      url: node.url,
      online: isGraceCycle ? true : false,
      failCount: currentFailCount,
      latencyMs,
      error: friendlyError,
      lastSeen: prev.lastSeen || null,
      system: prev.system || {
        hostname: node.label,
        osName: 'Unknown',
        uptime: '无法连接'
      },
      cpu: prev.cpu || { percent: 0, cores: 1, loadAvg: [0, 0, 0] },
      memory: prev.memory || { percent: 0, totalBytes: 0, usedBytes: 0 },
      swap: prev.swap || { percent: 0, totalBytes: 0, usedBytes: 0 },
      disks: prev.disks || [],
      network: prev.network || { interfaces: [], totalRxRate: 0, totalTxRate: 0 },
      processes: { total: 0, running: 0, topList: [] },
      containers: [],
      sensors: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Fetch all glances nodes concurrently
 */
export async function fetchAllGlancesNodes(nodes, auth, prevNodesMap = new Map()) {
  const promises = nodes.map(node => fetchGlancesNode(node, auth, prevNodesMap.get(node.id)));
  return await Promise.all(promises);
}
