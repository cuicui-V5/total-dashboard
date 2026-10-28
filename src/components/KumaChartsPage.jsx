import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Globe, 
  Layers, 
  SlidersHorizontal,
  ChevronDown,
  Calendar,
  RefreshCw,
  Info
} from 'lucide-react';
import { getLatencyBadge } from '../utils/format';

export default function KumaChartsPage({ kuma }) {
  const defaultMonitors = kuma?.monitors || [];
  const defaultTimeline = kuma?.timeline || [];

  // Time Range Selection ('1h' | '24h' | '7d' | '30d')
  const [selectedRange, setSelectedRange] = useState('24h');
  const [rangeData, setRangeData] = useState(null);
  const [isRangeLoading, setIsRangeLoading] = useState(false);

  // Fetch range data from /api/kuma/history
  useEffect(() => {
    let isCancelled = false;
    const fetchHistory = async () => {
      setIsRangeLoading(true);
      try {
        const res = await axios.get(`/api/kuma/history?range=${selectedRange}`);
        if (!isCancelled && res.data && res.data.timeline) {
          setRangeData(res.data);
        }
      } catch (err) {
        console.warn('Failed to fetch range history:', err);
      } finally {
        if (!isCancelled) setIsRangeLoading(false);
      }
    };

    fetchHistory();
    return () => { isCancelled = true; };
  }, [selectedRange]);

  // Active monitors & timeline based on selected range
  const monitors = (rangeData && rangeData.monitors?.length > 0) ? rangeData.monitors : defaultMonitors;
  const timeline = (rangeData && rangeData.timeline?.length > 0) ? rangeData.timeline : defaultTimeline;

  // Track which monitor lines are visible on the chart
  const [visibleMonitors, setVisibleMonitors] = useState(() => {
    const initial = {};
    defaultMonitors.forEach(m => { initial[m.name] = true; });
    return initial;
  });

  // Ensure any new monitor from range query is visible by default
  useEffect(() => {
    if (monitors.length > 0) {
      setVisibleMonitors(prev => {
        const next = { ...prev };
        monitors.forEach(m => {
          if (next[m.name] === undefined) next[m.name] = true;
        });
        return next;
      });
    }
  }, [monitors]);

  // Hover state for interactive chart crosshair
  const [hoverIndex, setHoverIndex] = useState(null);

  // Toggle monitor visibility
  const toggleMonitor = (name) => {
    setVisibleMonitors(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const selectAll = () => {
    const updated = {};
    monitors.forEach(m => { updated[m.name] = true; });
    setVisibleMonitors(updated);
  };

  const selectDomestic = () => {
    const updated = {};
    monitors.forEach(m => {
      updated[m.name] = ['ERX', '百度', '山东联通dns'].includes(m.name);
    });
    setVisibleMonitors(updated);
  };

  const selectOverseas = () => {
    const updated = {};
    monitors.forEach(m => {
      updated[m.name] = ['搬瓦工1', '搬瓦工2', '甲骨文1', '甲骨文2'].includes(m.name);
    });
    setVisibleMonitors(updated);
  };

  // Compute fleet-level stats
  const fleetStats = useMemo(() => {
    if (monitors.length === 0) return { fastest: null, slowest: null, avgPing: 0, avgUptime: 100, avgJitter: 0 };

    let fastest = monitors[0];
    let slowest = monitors[0];
    let totalPing = 0;
    let totalUptime = 0;
    let totalJitter = 0;
    let validPingCount = 0;

    monitors.forEach(m => {
      const ping = m.stats?.avgPing ?? m.pingMs ?? 0;
      if (ping > 0) {
        if (!fastest.stats?.avgPing || ping < (fastest.stats?.avgPing ?? fastest.pingMs ?? 9999)) fastest = m;
        if (!slowest.stats?.avgPing || ping > (slowest.stats?.avgPing ?? slowest.pingMs ?? 0)) slowest = m;
        totalPing += ping;
        validPingCount++;
      }
      totalUptime += (m.uptime || m.uptime24h || 100);
      totalJitter += (m.stats?.jitter || 0);
    });

    return {
      fastest,
      slowest,
      avgPing: validPingCount > 0 ? Number((totalPing / validPingCount).toFixed(1)) : 0,
      avgUptime: Number((totalUptime / monitors.length).toFixed(2)),
      avgJitter: Number((totalJitter / monitors.length).toFixed(1))
    };
  }, [monitors]);

  // Ranking sorted by average ping (lowest to highest)
  const rankedMonitors = useMemo(() => {
    return [...monitors].sort((a, b) => {
      const pingA = a.stats?.avgPing ?? a.pingMs ?? 9999;
      const pingB = b.stats?.avgPing ?? b.pingMs ?? 9999;
      return pingA - pingB;
    });
  }, [monitors]);

  // SVG Chart Dimensions
  const chartWidth = 900;
  const chartHeight = 320;
  const padding = { top: 20, right: 30, bottom: 40, left: 55 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Calculate Max Y for chart based on visible monitors
  const maxY = useMemo(() => {
    let max = 50;
    timeline.forEach(point => {
      monitors.forEach(m => {
        if (visibleMonitors[m.name]) {
          const val = point[m.name];
          if (typeof val === 'number' && val > max) max = val;
        }
      });
    });
    return Math.ceil((max * 1.15) / 50) * 50 || 100;
  }, [timeline, monitors, visibleMonitors]);

  // Generate SVG path for a specific monitor
  const getMonitorPath = (monName) => {
    if (timeline.length === 0) return '';
    const points = timeline.map((pt, i) => {
      const x = padding.left + (i / Math.max(1, timeline.length - 1)) * innerWidth;
      const val = pt[monName] ?? 0;
      const y = padding.top + innerHeight - (Math.min(val, maxY) / maxY) * innerHeight;
      return { x, y };
    });

    return points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }, '');
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => Math.round(maxY * ratio));

  const timeRanges = [
    { id: '1h', label: '最近 1 小时', desc: '原始秒级无损采样' },
    { id: '24h', label: '过去 24 小时', desc: '1分钟高密 (~1440点)' },
    { id: '7d', label: '过去 7 天', desc: '10分钟高密 (~1000点)' },
    { id: '30d', label: '过去 30 天', desc: '半小时高密 (~1440点)' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Page Header */}
      <div className="glass-panel rounded-2xl p-6 shadow-subtle border border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                  Uptime Kuma 链路延迟与历史分析
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                  {timeRanges.find(r => r.id === selectedRange)?.desc || '历史时序'}
                </span>
                {isRangeLoading && (
                  <RefreshCw className="h-3 w-3 animate-spin text-sky-500" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                实时对比局域网设备、国内核心网站与海外云主机的 Ping 响应延迟、网络抖动与长效可用率
              </p>
            </div>
          </div>

          {/* Time Range Selector Tabs */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 shadow-inner">
            {timeRanges.map(r => {
              const isSelected = selectedRange === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRange(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-white text-sky-700 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Top 4 KPI Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-sm">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-emerald-800 block">最优响应链路</span>
              <span className="text-base font-bold text-slate-800 font-mono">
                {fleetStats.fastest?.name || '--'}
              </span>
              <span className="text-[11px] text-emerald-700 font-mono block">
                {fleetStats.fastest?.stats?.avgPing ?? fleetStats.fastest?.pingMs ?? 0} ms
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-500 text-white shadow-sm">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-purple-800 block">跨国云端响应</span>
              <span className="text-base font-bold text-slate-800 font-mono">
                {fleetStats.slowest?.name || '--'}
              </span>
              <span className="text-[11px] text-purple-700 font-mono block">
                {fleetStats.slowest?.stats?.avgPing ?? fleetStats.slowest?.pingMs ?? 0} ms
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-100 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-sky-500 text-white shadow-sm">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-sky-800 block">{selectedRange.toUpperCase()} 周期平均延迟</span>
              <span className="text-base font-bold text-slate-800 font-mono">
                {fleetStats.avgPing} ms
              </span>
              <span className="text-[11px] text-sky-600 font-mono block">
                抖动 ±{fleetStats.avgJitter} ms
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500 text-white shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-indigo-800 block">{selectedRange.toUpperCase()} 综合可用率</span>
              <span className="text-base font-bold text-slate-800 font-mono">
                {fleetStats.avgUptime}%
              </span>
              <span className="text-[11px] text-indigo-600 block">
                7 个监测点持续健康
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Multi-line Latency Trend Chart */}
      <div className="glass-panel rounded-2xl p-6 shadow-subtle border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <Activity className="h-4 w-4 text-sky-600" />
              <span>全链路延迟趋势对比 ({selectedRange.toUpperCase()} 周期 · 采样 {timeline.length} 点)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
                {rangeData?.isRaw ? '原始数据' : (rangeData?.stepSec ? `${rangeData.stepSec >= 60 ? Math.round(rangeData.stepSec / 60) + 'm' : rangeData.stepSec + 's'}/点` : '')}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              高密度网格对齐，全链路连续追踪，点击下方标签可显示/隐藏特定链路，悬浮可精准查看各采样点详细延迟数值
            </p>
          </div>

          {/* Quick preset filters */}
          <div className="flex items-center space-x-1.5 text-xs">
            <button
              onClick={selectAll}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
            >
              全选
            </button>
            <button
              onClick={selectDomestic}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
            >
              只看内网/国内
            </button>
            <button
              onClick={selectOverseas}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
            >
              只看海外 VPS
            </button>
          </div>
        </div>

        {/* Legend / Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {monitors.map(m => {
            const isVisible = visibleMonitors[m.name];
            return (
              <button
                key={m.name}
                onClick={() => toggleMonitor(m.name)}
                className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium transition-all border ${
                  isVisible
                    ? 'bg-white shadow-sm border-slate-300 text-slate-800'
                    : 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60 line-through'
                }`}
              >
                <span 
                  className="h-2.5 w-2.5 rounded-full" 
                  style={{ backgroundColor: isVisible ? m.color : '#94a3b8' }} 
                />
                <span>{m.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({m.stats?.avgPing ?? m.pingMs ?? 0}ms)
                </span>
              </button>
            );
          })}
        </div>

        {/* SVG Multi-Line Chart */}
        <div className="relative w-full overflow-x-auto">
          <svg 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
            className="w-full h-auto min-w-[650px] overflow-visible"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Grid Lines & Y-axis labels */}
            {yTicks.map((val, idx) => {
              const y = padding.top + innerHeight - (val / maxY) * innerHeight;
              return (
                <g key={idx}>
                  <line 
                    x1={padding.left} 
                    y1={y} 
                    x2={padding.left + innerWidth} 
                    y2={y} 
                    stroke="#f1f5f9" 
                    strokeWidth="1" 
                    strokeDasharray={idx === 0 ? "none" : "3,3"} 
                  />
                  <text 
                    x={padding.left - 10} 
                    y={y + 3} 
                    textAnchor="end" 
                    className="text-[10px] font-mono fill-slate-400"
                  >
                    {val}ms
                  </text>
                </g>
              );
            })}

            {/* X-axis time marks */}
            {timeline.filter((_, idx) => idx % Math.max(1, Math.floor(timeline.length / 6)) === 0).map((pt, idx) => {
              const pointIndex = timeline.indexOf(pt);
              const x = padding.left + (pointIndex / Math.max(1, timeline.length - 1)) * innerWidth;
              return (
                <g key={idx}>
                  <line 
                    x1={x} 
                    y1={padding.top + innerHeight} 
                    x2={x} 
                    y2={padding.top + innerHeight + 4} 
                    stroke="#cbd5e1" 
                    strokeWidth="1" 
                  />
                  <text 
                    x={x} 
                    y={padding.top + innerHeight + 16} 
                    textAnchor="middle" 
                    className="text-[10px] font-mono fill-slate-400"
                  >
                    {pt.label}
                  </text>
                </g>
              );
            })}

            {/* Monitor Paths */}
            {monitors.map(m => {
              if (!visibleMonitors[m.name]) return null;
              const pathD = getMonitorPath(m.name);
              return (
                <path
                  key={m.name}
                  d={pathD}
                  fill="none"
                  stroke={m.color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300 opacity-90 hover:opacity-100"
                />
              );
            })}

            {/* Hover Crosshair & Dots */}
            {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < timeline.length && (() => {
              const hoverX = padding.left + (hoverIndex / Math.max(1, timeline.length - 1)) * innerWidth;
              const point = timeline[hoverIndex];

              return (
                <g>
                  {/* Vertical Guide Line */}
                  <line 
                    x1={hoverX} 
                    y1={padding.top} 
                    x2={hoverX} 
                    y2={padding.top + innerHeight} 
                    stroke="#94a3b8" 
                    strokeWidth="1" 
                    strokeDasharray="4,4" 
                  />

                  {/* Dot for each visible monitor */}
                  {monitors.map(m => {
                    if (!visibleMonitors[m.name]) return null;
                    const val = point[m.name] ?? 0;
                    const y = padding.top + innerHeight - (Math.min(val, maxY) / maxY) * innerHeight;
                    return (
                      <circle
                        key={m.name}
                        cx={hoverX}
                        cy={y}
                        r="4"
                        fill="white"
                        stroke={m.color}
                        strokeWidth="2.5"
                      />
                    );
                  })}
                </g>
              );
            })()}

            {/* Transparent overlay for mouse move capture */}
            <rect
              x={padding.left}
              y={padding.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
                const index = Math.round(ratio * (timeline.length - 1));
                setHoverIndex(index);
              }}
            />
          </svg>

          {/* Interactive Floating Tooltip */}
          {hoverIndex !== null && timeline[hoverIndex] && (
            <div 
              className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-xl p-3.5 shadow-xl border border-slate-200/90 text-xs font-mono pointer-events-none z-10 animate-in fade-in zoom-in-95 duration-100 min-w-[220px]"
            >
              <div className="font-semibold text-slate-700 pb-1.5 border-b border-slate-100 mb-2 flex items-center justify-between">
                <span>采样时间</span>
                <span className="text-slate-500 font-normal">
                  {timeline[hoverIndex].timestamp
                    ? new Date(timeline[hoverIndex].timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' +
                      new Date(timeline[hoverIndex].timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                    : (timeline[hoverIndex].time || '--')}
                </span>
              </div>
              <div className="space-y-1.5">
                {monitors.filter(m => visibleMonitors[m.name]).map(m => {
                  const val = timeline[hoverIndex][m.name];
                  const isDown = timeline[hoverIndex][`${m.name}_status`] === 0;
                  return (
                    <div key={m.name} className="flex items-center justify-between">
                      <span className="flex items-center space-x-1.5 text-slate-600">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                        <span>{m.name}</span>
                      </span>
                      <strong className={isDown ? "text-rose-600" : "text-slate-800"}>
                        {isDown ? "Down" : (typeof val === 'number' ? `${val} ms` : '-- ms')}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Latency Comparison Ranking & Distribution Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Horizontal Ranked Latency Bars */}
        <div className="lg:col-span-1 glass-panel rounded-2xl p-5 shadow-subtle border border-slate-200/80">
          <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center space-x-2">
            <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
            <span>链路响应延迟阶梯排行 ({selectedRange.toUpperCase()})</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">按选定周期均值升序排列</p>

          <div className="space-y-3 font-mono text-xs">
            {rankedMonitors.map((m, idx) => {
              const avg = m.stats?.avgPing ?? m.pingMs ?? 0;
              const maxRankPing = rankedMonitors[rankedMonitors.length - 1]?.stats?.avgPing || 400;
              const barPercent = Math.max(3, Math.min(100, (avg / maxRankPing) * 100));

              return (
                <div key={m.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="flex items-center space-x-1.5 font-medium text-slate-700">
                      <span className="text-[10px] text-slate-400">#{idx + 1}</span>
                      <span>{m.name}</span>
                    </span>
                    <span className="font-semibold text-slate-800">{avg} ms</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${barPercent}%`,
                        backgroundColor: m.color 
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Monitor Stat Cards with 50-Heartbeat Availability Strips */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5 shadow-subtle border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <span>各链路历史心跳条带图与健康度 (Heartbeat Strips)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                每格代表 1 次检测结果（绿色表示 UP，红色表示 DOWN，悬浮查看详情）
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {selectedRange.toUpperCase()} 可用率
            </span>
          </div>

          <div className="space-y-4">
            {monitors.map(m => {
              const hbList = m.heartbeats || [];
              const stats = m.stats || {};

              return (
                <div key={m.name} className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="font-semibold text-slate-800 text-xs">{m.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-slate-500 border border-slate-200">
                        {m.type?.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500">
                      <span>均值: <strong className="text-slate-800">{stats.avgPing ?? m.pingMs}ms</strong></span>
                      <span>最优: <strong className="text-emerald-600">{stats.minPing ?? '--'}ms</strong></span>
                      <span>峰值: <strong className="text-slate-700">{stats.maxPing ?? '--'}ms</strong></span>
                      <span>抖动: <strong className="text-indigo-600">±{stats.jitter ?? 0}ms</strong></span>
                      <span className="text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded font-bold">
                        {m.uptime || m.uptime24h || 100}%
                      </span>
                    </div>
                  </div>

                  {/* Heartbeat Strip Blocks */}
                  <div className="flex items-center space-x-1 overflow-x-auto py-1">
                    {hbList.length > 0 ? (
                      hbList.map((hb, hIdx) => {
                        const isUp = hb.status === 1;
                        return (
                          <div
                            key={hIdx}
                            className={`h-5 w-2.5 rounded-sm shrink-0 transition-transform hover:scale-125 cursor-pointer ${
                              isUp 
                                ? 'bg-emerald-500 hover:bg-emerald-400' 
                                : 'bg-rose-500 hover:bg-rose-400'
                            }`}
                            title={`时间: ${hb.time}\n延迟: ${hb.ping}ms\n状态: ${isUp ? '正常 UP' : '离线 DOWN'}`}
                          />
                        );
                      })
                    ) : (
                      <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${m.uptime || 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
}
