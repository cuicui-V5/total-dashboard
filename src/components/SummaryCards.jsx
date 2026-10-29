import React from 'react';
import { 
  Server, 
  Cpu, 
  Database, 
  ArrowDownUp, 
  Activity, 
  HardDriveDownload,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { formatBytes, formatSpeed, getPercentColor } from '../utils/format';

export default function SummaryCards({ summary }) {
  if (!summary) return null;

  const { fleetNodes, kuma, fleetMetrics } = summary;
  const cpuColor = getPercentColor(fleetMetrics?.avgCpuPercent || 0);
  const memColor = getPercentColor(fleetMetrics?.avgMemoryPercent || 0);
  const bwhColor = getPercentColor(fleetMetrics?.bwhUsagePercent || 0);

  const cards = [
    {
      title: '设备集群状态',
      value: `${fleetNodes?.online || 0} / ${fleetNodes?.total || 0}`,
      unit: '在线',
      subtext: fleetNodes?.healthy ? '所有节点运行正常' : '部分节点异常离线',
      icon: Server,
      iconColor: fleetNodes?.healthy ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50',
      badge: fleetNodes?.healthy ? '健康' : '告警',
      badgeClass: fleetNodes?.healthy ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      title: '集群平均 CPU',
      value: `${fleetMetrics?.avgCpuPercent || 0}`,
      unit: '%',
      subtext: '五台设备平均负载',
      icon: Cpu,
      iconColor: `${cpuColor.text} ${cpuColor.lightBg}`,
      progress: fleetMetrics?.avgCpuPercent || 0,
      progressBarClass: cpuColor.bg,
    },
    {
      title: '集群平均内存',
      value: `${fleetMetrics?.avgMemoryPercent || 0}`,
      unit: '%',
      subtext: '五台设备平均占用',
      icon: Database,
      iconColor: `${memColor.text} ${memColor.lightBg}`,
      progress: fleetMetrics?.avgMemoryPercent || 0,
      progressBarClass: memColor.bg,
    },
    {
      title: '全链路平均延迟',
      value: `${fleetMetrics?.avgPingMs || 0}`,
      unit: 'ms',
      subtext: `${kuma?.total || 7} 个监测点实时综合均值`,
      icon: Activity,
      iconColor: 'text-violet-600 bg-violet-50',
      badge: '实时响应',
      badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    },
    {
      title: 'Uptime 链路可用率',
      value: `${kuma?.healthPercent || 0}`,
      unit: '%',
      subtext: `${kuma?.up || 0}/${kuma?.total || 0} 服务正常运行`,
      icon: Activity,
      iconColor: 'text-sky-600 bg-sky-50',
      progress: kuma?.healthPercent || 0,
      progressBarClass: kuma?.healthPercent > 95 ? 'bg-emerald-500' : 'bg-amber-500',
    },
    {
      title: '搬瓦工总流量消耗',
      value: `${fleetMetrics?.bwhUsagePercent || 0}`,
      unit: '%',
      subtext: `${formatBytes(fleetMetrics?.bwhUsedBytes)} / ${formatBytes(fleetMetrics?.bwhMonthlyBytes)}`,
      icon: HardDriveDownload,
      iconColor: `${bwhColor.text} ${bwhColor.lightBg}`,
      progress: fleetMetrics?.bwhUsagePercent || 0,
      progressBarClass: bwhColor.bg,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div 
            key={index}
            className="glass-panel p-4 rounded-xl shadow-subtle hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between border border-slate-200/80"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 tracking-tight">{card.title}</span>
                <div className={`p-1.5 rounded-lg ${card.iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-bold tracking-tight text-slate-800 font-mono">
                  {card.value}
                </span>
                {card.unit && (
                  <span className="text-xs font-medium text-slate-500">{card.unit}</span>
                )}
                {card.badge && (
                  <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full border ${card.badgeClass}`}>
                    {card.badge}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100">
              {card.progress !== undefined ? (
                <div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-1.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${card.progressBarClass}`}
                      style={{ width: `${Math.min(100, Math.max(0, card.progress))}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 truncate block">{card.subtext}</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 truncate block">{card.subtext}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
