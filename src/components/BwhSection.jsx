import React from 'react';
import { 
  HardDriveDownload, 
  MapPin, 
  Calendar, 
  Clock, 
  Server, 
  Cpu, 
  Database, 
  ShieldCheck, 
  ExternalLink,
  Terminal
} from 'lucide-react';
import { formatBytes, getPercentColor } from '../utils/format';

export default function BwhSection({ bwhInstances }) {
  if (!bwhInstances || bwhInstances.length === 0) return null;

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-subtle border border-slate-200/80 mb-6">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 mb-5">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <HardDriveDownload className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              搬瓦工 (KiwiVM) VPS 流量与配额监控
            </h2>
            <p className="text-xs text-slate-500">
              实时对接 KiwiVM 官方 API，精准把控每月流量周期、结余与重置倒计时
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono bg-slate-100/80 px-3 py-1 rounded-lg">
          API 接入: {bwhInstances.length} 台实例
        </div>
      </div>

      {/* Instance Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {bwhInstances.map((vps, idx) => {
          const bw = vps.bandwidth || { percent: 0, usedBytes: 0, totalBytes: 0 };
          const bwColor = getPercentColor(bw.percent);
          const disk = vps.disk || { percent: 0, usedBytes: 0, totalBytes: 0 };
          const diskColor = getPercentColor(disk.percent);

          return (
            <div 
              key={idx}
              className="bg-white/95 rounded-xl border border-slate-200/90 p-5 shadow-subtle hover:shadow-card transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                {/* VPS Top bar */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                      <h3 className="font-bold text-slate-800 text-sm">{vps.label}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                        VEID: {vps.veid}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{vps.datacenter}</span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                    {vps.status || 'Running'}
                  </span>
                </div>

                {/* Network / IP info badge */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between text-xs font-mono mb-4">
                  <div className="flex items-center space-x-1.5 text-slate-600">
                    <Terminal className="h-3.5 w-3.5 text-slate-400" />
                    <span>IP: {vps.ip || '67.230.175.37'}</span>
                  </div>
                  {vps.sshPort && (
                    <span className="text-slate-500">SSH 端口: {vps.sshPort}</span>
                  )}
                  <span className="text-slate-400 truncate max-w-[120px]">{vps.plan}</span>
                </div>

                {/* Bandwidth Progress Meter (Key Feature!) */}
                <div className="mb-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 p-3.5 rounded-xl border border-indigo-100/60">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                      <HardDriveDownload className="h-4 w-4 text-indigo-500" />
                      <span>当月流量配额消耗</span>
                    </span>
                    <span className={`font-mono font-bold text-sm ${bwColor.text}`}>
                      {bw.percent}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden mb-2">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r from-sky-500 to-indigo-600`}
                      style={{ width: `${Math.min(100, Math.max(0, bw.percent))}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-slate-500 font-mono">
                    <span>已用: <strong className="text-slate-700">{formatBytes(bw.usedBytes)}</strong></span>
                    <span>剩余: <strong className="text-emerald-600">{formatBytes(bw.remainingBytes)}</strong></span>
                    <span>总量: <strong className="text-slate-700">{formatBytes(bw.totalBytes)}</strong></span>
                  </div>
                </div>

                {/* Disk & Specs mini row */}
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex justify-between items-center text-slate-500 mb-1">
                      <span>磁盘占用</span>
                      <span className={`font-mono font-semibold ${diskColor.text}`}>{disk.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1 mb-1">
                      <div className={`h-full rounded-full ${diskColor.bg}`} style={{ width: `${disk.percent}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {formatBytes(disk.usedBytes)} / {disk.totalQuotaGb || 10} GB
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex justify-between items-center text-slate-500 mb-1">
                      <span>负载负荷</span>
                      <span className="font-mono font-semibold text-slate-700">{vps.loadAverage?.split(' ').slice(0, 3).join(' ') || '0.05'}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1 mb-1">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: '15%' }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      架构: {vps.vmType?.toUpperCase() || 'KVM'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Reset date countdown pill */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-1.5">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  <span>流量重置日:</span>
                  <span className="font-mono font-medium text-slate-700">
                    {bw.nextResetDate ? new Date(bw.nextResetDate).toLocaleDateString() : '每周期结算'}
                  </span>
                </div>

                {bw.daysUntilReset !== null && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                    剩余 {bw.daysUntilReset} 天
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
