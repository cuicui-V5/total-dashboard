import axios from 'axios';

/**
 * Fetch and normalize data from a single Glances node
 */
export async function fetchGlancesNode(node, auth) {
  const startTime = Date.now();
  const basicAuthHeader = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');

  try {
    const response = await axios.get(`${node.url}/api/4/all`, {
      headers: {
        'Authorization': basicAuthHeader,
        'Accept': 'application/json'
      },
      timeout: 12000
    });

    const latencyMs = Date.now() - startTime;
    const raw = response.data || {};

    // System Info
    const sys = raw.system || {};
    const uptimeStr = raw.uptime || (raw.core && raw.core.uptime) || 'Unknown';

    // CPU Info
    const cpuRaw = raw.cpu || {};
    const quicklook = raw.quicklook || {};
    const cpuPercent = Number((quicklook.cpu ?? cpuRaw.total ?? 0).toFixed(1));
    const cpuName = quicklook.cpu_name || cpuRaw.name || 'CPU';
    const cpuCores = quicklook.cpu_phys_core || (raw.core && raw.core.phys) || 1;
    const cpuLogicalCores = quicklook.cpu_log_core || (raw.core && raw.core.log) || 1;
    const cpuHz = quicklook.cpu_hz_current ? Math.round(quicklook.cpu_hz_current / 1000000) : null;
    const loadRaw = raw.load || {};
    const loadAvg = [
      loadRaw.min1 ?? quicklook.load ?? 0,
      loadRaw.min5 ?? 0,
      loadRaw.min15 ?? 0
    ].map(v => Number(Number(v).toFixed(2)));

    // Memory Info
    const memRaw = raw.mem || {};
    const memTotal = memRaw.total || 0;
    const memUsed = memRaw.used || 0;
    const memPercent = Number((quicklook.mem ?? memRaw.percent ?? (memTotal > 0 ? (memUsed / memTotal * 100) : 0)).toFixed(1));
    const memAvailable = memRaw.available ?? (memTotal - memUsed);
    const memCached = memRaw.cached || 0;

    // Swap Info
    const swapRaw = raw.memswap || {};
    const swapTotal = swapRaw.total || 0;
    const swapUsed = swapRaw.used || 0;
    const swapPercent = Number((quicklook.swap ?? swapRaw.percent ?? (swapTotal > 0 ? (swapUsed / swapTotal * 100) : 0)).toFixed(1));

    // File Systems
    const fsList = Array.isArray(raw.fs) ? raw.fs.map(fs => ({
      mount: fs.mnt_point || fs.mount_point || '/',
      device: fs.device_name || fs.fs_type || '',
      totalBytes: fs.size || 0,
      usedBytes: fs.used || 0,
      freeBytes: fs.free || 0,
      percent: Number(Number(fs.percent || 0).toFixed(1))
    })) : [];

    // Network Interfaces
    const netList = Array.isArray(raw.network) ? raw.network
      .filter(n => n.interface_name && n.interface_name !== 'lo')
      .map(n => ({
        name: n.interface_name,
        rxSpeedBytes: n.rx || 0, // bytes/sec
        txSpeedBytes: n.tx || 0, // bytes/sec
        cumulativeRxBytes: n.cumulative_rx || 0,
        cumulativeTxBytes: n.cumulative_tx || 0
      })) : [];

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
    })) : [];

    // Docker Containers
    const containers = Array.isArray(raw.containers) ? raw.containers.map(c => ({
      name: c.name || c.Names?.[0] || 'container',
      status: c.Status || c.status || 'running',
      image: c.Image || c.image || '',
      cpuPercent: Number(Number(c.cpu_percent || 0).toFixed(1)),
      memoryPercent: Number(Number(c.memory_percent || 0).toFixed(1))
    })) : [];

    // Sensors / Temperature
    const sensors = Array.isArray(raw.sensors) ? raw.sensors.map(s => ({
      label: s.label || s.type || 'Temp',
      value: s.value || 0,
      unit: s.unit || '°C'
    })) : [];

    return {
      id: node.id,
      label: node.label,
      tag: node.tag || 'Server',
      url: node.url,
      online: true,
      latencyMs,
      system: {
        hostname: sys.hostname || node.label,
        osName: sys.os_name || sys.linux_distro || 'Linux',
        platform: sys.platform || '',
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
        total: pCount.total || 0,
        running: pCount.running || 0,
        topList: pList
      },
      containers,
      sensors,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      id: node.id,
      label: node.label,
      tag: node.tag || 'Server',
      url: node.url,
      online: false,
      latencyMs,
      error: error.message,
      system: {
        hostname: node.label,
        osName: 'Unknown',
        uptime: 'Unreachable'
      },
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
  }
}

/**
 * Fetch all glances nodes concurrently
 */
export async function fetchAllGlancesNodes(nodes, auth) {
  const promises = nodes.map(node => fetchGlancesNode(node, auth));
  return await Promise.all(promises);
}
