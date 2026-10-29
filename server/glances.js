import axios from 'axios';

/**
 * Fetch and normalize data from a single Glances node using pure lightweight quicklook API (~580 bytes)
 */
export async function fetchGlancesNode(node, auth, previousNodeData = null) {
  const startTime = Date.now();
  const basicAuthHeader = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  const prev = previousNodeData || {};

  // Cloud VPS nodes traverse transpacific routes with higher latency
  const isCloudNode = node.id?.includes('oracle') || node.id?.includes('bwh') || node.tag?.includes('VPS');
  const timeoutMs = isCloudNode ? 16000 : 5000;

  try {
    const response = await axios.get(`${node.url}/api/4/quicklook`, {
      headers: {
        'Authorization': basicAuthHeader,
        'Accept': 'application/json'
      },
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

// 30-second in-memory cache for on-demand full details
const fullDetailCache = new Map();

/**
 * On-demand full detail fetcher for a single Glances node (~15KB)
 * Triggered ONLY when user explicitly inspects a node
 */
export async function fetchGlancesNodeFullDetail(node, auth, force = false) {
  const cacheKey = node.id;
  const now = Date.now();
  const cached = fullDetailCache.get(cacheKey);

  if (!force && cached && (now - cached.timestamp < 30000)) {
    return { ...cached.data, fromCache: true };
  }

  const startTime = Date.now();
  const basicAuthHeader = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  const isCloudNode = node.id?.includes('oracle') || node.id?.includes('bwh') || node.tag?.includes('VPS');
  // Full details on high-loss transpacific routes can take up to 28s
  const timeoutMs = isCloudNode ? 28000 : 12000;

  try {
    const response = await axios.get(`${node.url}/api/4/all`, {
      headers: {
        'Authorization': basicAuthHeader,
        'Accept': 'application/json'
      },
      timeout: timeoutMs
    });

    const latencyMs = Date.now() - startTime;
    const all = response.data || {};

    const qk = all.quicklook || {};
    const sys = all.system || {};
    const cpu = all.cpu || {};
    const core = all.core || {};
    const load = all.load || {};
    const mem = all.mem || {};
    const swap = all.memswap || {};

    // 1. CPU
    const cpuPercent = Number((qk.cpu ?? cpu.total ?? 0).toFixed(1));
    const cpuName = qk.cpu_name || cpu.name || 'CPU';
    const cpuCores = qk.cpu_phys_core || core.phys || 1;
    const cpuLogicalCores = qk.cpu_log_core || core.log || 1;
    const cpuHz = qk.cpu_hz_current ? Math.round(qk.cpu_hz_current / 1000000) : null;
    const loadAvg = [
      load.min1 !== undefined ? Number(load.min1.toFixed(2)) : 0,
      load.min5 !== undefined ? Number(load.min5.toFixed(2)) : 0,
      load.min15 !== undefined ? Number(load.min15.toFixed(2)) : 0
    ];
    const cpuTimes = {
      user: typeof cpu.user === 'number' ? Number(cpu.user.toFixed(1)) : 0,
      system: typeof cpu.system === 'number' ? Number(cpu.system.toFixed(1)) : 0,
      idle: typeof cpu.idle === 'number' ? Number(cpu.idle.toFixed(1)) : 0,
      iowait: typeof cpu.iowait === 'number' ? Number(cpu.iowait.toFixed(1)) : 0
    };

    // 2. Memory
    const memPercent = Number((mem.percent ?? qk.mem ?? 0).toFixed(1));
    const memory = {
      percent: memPercent,
      totalBytes: mem.total || 0,
      usedBytes: mem.used || 0,
      freeBytes: mem.free || 0,
      availableBytes: mem.available || 0,
      cachedBytes: mem.cached || 0,
      buffersBytes: mem.buffers || 0
    };

    // 3. Swap
    const swapPercent = Number((swap.percent ?? qk.swap ?? 0).toFixed(1));
    const swapData = {
      percent: swapPercent,
      totalBytes: swap.total || 0,
      usedBytes: swap.used || 0,
      freeBytes: swap.free || 0
    };

    // 4. Filesystem Disks
    const rawFs = Array.isArray(all.fs) ? all.fs : [];
    const seenMounts = new Set();
    const disks = [];
    for (const f of rawFs) {
      if (!f || !f.mnt_point) continue;
      const mount = f.mnt_point;
      if (mount.startsWith('/etc/') || mount.startsWith('/root/') || mount.startsWith('/var/lib/docker/overlay')) {
        continue;
      }
      if (seenMounts.has(mount)) continue;
      seenMounts.add(mount);

      disks.push({
        device: f.device_name || '',
        mount: f.mnt_point,
        fsType: f.fs_type || '',
        totalBytes: f.size || 0,
        usedBytes: f.used || 0,
        freeBytes: f.free || 0,
        percent: Number((f.percent || 0).toFixed(1))
      });
    }

    if (disks.length === 0 && rawFs.length > 0) {
      const seenDev = new Set();
      for (const f of rawFs) {
        if (!seenDev.has(f.device_name)) {
          seenDev.add(f.device_name);
          disks.push({
            device: f.device_name || '',
            mount: f.mnt_point || '/',
            fsType: f.fs_type || '',
            totalBytes: f.size || 0,
            usedBytes: f.used || 0,
            freeBytes: f.free || 0,
            percent: Number((f.percent || 0).toFixed(1))
          });
        }
      }
    }

    // 5. Network Interfaces
    const rawNet = Array.isArray(all.network) ? all.network : [];
    const interfaces = rawNet
      .filter(n => n && n.interface_name && n.interface_name !== 'lo')
      .map(n => ({
        name: n.interface_name,
        rxSpeedBytes: n.rx || 0,
        txSpeedBytes: n.tx || 0,
        cumulativeRxBytes: n.cumulative_rx || 0,
        cumulativeTxBytes: n.cumulative_tx || 0
      }));

    // 6. Top Processes
    const rawProcs = Array.isArray(all.processlist) ? all.processlist : [];
    const sortedProcs = [...rawProcs].sort((a, b) => (b.cpu_percent || 0) - (a.cpu_percent || 0));
    const topProcesses = sortedProcs.slice(0, 35).map(p => ({
      pid: p.pid,
      name: p.name || 'unknown',
      username: p.username || 'system',
      status: p.status || 'S',
      cpuPercent: Number((p.cpu_percent || 0).toFixed(1)),
      memPercent: Number((p.memory_percent || 0).toFixed(1)),
      numThreads: p.num_threads || 1,
      rssBytes: p.memory_info?.rss || 0,
      cmdline: Array.isArray(p.cmdline) ? p.cmdline.join(' ') : (p.cmdline || '')
    }));

    // 7. Containers
    const rawContainers = Array.isArray(all.containers) ? all.containers : (Array.isArray(all.docker) ? all.docker : []);
    const containers = rawContainers.map(c => ({
      id: c.id ? c.id.substring(0, 12) : '',
      name: c.name || 'unnamed',
      image: Array.isArray(c.image) ? c.image[0] : (c.image || ''),
      status: c.status || 'running',
      uptime: c.uptime || '',
      ports: c.ports || '',
      cpuPercent: Number((c.cpu_percent || c.cpu?.total || 0).toFixed(1)),
      memoryUsageBytes: c.memory_usage || c.memory?.usage || 0,
      memoryLimitBytes: c.memory_limit || c.memory?.limit || 0,
      command: c.command || ''
    }));

    // 8. Sensors
    const rawSensors = Array.isArray(all.sensors) ? all.sensors : [];
    const sensors = rawSensors.map(s => ({
      label: s.label || '',
      value: s.value,
      unit: s.unit || 'C',
      type: s.type || 'temperature'
    }));

    // 9. Disk I/O
    const rawDiskio = Array.isArray(all.diskio) ? all.diskio : [];
    const diskio = rawDiskio.map(d => ({
      diskName: d.disk_name,
      readBytesRate: d.read_bytes || 0,
      writeBytesRate: d.write_bytes || 0
    }));

    const result = {
      id: node.id,
      label: node.label,
      tag: node.tag || 'Server',
      url: node.url,
      online: true,
      latencyMs,
      fullFetchedAt: new Date().toISOString(),
      system: {
        hostname: sys.hostname || node.label,
        osName: sys.os_name || 'Linux',
        platform: sys.platform || '',
        linuxDistro: sys.linux_distro || '',
        osVersion: sys.os_version || '',
        hrName: sys.hr_name || `${sys.os_name || 'Linux'} ${sys.os_version || ''}`,
        uptime: all.uptime || 'Normal'
      },
      cpu: {
        percent: cpuPercent,
        name: cpuName,
        cores: cpuCores,
        logicalCores: cpuLogicalCores,
        frequencyMhz: cpuHz,
        loadAvg,
        times: cpuTimes
      },
      memory,
      swap: swapData,
      disks,
      diskio,
      network: {
        interfaces,
        totalRxRate: interfaces.reduce((a, b) => a + (b.rxSpeedBytes || 0), 0),
        totalTxRate: interfaces.reduce((a, b) => a + (b.txSpeedBytes || 0), 0)
      },
      processes: {
        total: all.processcount?.total || rawProcs.length || 0,
        running: all.processcount?.running || 0,
        sleeping: all.processcount?.sleeping || 0,
        topList: topProcesses
      },
      containers,
      sensors,
      fromCache: false
    };

    fullDetailCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    let friendlyError = error.message;
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      friendlyError = '全量数据拉取超时 (海外跨洋高丢包链路)';
    } else if (error.code === 'ECONNRESET') {
      friendlyError = '连接被重置 (网络波动)';
    } else if (error.code === 'ECONNREFUSED') {
      friendlyError = '节点拒绝连接';
    }

    throw new Error(friendlyError);
  }
}
