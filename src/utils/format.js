/**
 * Format bytes to human readable format (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return '0 B';
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'B'}`;
}

/**
 * Format speed in bytes per second to human readable format (KB/s, MB/s)
 */
export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

/**
 * Color classifier for percentage values
 */
export function getPercentColor(percent) {
  if (percent >= 90) return { text: 'text-rose-600', bg: 'bg-rose-500', lightBg: 'bg-rose-50', border: 'border-rose-200' };
  if (percent >= 75) return { text: 'text-amber-600', bg: 'bg-amber-500', lightBg: 'bg-amber-50', border: 'border-amber-200' };
  if (percent >= 50) return { text: 'text-sky-600', bg: 'bg-sky-500', lightBg: 'bg-sky-50', border: 'border-sky-200' };
  return { text: 'text-emerald-600', bg: 'bg-emerald-500', lightBg: 'bg-emerald-50', border: 'border-emerald-200' };
}

/**
 * Format latency with appropriate badge color
 */
export function getLatencyBadge(latencyMs) {
  if (!latencyMs && latencyMs !== 0) return { text: '-- ms', color: 'text-slate-400 bg-slate-100' };
  if (latencyMs < 30) return { text: `${Math.round(latencyMs)}ms`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (latencyMs < 100) return { text: `${Math.round(latencyMs)}ms`, color: 'text-sky-700 bg-sky-50 border-sky-200' };
  if (latencyMs < 250) return { text: `${Math.round(latencyMs)}ms`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { text: `${Math.round(latencyMs)}ms`, color: 'text-rose-700 bg-rose-50 border-rose-200' };
}
