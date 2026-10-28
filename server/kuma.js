import axios from 'axios';

/**
 * Fetch and parse Uptime Kuma Prometheus metrics
 */
export async function fetchUptimeKumaMetrics(kumaUrl, apiKey) {
  const startTime = Date.now();
  const basicAuthHeader = 'Basic ' + Buffer.from(`:${apiKey}`).toString('base64');

  try {
    const response = await axios.get(`${kumaUrl}/metrics`, {
      headers: {
        'Authorization': basicAuthHeader
      },
      timeout: 5000
    });

    const latencyMs = Date.now() - startTime;
    const text = response.data || '';
    const lines = text.split('\n');

    // Parse Prometheus format
    // Examples:
    // monitor_status{monitor_name="搬瓦工1",monitor_type="ping",monitor_url="https://bwh.cuijunyu.win/",monitor_hostname="bwh.cuijunyu.win",monitor_port="443"} 1
    // monitor_response_time{monitor_name="搬瓦工1",monitor_type="ping",...} 154
    // monitor_cert_days_remaining{monitor_name="百度",...} 88
    // monitor_cert_is_valid{monitor_name="百度",...} 1

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
          name,
          type: labels.monitor_type || 'ping',
          url: labels.monitor_url || '',
          hostname: labels.monitor_hostname || '',
          port: labels.monitor_port || '',
          status: 'unknown',
          statusCode: 0,
          pingMs: null,
          certDaysRemaining: null,
          certIsValid: null
        });
      }

      const item = monitorsMap.get(name);

      if (metricName === 'monitor_status') {
        item.statusCode = value;
        // 1 = UP, 0 = DOWN, 2 = PENDING, 3 = MAINTENANCE
        item.status = value === 1 ? 'up' : (value === 0 ? 'down' : (value === 2 ? 'pending' : 'maintenance'));
      } else if (metricName === 'monitor_response_time') {
        item.pingMs = Number(value.toFixed(1));
      } else if (metricName === 'monitor_cert_days_remaining') {
        item.certDaysRemaining = Math.round(value);
      } else if (metricName === 'monitor_cert_is_valid') {
        item.certIsValid = value === 1;
      }
    }

    const monitors = Array.from(monitorsMap.values());
    const upCount = monitors.filter(m => m.status === 'up').length;

    return {
      online: true,
      latencyMs,
      totalCount: monitors.length,
      upCount,
      downCount: monitors.length - upCount,
      healthPercent: monitors.length > 0 ? Number(((upCount / monitors.length) * 100).toFixed(1)) : 100,
      monitors,
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
      lastUpdated: new Date().toISOString()
    };
  }
}
