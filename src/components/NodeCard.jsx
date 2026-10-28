import React from 'react';
import { 
  Cpu, 
  Database, 
  HardDrive, 
  ArrowDown, 
  ArrowUp, 
  Clock, 
  Box, 
  ChevronRight, 
  AlertCircle,
  Wifi,
  ExternalLink
} from 'lucide-react';
import { formatBytes, formatSpeed, getPercentColor, getLatencyBadge } from '../utils/format';

export default function NodeCard({ node, onOpenDetails }) {
  const isOnline = node.online;
  const cpuPercent = node.cpu?.percent || 0;
  const memPercent = node.memory?.percent || 0;
  
  // Primary disk (usually root / or first disk)
  const primaryDisk = node.disks?.[0] || { percent: 0, usedBytes: 0, totalBytes: 0 };
  const diskPercent = primaryDisk.percent || 0;

  const cpuColor = getPercentColor(cpuPercent);
  const memColor = getPercentColor(memPercent);
  const diskColor = getPercentColor(diskPercent);
  const latency = getLatencyBadge(node.latencyMs);

  // Tag styling
  const tagColor = node.tag === 'LAN' 
    ? 'bg-blue-50 text-blue-700 border-blue-200' 
    : (node.tag === 'Cloud' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200');

  return (
    <div className={`glass-panel rounded-xl p-5 shadow-subtle hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 border flex flex-col justify-between ${
      isOnline ? 'border-slate-200/80 bg-white/80' : 'border-rose-200/80 bg-rose-50/20'
    }`}>
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500'}`} />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-slate-800 text-sm tracking-tight">{node.label}</h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${tagColor}`}>
                  {node.tag}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">
                {node.system?.hostname || node.url.replace(/^http:\/\//, '')}
              </p>
            </div>
          </div>

          {/* Latency Badge */}
          <div className="flex items-center space-x-1.5">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${latency.color}`}>
              {latency.text}
            </span>
          </div>
        </div>

        {/* Offline notice */}
        {!isOnline ? (
          <div className="my-6 p-4 rounded-lg bg-rose-50/80 border border-rose-200/80 text-rose-700 flex items-center space-x-3 text-xs">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="font-medium">无法建立连接</p>
              <p className="text-[11px] text-rose-600/80 mt-0.5">{node.error || '节点连接超时，请检查服务状态'}</p>
            </div>
          </div>
        ) : (
          /* Metrics Grid */
          <div className="space-y-3.5 my-3">
            {/* CPU Metric */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="flex items-center text-slate-500 font-medium space-x-1.5">
                  <Cpu className="h-3.5 w-3.5 text-slate-400" />
                  <span>CPU 负载</span>
                  <span className="text-[11px] text-slate-400 font-mono font-normal">
                    ({node.cpu?.logicalCores || 1}核)
                  </span>
                </span>
                <span className={`font-mono font-semibold ${cpuColor.text}`}>
                  {cpuPercent}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${cpuColor.bg}`}
                  style={{ width: `${Math.min(100, Math.max(0, cpuPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                <span>Load: {node.cpu?.loadAvg?.join(', ') || '0, 0, 0'}</span>
                {node.cpu?.frequencyMhz && (
                  <span>{node.cpu.frequencyMhz} MHz</span>
                )}
              </div>
            </div>

            {/* Memory Metric */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="flex items-center text-slate-500 font-medium space-x-1.5">
                  <Database className="h-3.5 w-3.5 text-slate-400" />
                  <span>内存占用</span>
                </span>
                <span className={`font-mono font-semibold ${memColor.text}`}>
                  {memPercent}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${memColor.bg}`}
                  style={{ width: `${Math.min(100, Math.max(0, memPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                <span>已用: {formatBytes(node.memory?.usedBytes)}</span>
                <span>总量: {formatBytes(node.memory?.totalBytes)}</span>
              </div>
            </div>

            {/* Primary Disk Metric */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="flex items-center text-slate-500 font-medium space-x-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                  <span>磁盘空间 ({primaryDisk.mount})</span>
                </span>
                <span className={`font-mono font-semibold ${diskColor.text}`}>
                  {diskPercent}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${diskColor.bg}`}
                  style={{ width: `${Math.min(100, Math.max(0, diskPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                <span>已用: {formatBytes(primaryDisk.usedBytes)}</span>
                <span>总量: {formatBytes(primaryDisk.totalBytes)}</span>
              </div>
            </div>

            {/* Real-time Network Speed & Containers Badge */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-600">
                <span className="flex items-center space-x-0.5 text-emerald-600">
                  <ArrowDown className="h-3 w-3" />
                  <span>{formatSpeed(node.network?.totalRxRate)}</span>
                </span>
                <span className="flex items-center space-x-0.5 text-sky-600">
                  <ArrowUp className="h-3 w-3" />
                  <span>{formatSpeed(node.network?.totalTxRate)}</span>
                </span>
              </div>

              {node.containers?.length > 0 && (
                <span className="inline-flex items-center space-x-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  <Box className="h-3 w-3 text-slate-500" />
                  <span>{node.containers.length} 容器</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info & Action */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-1 truncate max-w-[170px]" title={`运行时间: ${node.system?.uptime}`}>
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate text-[11px]">{node.system?.uptime || '未知'}</span>
        </div>

        <button
          onClick={() => onOpenDetails(node)}
          className="inline-flex items-center space-x-1 text-sky-600 hover:text-sky-700 text-xs font-medium hover:underline cursor-pointer group"
        >
          <span>详情面板</span>
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
