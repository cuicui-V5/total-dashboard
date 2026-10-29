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
  ExternalLink,
  WifiOff
} from 'lucide-react';
import { formatBytes, formatSpeed, getPercentColor, getLatencyBadge } from '../utils/format';

export default function NodeCard({ node, onOpenDetails }) {
  const isOnline = node.online;
  const cpuPercent = node.cpu?.percent || 0;
  const memPercent = node.memory?.percent || 0;
  
  const primaryDisk = node.disks?.[0] || { percent: 0, usedBytes: 0, totalBytes: 0, mount: '/' };
  const diskPercent = primaryDisk.percent || 0;

  const cpuColor = getPercentColor(cpuPercent);
  const memColor = getPercentColor(memPercent);
  const diskColor = getPercentColor(diskPercent);
  const latency = getLatencyBadge(node.latencyMs);

  const tagColor = node.tag === 'LAN' 
    ? 'bg-blue-50 text-blue-700 border-blue-200' 
    : (node.tag === 'Cloud' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200');

  return (
    <div className={`glass-panel rounded-xl p-5 shadow-subtle hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 border flex flex-col justify-between ${
      isOnline 
        ? 'border-slate-200/80 bg-white/80' 
        : 'border-amber-200/90 bg-amber-50/20'
    }`}>
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${
              isOnline 
                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' 
                : 'bg-amber-500 shadow-sm shadow-amber-500/30'
            }`} />
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

          {/* Latency / State Badge */}
          <div className="flex items-center space-x-1.5">
            {isOnline ? (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${latency.color}`}>
                {latency.text}
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                网络重试中
              </span>
            )}
          </div>
        </div>

        {/* Offline Notice banner if offline */}
        {!isOnline && (
          <div className="mb-3 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-amber-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-[11px] font-medium">{node.error || '网络延迟过高 (请求超时)'}</span>
            </div>
            {node.lastSeen && (
              <span className="text-[10px] text-amber-600 font-mono">
                {new Date(node.lastSeen).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}

        {/* Metrics Grid */}
        <div className={`space-y-3.5 my-3 ${!isOnline ? 'opacity-60' : ''}`}>
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
              <span className={`font-mono font-semibold ${isOnline ? cpuColor.text : 'text-slate-500'}`}>
                {cpuPercent}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${isOnline ? cpuColor.bg : 'bg-slate-300'}`}
                style={{ width: `${Math.min(100, Math.max(0, cpuPercent))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
              <span>
                Load: {node.cpu?.loadAvg?.[1] ? node.cpu.loadAvg.join(', ') : (node.cpu?.loadAvg?.[0] || '0.0')}
              </span>
              {node.cpu?.frequencyMhz ? (
                <span>{node.cpu.frequencyMhz} MHz</span>
              ) : (
                <span>{node.system?.osName || 'Linux'}</span>
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
              <span className={`font-mono font-semibold ${isOnline ? memColor.text : 'text-slate-500'}`}>
                {memPercent}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${isOnline ? memColor.bg : 'bg-slate-300'}`}
                style={{ width: `${Math.min(100, Math.max(0, memPercent))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
              {node.memory?.totalBytes > 0 ? (
                <>
                  <span>已用: {formatBytes(node.memory?.usedBytes)}</span>
                  <span>总量: {formatBytes(node.memory?.totalBytes)}</span>
                </>
              ) : (
                <>
                  <span>RAM 实时占用: {memPercent}%</span>
                  <span className="text-slate-400">详细容量点击全量</span>
                </>
              )}
            </div>
          </div>

          {/* Disk or Swap Metric */}
          {primaryDisk && primaryDisk.totalBytes > 0 ? (
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="flex items-center text-slate-500 font-medium space-x-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                  <span>磁盘空间 ({primaryDisk.mount})</span>
                </span>
                <span className={`font-mono font-semibold ${isOnline ? diskColor.text : 'text-slate-500'}`}>
                  {diskPercent}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${isOnline ? diskColor.bg : 'bg-slate-300'}`}
                  style={{ width: `${Math.min(100, Math.max(0, diskPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                <span>已用: {formatBytes(primaryDisk.usedBytes)}</span>
                <span>总量: {formatBytes(primaryDisk.totalBytes)}</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="flex items-center text-slate-500 font-medium space-x-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                  <span>Swap 交换分区</span>
                </span>
                <span className={`font-mono font-semibold ${isOnline ? getPercentColor(node.swap?.percent || 0).text : 'text-slate-500'}`}>
                  {node.swap?.percent || 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${isOnline ? getPercentColor(node.swap?.percent || 0).bg : 'bg-slate-300'}`}
                  style={{ width: `${Math.min(100, Math.max(0, node.swap?.percent || 0))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                <span className="truncate max-w-[170px]">{node.cpu?.name || 'CPU'}</span>
                <span>{node.cpu?.logicalCores || 1} 逻辑核心</span>
              </div>
            </div>
          )}

          {/* Quick Stats Footnote */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-600">
              <span className="text-slate-500">
                系统负载: <strong className="text-slate-700 font-semibold">{node.cpu?.loadAvg?.[0] || '0.0'}</strong>
              </span>
              {node.cpu?.frequencyMhz && (
                <span className="text-slate-400">
                  {node.cpu.frequencyMhz} MHz
                </span>
              )}
            </div>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
              轻量快照
            </span>
          </div>
        </div>
      </div>

      {/* Footer Info & Action */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-1 truncate max-w-[150px]" title={`运行时间: ${node.system?.uptime}`}>
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate text-[11px]">{node.system?.uptime || (isOnline ? '正常' : '重连中')}</span>
        </div>

        <button
          onClick={() => onOpenDetails(node)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-50/80 hover:bg-sky-100 text-sky-700 text-xs font-semibold transition-all shadow-xs group border border-sky-200/70"
        >
          <span>查看完整详情</span>
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
