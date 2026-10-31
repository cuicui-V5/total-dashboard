import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Info,
  Waves
} from 'lucide-react';
import { getLatencyBadge } from '../utils/format';

export default function KumaChartsPage({ kuma }) {
  const defaultMonitors = kuma?.monitors || [];
  const defaultTimeline = kuma?.timeline || [];

  // Time Range Selection ('1h' | '24h' | '7d' | '30d')
  const [selectedRange, setSelectedRange] = useState('24h');
  const [rangeData, setRangeData] = useState(null);
  const [isRangeLoading, setIsRangeLoading] = useState(false);

  // Smoothing Mode Toggle (true: Monotone smooth curve, false: Raw polylines)
  const [isSmooth, setIsSmooth] = useState(true);

  // Focused Monitor on hover/legend interaction for visual isolation
  const [focusedMonitor, setFocusedMonitor] = useState(null);

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

  // Hover state for interactive chart crosshair & tooltip
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverRatio, setHoverRatio] = useState(0);
  const rafRef = useRef(null);

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

  // Pre-calculated, high-performance memoized SVG paths with adaptive sub-pixel decimation & Catmull-Rom smoothing
  const chartPaths = useMemo(() => {
    if (!timeline || timeline.length === 0) return {};
    const rawCount = timeline.length;
    // Map to ~1,200 points for pixel-perfect smooth visual representation without GPU/DOM bloat
    const targetPoints = Math.min(rawCount, Math.max(1200, Math.round(innerWidth * 1.5)));
    const bucketSize = rawCount / targetPoints;

    const paths = {};

    monitors.forEach(m => {
      if (!visibleMonitors[m.name]) return;
      const monName = m.name;
      const points = [];

      if (rawCount <= targetPoints) {
        for (let i = 0; i < rawCount; i++) {
          const x = padding.left + (i / Math.max(1, rawCount - 1)) * innerWidth;
          const val = timeline[i][monName] ?? 0;
          const y = padding.top + innerHeight - (Math.min(val, maxY) / maxY) * innerHeight;
          points.push({ x, y, val });
        }
      } else {
        for (let i = 0; i < targetPoints; i++) {
          const start = Math.floor(i * bucketSize);
          const end = Math.min(rawCount, Math.floor((i + 1) * bucketSize));
          let sumVal = 0, count = 0;
          for (let j = start; j < end; j++) {
            const v = timeline[j][monName];
            if (typeof v === 'number') {
              sumVal += v;
              count++;
            }
          }
          const midIdx = Math.floor((start + end) / 2);
          const x = padding.left + (midIdx / Math.max(1, rawCount - 1)) * innerWidth;
          const val = count > 0 ? (sumVal / count) : 0;
          const y = padding.top + innerHeight - (Math.min(val, maxY) / maxY) * innerHeight;
          points.push({ x, y, val });
        }
      }

      if (points.length === 0) return;

      const firstX = points[0].x;
      const lastX = points[points.length - 1].x;
      const bottomY = padding.top + innerHeight;

      let lineD = '';
      if (isSmooth && points.length > 2) {
        lineD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        const tension = 0.18;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = i > 0 ? points[i - 1] : points[i];
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = i < points.length - 2 ? points[i + 2] : p2;

          const cp1x = p1.x + (p2.x - p0.x) * tension;
          let cp1y = p1.y + (p2.y - p0.y) * tension;
          const cp2x = p2.x - (p3.x - p1.x) * tension;
          let cp2y = p2.y - (p3.y - p1.y) * tension;

          const minY = Math.min(p1.y, p2.y);
          const maxYVal = Math.max(p1.y, p2.y);
          cp1y = Math.max(minY - 2, Math.min(maxYVal + 2, cp1y));
          cp2y = Math.max(minY - 2, Math.min(maxYVal + 2, cp2y));

          lineD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }
      } else {
        lineD = points.reduce((acc, p, i) => {
          return i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        }, '');
      }

      const areaD = `${lineD} L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
      paths[monName] = { lineD, areaD };
    });

    return paths;
  }, [timeline, monitors, visibleMonitors, isSmooth, maxY, padding, innerWidth, innerHeight]);

  // Evenly spaced X-axis ticks (O(1) calculation)
  const xTicks = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    const count = 6;
    const ticks = [];
    for (let i = 0; i <= count; i++) {
      const idx = Math.min(timeline.length - 1, Math.round((i / count) * (timeline.length - 1)));
      const pt = timeline[idx];
      if (pt) {
        const x = padding.left + (idx / Math.max(1, timeline.length - 1)) * innerWidth;
        ticks.push({ x, label: pt.label || '' });
      }
    }
    return ticks;
  }, [timeline, padding.left, innerWidth]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => Math.round(maxY * ratio));

  const timeRanges = [
    { id: '1h', label: '最近 1 小时', desc: '原始秒级采样 (~360点)' },
    { id: '24h', label: '过去 24 小时', desc: '14.4秒无损高密 (~6000点)' },
    { id: '7d', label: '过去 7 天', desc: '1.6分钟精细粒度 (~6000点)' },
    { id: '30d', label: '过去 30 天', desc: '7.2分钟长效追踪 (~6000点)' },
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

          {/* Quick preset filters & Smoothing toggle */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Smoothing Mode Toggle Button */}
            <button
              onClick={() => setIsSmooth(!isSmooth)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-medium transition-all ${
                isSmooth
                  ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-sm font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="切换曲线平滑模式与原始折线"
            >
              <Waves className={`h-3.5 w-3.5 ${isSmooth ? 'text-sky-600' : 'text-slate-400'}`} />
              <span>{isSmooth ? '平滑曲线 (开启)' : '原始折线'}</span>
            </button>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center space-x-1">
              <button
                onClick={selectAll}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
              >
                全选
              </button>
              <button
                onClick={selectDomestic}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
              >
                内网/国内
              </button>
              <button
                onClick={selectOverseas}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
              >
                海外 VPS
              </button>
            </div>
          </div>
        </div>

        {/* Legend / Filter Pills with Hover Isolation */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {monitors.map(m => {
            const isVisible = visibleMonitors[m.name];
            const isFocused = focusedMonitor === m.name;
            return (
              <button
                key={m.name}
                onClick={() => toggleMonitor(m.name)}
                onMouseEnter={() => setFocusedMonitor(m.name)}
                onMouseLeave={() => setFocusedMonitor(null)}
                className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium transition-all border ${
                  isVisible
                    ? (isFocused
                        ? 'bg-white shadow-md border-sky-400 ring-2 ring-sky-300/60 text-slate-900 scale-105'
                        : 'bg-white shadow-sm border-slate-300 text-slate-800 hover:border-slate-400')
                    : 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60 line-through'
                }`}
                title={`点击显示/隐藏；悬停聚焦单条链路`}
              >
                <span 
                  className="h-2.5 w-2.5 rounded-full transition-transform" 
                  style={{ backgroundColor: isVisible ? m.color : '#94a3b8' }} 
                />
                <span className="font-semibold">{m.name}</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  ({m.stats?.avgPing ?? m.pingMs ?? 0}ms)
                </span>
              </button>
            );
          })}
        </div>

        {/* SVG Multi-Line Chart with GPU-friendly rendering */}
        <div className="relative w-full overflow-x-auto">
          <svg 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
            className="w-full h-auto min-w-[650px] overflow-visible"
            onMouseLeave={() => {
              setHoverIndex(null);
            }}
          >
            {/* SVG Gradients for Focused Monitor Area Glow */}
            <defs>
              {monitors.map(m => (
                <linearGradient key={m.name} id={`grad-${m.name}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={m.color} stopOpacity="0.25" />
                  <stop offset="85%" stopColor={m.color} stopOpacity="0.03" />
                  <stop offset="100%" stopColor={m.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

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

            {/* X-axis time marks (Optimized O(1)) */}
            {xTicks.map((tick, idx) => (
              <g key={idx}>
                <line 
                  x1={tick.x} 
                  y1={padding.top + innerHeight} 
                  x2={tick.x} 
                  y2={padding.top + innerHeight + 4} 
                  stroke="#cbd5e1" 
                  strokeWidth="1" 
                />
                <text 
                  x={tick.x} 
                  y={padding.top + innerHeight + 16} 
                  textAnchor="middle" 
                  className="text-[10px] font-mono fill-slate-400"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Focused Monitor Area Fill (Rendered underneath lines) */}
            {focusedMonitor && visibleMonitors[focusedMonitor] && chartPaths[focusedMonitor]?.areaD && (
              <path
                d={chartPaths[focusedMonitor].areaD}
                fill={`url(#grad-${focusedMonitor})`}
                pointerEvents="none"
                className="transition-all duration-200"
              />
            )}

            {/* Monitor Paths (Precomputed and memoized) */}
            {monitors.map(m => {
              if (!visibleMonitors[m.name]) return null;
              const pathData = chartPaths[m.name];
              if (!pathData || !pathData.lineD) return null;
              const isFocused = focusedMonitor === m.name;
              const hasFocus = Boolean(focusedMonitor);

              return (
                <path
                  key={m.name}
                  d={pathData.lineD}
                  fill="none"
                  stroke={m.color}
                  strokeWidth={isFocused ? "2.8" : (hasFocus ? "1.2" : "1.8")}
                  strokeOpacity={isFocused ? 1 : (hasFocus ? 0.22 : 0.88)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-150"
                />
              );
            })}

            {/* Hover Crosshair & Dots */}
            {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < timeline.length && (() => {
              const hoverX = padding.left + (hoverIndex / Math.max(1, timeline.length - 1)) * innerWidth;
              const point = timeline[hoverIndex];

              return (
                <g pointerEvents="none">
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
                    const isFocused = focusedMonitor === m.name;
                    return (
                      <circle
                        key={m.name}
                        cx={hoverX}
                        cy={y}
                        r={isFocused ? "5.5" : "3.5"}
                        fill="white"
                        stroke={m.color}
                        strokeWidth={isFocused ? "3" : "2"}
                        className="transition-all duration-75"
                      />
                    );
                  })}
                </g>
              );
            })()}

            {/* Transparent overlay for mouse move capture with RAF throttling */}
            <rect
              x={padding.left}
              y={padding.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onMouseMove={(e) => {
                if (!timeline || timeline.length === 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
                const index = Math.round(ratio * (timeline.length - 1));

                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                  setHoverIndex(index);
                  setHoverRatio(ratio);
                });
              }}
            />
          </svg>

          {/* Dynamic Non-occluding Floating Tooltip */}
          {hoverIndex !== null && timeline[hoverIndex] && (() => {
            const point = timeline[hoverIndex];
            const sortedMonitors = monitors
              .filter(m => visibleMonitors[m.name])
              .sort((a, b) => {
                if (focusedMonitor === a.name) return -1;
                if (focusedMonitor === b.name) return 1;
                const pingA = point[a.name] ?? 9999;
                const pingB = point[b.name] ?? 9999;
                return pingA - pingB;
              });

            const isLeft = hoverRatio > 0.62;

            return (
              <div 
                className={`absolute top-4 ${isLeft ? 'left-16' : 'right-4'} bg-white/95 backdrop-blur-md rounded-xl p-3.5 shadow-xl border border-slate-200/90 text-xs font-mono pointer-events-none z-10 animate-in fade-in zoom-in-95 duration-100 min-w-[230px]`}
              >
                <div className="font-semibold text-slate-700 pb-1.5 border-b border-slate-100 mb-2 flex items-center justify-between">
                  <span>采样点详细时间</span>
                  <span className="text-slate-500 font-normal">
                    {point.timestamp
                      ? new Date(point.timestamp).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit' }) + ' ' +
                        new Date(point.timestamp).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                      : (point.time || '--')}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {sortedMonitors.map(m => {
                    const val = point[m.name];
                    const isDown = point[`${m.name}_status`] === 0;
                    const isFocused = focusedMonitor === m.name;
                    return (
                      <div 
                        key={m.name} 
                        className={`flex items-center justify-between px-1 py-0.5 rounded transition-colors ${
                          isFocused ? 'bg-sky-50 font-bold' : ''
                        }`}
                      >
                        <span className="flex items-center space-x-1.5 text-slate-600">
                          <span 
                            className={`rounded-full transition-all ${isFocused ? 'h-2.5 w-2.5 ring-2 ring-sky-300' : 'h-2 w-2'}`} 
                            style={{ backgroundColor: m.color }} 
                          />
                          <span className={isFocused ? 'text-slate-900 font-bold' : ''}>{m.name}</span>
                        </span>
                        <strong className={isDown ? "text-rose-600" : (isFocused ? "text-sky-700" : "text-slate-800")}>
                          {isDown ? "Down" : (typeof val === 'number' ? `${val} ms` : '-- ms')}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
