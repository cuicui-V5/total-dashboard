import React, { useEffect } from 'react';
import { 
  X, 
  Server, 
  Cpu, 
  Database, 
  HardDrive, 
  Wifi, 
  Box, 
  Layers, 
  Activity, 
  Clock, 
  Info,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { formatBytes, formatSpeed, getPercentColor } from '../utils/format';

export default function NodeDetailModal({ node, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!node) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-800 text-base">{node.label}</h3>
                <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-100 text-slate-600 border border-slate-200">
                  {node.tag}
                </span>
                <span className={`h-2 w-2 rounded-full ${node.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {node.system?.hostname} • {node.url}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          
          {/* Quick specs grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-400 block mb-0.5">操作系统</span>
              <span className="font-semibold text-slate-700">{node.system?.osName || 'Linux'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">CPU 规格</span>
              <span className="font-semibold text-slate-700 truncate block" title={node.cpu?.name}>
                {node.cpu?.cores}核 / {node.cpu?.logicalCores}线程
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">系统负载 (1/5/15m)</span>
              <span className="font-mono font-semibold text-slate-700">
                {node.cpu?.loadAvg?.join(', ') || '0, 0, 0'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">运行时间</span>
              <span className="font-semibold text-slate-700">{node.system?.uptime || '未知'}</span>
            </div>
          </div>

          {/* Filesystem Disks Breakdown */}
          <div>
            <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center space-x-1.5">
              <HardDrive className="h-4 w-4 text-sky-500" />
              <span>磁盘分区与挂载点 ({node.disks?.length || 0})</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {node.disks?.map((disk, idx) => {
                const color = getPercentColor(disk.percent);
                return (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-slate-700 font-mono">{disk.mount}</span>
                      <span className={`font-mono font-semibold ${color.text}`}>{disk.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mb-1.5">
                      <div className={`h-full rounded-full ${color.bg}`} style={{ width: `${disk.percent}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>已用: {formatBytes(disk.usedBytes)}</span>
                      <span>可用: {formatBytes(disk.freeBytes)}</span>
                      <span>总计: {formatBytes(disk.totalBytes)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Running Processes */}
          {node.processes?.topList?.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center space-x-1.5">
                <Activity className="h-4 w-4 text-indigo-500" />
                <span>活跃进程列表 (Top {node.processes.topList.length}，总计 {node.processes.total})</span>
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                    <tr>
                      <th className="py-2 px-3">PID</th>
                      <th className="py-2 px-3">进程名</th>
                      <th className="py-2 px-3">用户</th>
                      <th className="py-2 px-3 text-right">CPU %</th>
                      <th className="py-2 px-3 text-right">内存 %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {node.processes.topList.map((proc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-1.5 px-3 text-slate-400">{proc.pid}</td>
                        <td className="py-1.5 px-3 font-medium text-slate-700">{proc.name}</td>
                        <td className="py-1.5 px-3 text-slate-500">{proc.username}</td>
                        <td className="py-1.5 px-3 text-right text-sky-600 font-semibold">{proc.cpuPercent}%</td>
                        <td className="py-1.5 px-3 text-right text-indigo-600 font-semibold">{proc.memPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Docker Containers if present */}
          {node.containers?.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center space-x-1.5">
                <Box className="h-4 w-4 text-emerald-500" />
                <span>Docker 容器状态 ({node.containers.length})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {node.containers.map((c, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-medium text-slate-800">{c.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono truncate block max-w-[220px] mt-0.5">
                        {c.image}
                      </span>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Network Interfaces */}
          {node.network?.interfaces?.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center space-x-1.5">
                <Wifi className="h-4 w-4 text-violet-500" />
                <span>网卡网络接口与实时速率</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {node.network.interfaces.map((net, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 flex justify-between items-center font-mono">
                    <div>
                      <span className="font-semibold text-slate-700 text-xs block">{net.name}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        总收: {formatBytes(net.cumulativeRxBytes)} • 总发: {formatBytes(net.cumulativeTxBytes)}
                      </span>
                    </div>
                    <div className="text-right text-[11px]">
                      <div className="text-emerald-600 flex items-center justify-end space-x-0.5">
                        <ArrowDown className="h-3 w-3" />
                        <span>{formatSpeed(net.rxSpeedBytes)}</span>
                      </div>
                      <div className="text-sky-600 flex items-center justify-end space-x-0.5">
                        <ArrowUp className="h-3 w-3" />
                        <span>{formatSpeed(net.txSpeedBytes)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors shadow-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
