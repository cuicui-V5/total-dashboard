import axios from 'axios';

/**
 * Fetch and normalize data from BandwagonHost (KiwiVM) API
 */
export async function fetchBwhInstance(inst) {
  const startTime = Date.now();

  try {
    const url = `https://api.64clouds.com/v1/getLiveServiceInfo?veid=${inst.veid}&api_key=${inst.apiKey}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });

    const latencyMs = Date.now() - startTime;
    const raw = response.data || {};

    if (raw.error && raw.error !== 0) {
      throw new Error(`KiwiVM Error: ${raw.message || raw.error}`);
    }

    // Bandwidth Calculations
    const monthlyTotalBytes = Number(raw.plan_monthly_data) || 0;
    const usedBytes = Number(raw.data_counter) || 0;
    const remainingBytes = Math.max(0, monthlyTotalBytes - usedBytes);
    const bandwidthPercent = monthlyTotalBytes > 0 ? Number(((usedBytes / monthlyTotalBytes) * 100).toFixed(1)) : 0;

    // Reset date calculation
    const resetTimestamp = raw.data_next_reset ? Number(raw.data_next_reset) * 1000 : null;
    const resetDate = resetTimestamp ? new Date(resetTimestamp).toISOString() : null;
    let daysUntilReset = null;
    if (resetTimestamp) {
      const diffMs = resetTimestamp - Date.now();
      daysUntilReset = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Disk Calculations
    const diskQuotaGb = parseFloat(raw.ve_disk_quota_gb) || (Number(raw.plan_disk) / (1024 * 1024 * 1024)) || 10;
    const diskTotalBytes = diskQuotaGb * 1024 * 1024 * 1024;
    const diskUsedBytes = Number(raw.ve_used_disk_space_b) || 0;
    const diskPercent = diskTotalBytes > 0 ? Number(((diskUsedBytes / diskTotalBytes) * 100).toFixed(1)) : 0;

    // RAM Calculations
    const ramTotalBytes = Number(raw.plan_ram) || 0;
    const ramAvailableKb = Number(raw.mem_available_kb) || 0;
    const ramAvailableBytes = ramAvailableKb * 1024;
    const ramUsedBytes = Math.max(0, ramTotalBytes - ramAvailableBytes);
    const ramPercent = ramTotalBytes > 0 ? Number(((ramUsedBytes / ramTotalBytes) * 100).toFixed(1)) : 0;

    return {
      id: inst.id,
      label: inst.label,
      veid: inst.veid,
      online: raw.ve_status === 'running',
      status: raw.ve_status || 'unknown',
      latencyMs,
      datacenter: raw.node_datacenter || raw.node_location || 'USA',
      location: raw.node_location || 'US',
      ip: (raw.ip_addresses && raw.ip_addresses[0]) || raw.hostname || '',
      sshPort: raw.ssh_port || 22,
      plan: raw.plan || 'Standard KVM',
      vmType: raw.vm_type || 'kvm',
      os: raw.os || 'Linux',
      loadAverage: raw.load_average || '',
      suspended: Boolean(raw.suspended),
      bandwidth: {
        totalBytes: monthlyTotalBytes,
        usedBytes,
        remainingBytes,
        percent: bandwidthPercent,
        nextResetDate: resetDate,
        daysUntilReset
      },
      disk: {
        totalQuotaGb: diskQuotaGb,
        totalBytes: diskTotalBytes,
        usedBytes: diskUsedBytes,
        percent: diskPercent
      },
      ram: {
        totalBytes: ramTotalBytes,
        usedBytes: ramUsedBytes,
        percent: ramPercent
      },
      screendumpPng: raw.screendump_png_base64 || null,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    return {
      id: inst.id,
      label: inst.label,
      veid: inst.veid,
      online: false,
      status: 'offline',
      latencyMs: Date.now() - startTime,
      error: error.message,
      datacenter: 'Unknown',
      ip: '',
      bandwidth: { totalBytes: 0, usedBytes: 0, percent: 0 },
      disk: { totalBytes: 0, usedBytes: 0, percent: 0 },
      ram: { totalBytes: 0, usedBytes: 0, percent: 0 },
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Fetch all BWH instances concurrently
 */
export async function fetchAllBwhInstances(instances) {
  const promises = instances.map(inst => fetchBwhInstance(inst));
  return await Promise.all(promises);
}
