import React from 'react';
import { 
  Activity, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Globe, 
  Radio, 
  CheckCircle2, 
  XCircle,
  ExternalLink
} from 'lucide-react';
import { getLatencyBadge } from '../utils/format';

export default function KumaSection({ kuma }) {
  if (!kuma) return null;

  const monitors = kuma.monitors || [];

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-subtle border border-slate-200/80 mb-6">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 mb-5">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              Uptime Kuma 链路与服务健康监控
            </h2>
            <p className="text-xs text-slate-500">
              实时监测公网 VPS、本地路由、DNS 与核心网站在线可用率
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>正常: {kuma.upCount}</span>
          </span>
          {kuma.downCount > 0 && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
              <XCircle className="h-3.5 w-3.5" />
              <span>异常: {kuma.downCount}</span>
            </span>
          )}
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            可用率 {kuma.healthPercent}%
          </span>
        </div>
      </div>

      {/* Monitors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {monitors.map((mon, idx) => {
          const isUp = mon.status === 'up';
          const latency = getLatencyBadge(mon.pingMs);

          return (
            <div 
              key={idx}
              className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                isUp 
                  ? 'bg-white/90 border-slate-200/80 hover:border-slate-300 hover:shadow-sm' 
                  : 'bg-rose-50/50 border-rose-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${isUp ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500'}`} />
                    <span className="font-semibold text-slate-800 text-sm">{mon.name}</span>
                  </div>

                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                    mon.type === 'http' 
                      ? 'bg-purple-50 text-purple-700 border-purple-200' 
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {mon.type}
                  </span>
                </div>

                <p className="text-xs text-slate-400 font-mono truncate mb-3">
                  {mon.hostname || mon.url || '--'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                {/* Ping latency */}
                <div className="flex items-center space-x-1.5">
                  <Clock className="h-3 w-3 text-slate-400" />
                  <span className="text-[11px] text-slate-500 font-medium">响应延迟:</span>
                  <span className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded border ${latency.color}`}>
                    {latency.text}
                  </span>
                </div>

                {/* SSL info if available */}
                {mon.certDaysRemaining !== null ? (
                  <div 
                    className="flex items-center space-x-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono"
                    title={`SSL 证书有效期: 剩余 ${mon.certDaysRemaining} 天`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    <span>SSL {mon.certDaysRemaining}d</span>
                  </div>
                ) : (
                  <span className={`text-[10px] font-medium font-mono ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isUp ? 'ACTIVE' : 'DOWN'}
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
