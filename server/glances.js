import axios from 'axios';
import http from 'http';

// Reusable HTTP Keep-Alive Agent to eliminate TCP handshake overhead on high-latency routes
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 25
});

/**
 * Fetch and normalize data from a single Glances node with intelligent fallback
 */
export async function fetchGlancesNode(node, auth, previousNodeData = null) {
  const startTime = Date.now();
  const basicAuthHeader = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  const prev = previousNodeData || {};

  // Cloud VPS nodes (e.g. Oracle, BWH) traverse transpacific routes with higher latency
  const isCloudNode = node.id?.includes('oracle') || node.id?.includes('bwh') || node.tag?.includes('VPS');
  const mainTimeoutMs = isCloudNode ? 7000 : 3500;

  let raw = null;
  let isQuicklookOnly = false;
  let fetchError = null;

  // 1. Attempt full metrics fetch (/api/4/all) with gzip compression
  try {
    const response = await axios.get(`${node.url}/api/4/all`, {
      headers: {
        'Authorization': basicAuthHeader,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      httpAgent,
      timeout: mainTimeoutMs
    });
    raw = response.data || {};
  } catch (err) {
    fetchError = err;

    // 2. Fallback for cloud nodes: if full 15KB /api/4/all times out due to packet loss,
    // fetch lightweight /api/4/quicklook (580 bytes, fits into a single TCP packet)
    try {
      const qRes = await axios.get(`${node.url}/api/4/quicklook`, {
        headers: {
          'Authorization': basicAuthHeader,
          'Accept': 'application/json'
        },
        httpAgent,
        timeout: 3500
      });
      if (qRes.data && typeof qRes.data === 'object' && typeof qRes.data.cpu !== 'undefined') {
        raw = { quicklook: qRes.data };
        isQuicklookOnly = true;
        fetchError = null; // Successfully rescued by quicklook!
      }
    } catch (qErr) {
      // Both attempts failed
    }
  }

  // Handle successful data extraction
  if (raw) {
    const latencyMs = Date.now() - startTime;

    // System Info
    const sys = raw.system || prev.system || {};
    const uptimeStr = raw.uptime || (raw.core && raw.core.uptime) || prev.system?.uptime || 'Normal';

    // CPU Info
    const cpuRaw = raw.cpu || {};
    const quicklook = raw.quicklook || {};
    const cpuPercent = Number((quicklook.cpu ?? cpuRaw.total ?? prev.cpu?.percent ?? 0).toFixed(1));
    const cpuName = quicklook.cpu_name || cpuRaw.name || prev.cpu?.name || 'CPU';
    const cpuCores = quicklook.cpu_phys_core || (raw.core && raw.core.phys) || prev.cpu?.cores || 1;
    const cpuLogicalCores = quicklook.cpu_log_core || (raw.core && raw.core.log) || prev.cpu?.logicalCores || 1;
    const cpuHz = quicklook.cpu_hz_current ? Math.round(quicklook.cpu_hz_current / 1000000) : (prev.cpu?.frequencyMhz || null);
    
    const loadRaw = raw.load || {};
    const loadAvg = isQuicklookOnly && quicklook.load !== undefined
      ? [Number(Number(quicklook.load).toFixed(2)), prev.cpu?.loadAvg?.[1] || 0, prev.cpu?.loadAvg?.[2] || 0]
      : [
          loadRaw.min1 ?? quicklook.load ?? prev.cpu?.loadAvg?.[0] ?? 0,
          loadRaw.min5 ?? prev.cpu?.loadAvg?.[1] ?? 0,
          loadRaw.min15 ?? prev.cpu?.loadAvg?.[2] ?? 0
        ].map(v => Number(Number(v).toFixed(2)));

    // Memory Info
    const memRaw = raw.mem || {};
    const memTotal = memRaw.total || prev.memory?.totalBytes || 1024 * 1024 * 1024;
    const memPercent = Number((quicklook.mem ?? memRaw.percent ?? prev.memory?.percent ?? 0).toFixed(1));
    const memUsed = memRaw.used || Math.round((memPercent / 100) * memTotal);
    const memAvailable = memRaw.available ?? (memTotal - memUsed);
    const memCached = memRaw.cached || prev.memory?.cachedBytes || 0;

    // Swap Info
    const swapRaw = raw.memswap || {};
    const swapTotal = swapRaw.total || prev.swap?.totalBytes || 0;
    const swapPercent = Number((quicklook.swap ?? swapRaw.percent ?? prev.swap?.percent ?? 0).toFixed(1));
    const swapUsed = swapRaw.used || Math.round((swapPercent / 100) * swapTotal);

    // File Systems
    const fsList = Array.isArray(raw.fs) ? raw.fs.map(fs => ({
      mount: fs.mnt_point || fs.mount_point || '/',
      device: fs.device_name || fs.fs_type || '',
      totalBytes: fs.size || 0,
      usedBytes: fs.used || 0,
      freeBytes: fs.free || 0,
      percent: Number(Number(fs.percent || 0).toFixed(1))
    })) : (prev.disks || []);

    // Network Interfaces
    const netList = Array.isArray(raw.network) ? raw.network
      .filter(n => n.interface_name && n.interface_name !== 'lo')
      .map(n => ({
        name: n.interface_name,
        rxSpeedBytes: n.rx || 0,
        txSpeedBytes: n.tx || 0,
        cumulativeRxBytes: n.cumulative_rx || 0,
        cumulativeTxBytes: n.cumulative_tx || 0
      })) : (prev.network?.interfaces || []);

    const totalRxRate = netList.reduce((acc, curr) => acc + curr.rxSpeedBytes, 0);
    const totalTxRate = netList.reduce((acc, curr) => acc + curr.txSpeedBytes, 0);

    // Processes
    const pCount = raw.processcount || {};
    const pList = Array.isArray(raw.processlist) ? raw.processlist.slice(0, 8).map(p => ({
      pid: p.pid,
      name: p.name,
      cpuPercent: Number(Number(p.cpu_percent || 0).toFixed(1)),
      memPercent: Number(Number(p.memory_percent || 0).toFixed(1)),
      username: p.username || ''
    })) : (prev.processes?.topList || []);

    // Docker Containers
    const containers = Array.isArray(raw.containers) ? raw.containers.map(c => ({
      name: c.name || c.Names?.[0] || 'container',
      status: c.Status || c.status || 'running',
      image: c.Image || c.image || '',
      cpuPercent: Number(Number(c.cpu_percent || 0).toFixed(1)),
      memoryPercent: Number(Number(c.memory_percent || 0).toFixed(1))
    })) : (prev.containers || []);

    // Sensors / Temperature
    const sensors = Array.isArray(raw.sensors) ? raw.sensors.map(s => ({
      label: s.label || s.type || 'Temp',
      value: s.value || 0,
      unit: s.unit || '°C'
    })) : (prev.sensors || []);

    return {
      id: node.id,
      label: node.label,
      tag: node.tag || 'Server',
      url: node.url,
      online: true,
      failCount: 0,
      latencyMs,
      system: {
        hostname: sys.hostname || prev.system?.hostname || node.label,
        osName: sys.os_name || sys.linux_distro || prev.system?.osName || 'Linux',
        platform: sys.platform || prev.system?.platform || '',
        uptime: uptimeStr
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
        totalBytes: memTotal,
        usedBytes: memUsed,
        availableBytes: memAvailable,
        cachedBytes: memCached
      },
      swap: {
        percent: swapPercent,
        totalBytes: swapTotal,
        usedBytes: swapUsed
      },
      disks: fsList,
      network: {
        interfaces: netList,
        totalRxRate,
        totalTxRate
      },
      processes: {
        total: pCount.total || prev.processes?.total || 0,
        running: pCount.running || prev.processes?.running || 0,
        topList: pList
      },
      containers,
      sensors,
      lastSeen: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Handle failure
  const latencyMs = Date.now() - startTime;
  let friendlyError = fetchError?.message || '无法连接';
  if (fetchError?.code === 'ECONNABORTED' || fetchError?.message?.includes('timeout')) {
    friendlyError = '网络延迟过高 (请求超时)';
  } else if (fetchError?.code === 'ECONNRESET') {
    friendlyError = '连接被重置 (网络波动)';
  } else if (fetchError?.code === 'ECONNREFUSED') {
    friendlyError = '端口未开放或服务未启动';
  }

  // Flapping suppression: If node was previously online, tolerate 1 transient poll failure
  const currentFailCount = (prev.failCount || 0) + 1;
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
    processes: prev.processes || { total: 0, running: 0, topList: [] },
    containers: prev.containers || [],
    sensors: prev.sensors || [],
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Fetch all glances nodes concurrently
 */
export async function fetchAllGlancesNodes(nodes, auth, prevNodesMap = new Map()) {
  const promises = nodes.map(node => fetchGlancesNode(node, auth, prevNodesMap.get(node.id)));
  return await Promise.all(promises);
}
