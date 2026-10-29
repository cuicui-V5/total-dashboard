import React from 'react';
import { 
  Server, 
  Activity, 
  HardDriveDownload, 
  TrendingUp, 
  ArrowRight, 
  Cpu, 
  Database, 
  ArrowDownUp, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Globe, 
  Clock, 
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import SummaryCards from './SummaryCards';
import { formatBytes, formatSpeed, getPercentColor, getLatencyBadge } from '../utils/format';

export default function OverviewPage({ 
  fleetData, 
  onSelectNode, 
  onNavigateTab 
}) {
  const nodes = fleetData?.nodes || [];
  const kuma = fleetData?.kuma || { monitors: [] };
  const bwh = fleetData?.bwh || [];
  const summary = fleetData?.summary || {};

  // Find fastest & slowest monitors
  const validMonitors = (kuma.monitors || []).filter(m => (m.pingMs || 0) > 0);
  const sortedMonitors = [...validMonitors].sort((a, b) => (a.pingMs || 9999) - (b.pingMs || 9999));
  const fastestMonitor = sortedMonitors[0] || null;
  const slowestMonitor = sortedMonitors[sortedMonitors.length - 1] || null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Top High-level Metric Stat Cards */}
      <SummaryCards summary={summary} />

      {/* 2. CLASSIFICATION 1: FLEET NODES MATRIX (设备集群运行概览矩阵) */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-subtle border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center space-x-2">
                <span>设备集群运行矩阵</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {nodes.filter(n => n.online).length}/{nodes.length} 在线
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                实时聚合 PVE 宿主及海外多地域 VPS 主机的轻量核心资源负载
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('nodes')}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50/70 hover:bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60 transition-all self-start sm:self-auto group"
          >
            <span>完整设备监控 ({nodes.length})</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* 5 Nodes Compact Grid Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {nodes.map(node => {
            const cpuColor = getPercentColor(node.cpu?.percent || 0);
            const memColor = getPercentColor(node.memory?.percent || 0);
            const isOnline = node.online;

            return (
              <div
                key={node.id}
                onClick={() => isOnline && onSelectNode(node)}
                className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                  isOnline
                    ? 'bg-white hover:bg-slate-50/80 border-slate-200/90 shadow-xs hover:shadow-md cursor-pointer group'
                    : 'bg-slate-50/60 border-slate-200/60 opacity-80'
                }`}
              >
                <div>
                  {/* Node Header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-400'}`} />
                      <span className="font-bold text-slate-800 text-xs tracking-tight group-hover:text-sky-600 transition-colors">
                        {node.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-medium bg-slate-100 text-slate-500 border border-slate-200/70">
                        {node.tag}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono">
                      {isOnline ? (
                        <span className="text-slate-400">{node.latencyMs ? `${node.latencyMs}ms` : '在线'}</span>
                      ) : (
                        <span className="text-rose-600 font-semibold">离线</span>
                      )}
                    </div>
                  </div>

                  {/* Resource Gauges (CPU & RAM) */}
                  {isOnline ? (
                    <div className="space-y-2 mt-3 font-mono text-[11px]">
                      {/* CPU Bar */}
                      <div>
                        <div className="flex justify-between text-slate-600 mb-1">
                          <span className="text-slate-400 font-sans">CPU</span>
                          <span className="font-bold">{node.cpu?.percent || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${cpuColor.bg}`}
                            style={{ width: `${Math.min(100, Math.max(0, node.cpu?.percent || 0))}%` }}
                          />
                        </div>
                      </div>

                      {/* Memory Bar */}
                      <div>
                        <div className="flex justify-between text-slate-600 mb-1">
                          <span className="text-slate-400 font-sans">内存</span>
                          <span className="font-bold">{node.memory?.percent || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${memColor.bg}`}
                            style={{ width: `${Math.min(100, Math.max(0, node.memory?.percent || 0))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 text-center text-xs text-rose-600 font-sans">
                      {node.error || '节点连接超时或网络异常'}
                    </div>
                  )}
                </div>

                {/* Bottom Footnote & Action */}
                {isOnline && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400 truncate max-w-[110px]">
                      {node.cpu?.logicalCores ? `${node.cpu.logicalCores}核 • ` : ''}Load: {node.cpu?.loadAvg?.[0] || '0'}
                    </span>
                    <span className="text-sky-600 font-semibold flex items-center space-x-0.5 group-hover:translate-x-0.5 transition-transform">
                      <span>全量详情</span>
                      <span>→</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. CLASSIFICATION 2: NETWORK CONNECTIVITY & LATENCY OVERVIEW (网络连通性与时序概览) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Uptime Kuma 7 Services Quick List */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5 sm:p-6 shadow-subtle border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center space-x-2">
                    <span>网络服务链路状态 (Uptime Kuma)</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      {kuma.healthPercent || 100}% 可用
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    覆盖局域网网关、国内核心 DNS、公网 Web 与跨国云主机
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('kuma')}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <span>完整状态条带</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 7 Monitors Compact List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(kuma.monitors || []).map(m => {
                const isUp = m.status === 'up';
                const ping = m.pingMs;
                const badge = getLatencyBadge(ping);

                return (
                  <div 
                    key={m.id || m.name}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`h-2 w-2 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`} />
                      <span className="font-semibold text-slate-700">{m.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white text-slate-400 border border-slate-200 uppercase">
                        {m.type}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isUp && typeof ping === 'number' ? (
                        <span className={`font-bold ${badge.color}`}>
                          {ping} ms
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold">异常</span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {m.uptime24h ? `${m.uptime24h}%` : '100%'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Jump Banner to High Density Latency Charts */}
          <div className="mt-5 p-3.5 rounded-xl bg-gradient-to-r from-sky-50 via-indigo-50/40 to-white border border-sky-100 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-sky-500 text-white shadow-sm">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">高密度全链路历史时序图表</span>
                <span className="text-[11px] text-slate-500">已接入本地 SQLite 千点时序引擎，支持 1H / 24H / 7D / 30D 毫秒级深钻分析</span>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('kuma-charts')}
              className="px-3.5 py-1.5 rounded-lg bg-white shadow-sm border border-sky-200 text-sky-700 hover:bg-sky-50 text-xs font-bold transition-all shrink-0"
            >
              打开千点图表 →
            </button>
          </div>
        </div>

        {/* Right 1 Col: Latency Hierarchy & Top Highlights */}
        <div className="lg:col-span-1 glass-panel rounded-2xl p-5 sm:p-6 shadow-subtle border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center space-x-2">
                <Globe className="h-4 w-4 text-emerald-600" />
                <span>全链路延迟阶梯速览</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">升序排行</span>
            </div>

            {/* Fast Top 2 summary pills */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-[10px] text-emerald-800 font-medium block">最优内网</span>
                <span className="font-bold text-xs text-slate-800 font-mono block truncate">{fastestMonitor?.name || '--'}</span>
                <span className="text-xs font-bold text-emerald-600 font-mono">{fastestMonitor?.pingMs || 0} ms</span>
              </div>

              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
                <span className="text-[10px] text-purple-800 font-medium block">跨国云端</span>
                <span className="font-bold text-xs text-slate-800 font-mono block truncate">{slowestMonitor?.name || '--'}</span>
                <span className="text-xs font-bold text-purple-600 font-mono">{slowestMonitor?.pingMs || 0} ms</span>
              </div>
            </div>

            {/* Latency Rank Bars */}
            <div className="space-y-2 font-mono text-xs">
              {sortedMonitors.slice(0, 5).map((m, idx) => {
                const maxVal = sortedMonitors[sortedMonitors.length - 1]?.pingMs || 350;
                const pct = Math.max(4, Math.min(100, ((m.pingMs || 0) / maxVal) * 100));

                return (
                  <div key={m.name}>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-slate-600 font-medium truncate max-w-[120px]">
                        <span className="text-slate-400 mr-1">#{idx + 1}</span>
                        {m.name}
                      </span>
                      <span className="font-bold text-slate-800">{m.pingMs} ms</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: m.color || '#3b82f6' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('kuma-charts')}
            className="w-full mt-4 py-2 text-center text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
          >
            查看完整链路排行与抖动统计
          </button>
        </div>
      </div>

      {/* 4. CLASSIFICATION 3: CLOUD VPS & BANDWIDTH QUOTA OVERVIEW (搬瓦工流量配额) */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-subtle border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <HardDriveDownload className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center space-x-2">
                <span>云厂商 VPS 与月度流量配额 (BandwagonHost KiwiVM)</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                  共计 {formatBytes(summary?.fleetMetrics?.bwhMonthlyBytes) || '800 GB'} 流量池
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                直接调用 KiwiVM 官方监控 API，实时监控月度流量消耗比例与重置周期
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('bwh')}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50/70 hover:bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 transition-all self-start sm:self-auto group"
          >
            <span>VPS 详细规格与端口 ({bwh.length})</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* 2 VPS Bandwidth Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bwh.map(vps => {
            const bw = vps.bandwidth || {};
            const usedPct = typeof bw.percent === 'number' 
              ? bw.percent 
              : (bw.totalBytes > 0 ? Number(((bw.usedBytes / bw.totalBytes) * 100).toFixed(1)) : 0);
            const pctColor = getPercentColor(usedPct);

            return (
              <div 
                key={vps.id}
                className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-800 block truncate">{vps.label}</span>
                      <span className="text-[11px] text-slate-400 block font-mono truncate">
                        {vps.datacenter} • {vps.ip}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap shrink-0">
                      {bw.daysUntilReset !== null && bw.daysUntilReset !== undefined 
                        ? `${bw.daysUntilReset} 天后重置` 
                        : (bw.nextResetDate ? new Date(bw.nextResetDate).toLocaleDateString() : '本月周期')}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between items-baseline mb-1 text-xs font-mono">
                      <span className="text-slate-500 font-sans">月度消耗</span>
                      <span className="font-bold text-slate-800">
                        {formatBytes(bw.usedBytes)} / {formatBytes(bw.totalBytes)}
                        <span className={`ml-1.5 font-bold ${pctColor.text}`}>({usedPct}%)</span>
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${pctColor.bg}`}
                        style={{ width: `${Math.min(100, Math.max(0, usedPct))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>剩余可用: <strong className="text-slate-600 font-semibold">{formatBytes(bw.remainingBytes)}</strong></span>
                  <span>SSH: :{vps.sshPort || 22}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
