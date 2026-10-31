import React, { useState, useEffect, useMemo } from 'react';
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
  ArrowUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Search,
  Terminal,
  Shield,
  Gauge,
  Sliders,
  HelpCircle
} from 'lucide-react';
import { formatBytes, formatSpeed, getPercentColor, getLatencyBadge } from '../utils/format';

export default function NodeDetailModal({ node, onClose }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'disks' | 'network' | 'processes' | 'containers'
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processSearch, setProcessSearch] = useState('');
  const [processSortBy, setProcessSortBy] = useState('cpu'); // 'cpu' | 'mem'

  // Fetch full details on-demand when modal opens or node id changes
  const fetchFullDetails = async (force = false) => {
    if (!node?.id) return;
    if (force) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setFetchError(null);

    try {
      const url = `/api/fleet/node/${node.id}/full${force ? '?force=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP 错误 ${res.status}`);
      }
      const data = await res.json();
      setFullData(data);
    } catch (err) {
      console.error('Failed to fetch full node details:', err);
      setFetchError(err.message || '网络连接超时');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFullDetails(false);
  }, [node?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!node) return null;

  // Use full data if available, otherwise fallback to lightweight data
  const data = fullData || node;
  const isOnline = data.online;
  const latency = getLatencyBadge(data.latencyMs);

  // Filtered & sorted processes
  const filteredProcesses = useMemo(() => {
    const list = data.processes?.topList || [];
    let result = list;
    if (processSearch.trim()) {
      const q = processSearch.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(q) || 
        String(p.pid).includes(q) || 
        p.username?.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      if (processSortBy === 'mem') {
        return (b.memPercent || 0) - (a.memPercent || 0);
      }
      return (b.cpuPercent || 0) - (a.cpuPercent || 0);
    });
  }, [data.processes?.topList, processSearch, processSortBy]);

  const tabs = [
    { id: 'overview', label: '计算与内存', icon: Cpu },
    { id: 'disks', label: `存储挂载 (${data.disks?.length || 0})`, icon: HardDrive },
    { id: 'network', label: `网卡接口 (${data.network?.interfaces?.length || 0})`, icon: Wifi },
    { id: 'processes', label: `Top 进程 (${data.processes?.topList?.length || 0})`, icon: Activity },
    { id: 'containers', label: `容器 (${data.containers?.length || 0})`, icon: Box },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-bold shadow-xs">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="font-bold text-slate-800 text-base">{data.label}</h3>
                <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-100 text-slate-600 border border-slate-200">
                  {data.tag}
                </span>
                <span className={`inline-flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full border ${
                  isOnline 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold' 
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>{isOnline ? '在线' : '离线'}</span>
                </span>
                {data.latencyMs && (
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${latency.color}`}>
                    {latency.text}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center space-x-2">
                <span>{data.system?.hostname || data.label}</span>
                <span>•</span>
                <span className="truncate max-w-[280px]">{data.url}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchFullDetails(true)}
              disabled={isRefreshing || loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all shadow-xs disabled:opacity-50"
              title="强制向节点请求全量数据"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
              <span className="hidden sm:inline">实时同步</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Dynamic On-Demand Loading State Banner */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          {loading ? (
            <div className="flex items-center space-x-2 text-sky-600 py-0.5 animate-pulse">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span className="font-medium">
                正在建立按需通道，拉取全量完整数据（硬件架构、文件系统、网络吞吐、Top 进程与 Docker）...
              </span>
            </div>
          ) : fetchError ? (
            <div className="flex items-center justify-between w-full text-amber-700 py-0.5">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>全量数据拉取失败：{fetchError}（海外云端高丢包链路）</span>
              </div>
              <button
                onClick={() => fetchFullDetails(true)}
                className="text-xs font-semibold text-sky-600 hover:underline ml-3"
              >
                重试拉取
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full text-slate-500 py-0.5 font-mono text-[11px]">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-slate-700 font-medium">全量详情已就绪</span>
                <span className="text-slate-400">
                  (耗时 {fullData?.latencyMs || 0}ms{fullData?.fromCache ? ' · 缓存命中' : ' · 实时采集'})
                </span>
              </div>
              <span className="text-slate-400">
                更新于 {fullData?.fullFetchedAt ? new Date(fullData.fullFetchedAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '刚刚'}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Tabs Bar */}
        <div className="px-6 pt-3 border-b border-slate-200/80 bg-white flex space-x-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-sky-500 text-sky-600 bg-sky-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-sky-500' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* TAB 1: OVERVIEW & COMPUTE (核心计算与内存) */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Quick Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/90 p-4 rounded-xl border border-slate-200/70">
                <div>
                  <span className="text-slate-400 block mb-0.5 text-[11px]">操作系统与内核</span>
                  <span className="font-semibold text-slate-800 text-xs block truncate" title={data.system?.hrName || data.system?.osName}>
                    {data.system?.hrName || data.system?.osName || 'Linux'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                    {data.system?.platform || 'x86_64'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 text-[11px]">CPU 规格与主频</span>
                  <span className="font-semibold text-slate-800 text-xs block truncate" title={data.cpu?.name}>
                    {data.cpu?.cores} 物理核 / {data.cpu?.logicalCores} 线程
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                    {data.cpu?.frequencyMhz ? `${data.cpu.frequencyMhz} MHz` : (data.cpu?.name || 'Standard')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 text-[11px]">系统平均负载 (1/5/15m)</span>
                  <span className="font-mono font-bold text-slate-800 text-xs block">
                    {data.cpu?.loadAvg?.join('  •  ') || '0, 0, 0'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    标准阈值: {data.cpu?.logicalCores || 1}.0
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 text-[11px]">连续运行时间 (Uptime)</span>
                  <span className="font-semibold text-slate-800 text-xs block">
                    {data.system?.uptime || '正常'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    状态持续正常
                  </span>
                </div>
              </div>

              {/* CPU Detailed Card */}
              <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Cpu className="h-4 w-4 text-sky-500" />
                    <h4 className="font-bold text-slate-800 text-xs">CPU 负载与时间片分配</h4>
                  </div>
                  <span className="font-mono font-bold text-sm text-sky-600">{data.cpu?.percent || 0}%</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-3">
                  <div 
                    className="h-full rounded-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, data.cpu?.percent || 0))}%` }}
                  />
                </div>

                {data.cpu?.times && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 font-mono text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">用户空间 (User)</span>
                      <span className="font-bold text-slate-700">{data.cpu.times.user}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">系统内核 (System)</span>
                      <span className="font-bold text-slate-700">{data.cpu.times.system}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">磁盘等待 (I/O Wait)</span>
                      <span className="font-bold text-amber-600">{data.cpu.times.iowait}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">空闲时间 (Idle)</span>
                      <span className="font-bold text-emerald-600">{data.cpu.times.idle}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Memory Detailed Breakdown Card */}
              <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-indigo-500" />
                    <h4 className="font-bold text-slate-800 text-xs">内存架构与缓存分布</h4>
                  </div>
                  <span className="font-mono font-bold text-sm text-indigo-600">{data.memory?.percent || 0}%</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-3">
                  <div 
                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, data.memory?.percent || 0))}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 font-mono text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">总内存容量</span>
                    <span className="font-bold text-slate-800">{formatBytes(data.memory?.totalBytes)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">实际使用 (Used)</span>
                    <span className="font-bold text-indigo-600">{formatBytes(data.memory?.usedBytes)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">系统可用 (Available)</span>
                    <span className="font-bold text-emerald-600">{formatBytes(data.memory?.availableBytes)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">缓存与缓冲 (Cache/Buf)</span>
                    <span className="font-bold text-slate-700">
                      {formatBytes((data.memory?.cachedBytes || 0) + (data.memory?.buffersBytes || 0))}
                    </span>
                  </div>
                </div>

                {/* Swap Details */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between font-mono text-[11px]">
                  <div className="flex items-center space-x-2 text-slate-500">
                    <span className="font-semibold text-slate-700">Swap 交换分区:</span>
                    <span>{data.swap?.percent || 0}% 占用</span>
                  </div>
                  <div className="space-x-3 text-slate-400">
                    <span>已用: <strong className="text-slate-600">{formatBytes(data.swap?.usedBytes)}</strong></span>
                    <span>总量: <strong className="text-slate-600">{formatBytes(data.swap?.totalBytes)}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FILESYSTEM DISKS & MOUNTS (存储挂载) */}
          {activeTab === 'disks' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-sky-500" />
                  <span>磁盘分区与挂载点 ({data.disks?.length || 0})</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  自动排查过滤容器内部重复映射
                </span>
              </div>

              {data.disks?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {data.disks.map((disk, idx) => {
                    const color = getPercentColor(disk.percent);
                    return (
                      <div key={idx} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-800 font-mono text-xs">{disk.mount}</span>
                                {disk.fsType && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono uppercase bg-white text-slate-500 border border-slate-200">
                                    {disk.fsType}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate max-w-[200px]" title={disk.device}>
                                {disk.device}
                              </span>
                            </div>
                            <span className={`font-mono font-bold text-sm ${color.text}`}>{disk.percent}%</span>
                          </div>

                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2.5">
                            <div className={`h-full rounded-full transition-all duration-300 ${color.bg}`} style={{ width: `${disk.percent}%` }} />
                          </div>
                        </div>

                        <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-200/60">
                          <span>已用: <strong className="text-slate-700">{formatBytes(disk.usedBytes)}</strong></span>
                          <span>可用: <strong className="text-emerald-600">{formatBytes(disk.freeBytes)}</strong></span>
                          <span>总计: <strong className="text-slate-700">{formatBytes(disk.totalBytes)}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  {loading ? '正在从目标节点拉取存储分区详情...' : '未检测到活跃的磁盘分区数据'}
                </div>
              )}

              {/* Disk I/O Breakdown if available */}
              {data.diskio?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h5 className="font-semibold text-slate-700 text-xs mb-3 flex items-center space-x-1.5">
                    <Activity className="h-3.5 w-3.5 text-indigo-500" />
                    <span>磁盘物理 I/O 吞吐</span>
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {data.diskio.map((dio, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 font-mono text-[11px]">
                        <span className="font-semibold text-slate-700 block mb-1">{dio.diskName}</span>
                        <div className="flex justify-between text-slate-500 text-[10px]">
                          <span>读: {formatSpeed(dio.readBytesRate)}</span>
                          <span>写: {formatSpeed(dio.writeBytesRate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NETWORK INTERFACES (网卡接口与速率) */}
          {activeTab === 'network' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs flex items-center space-x-2">
                  <Wifi className="h-4 w-4 text-violet-500" />
                  <span>网卡网络接口与实时速率 ({data.network?.interfaces?.length || 0})</span>
                </h4>
                <div className="text-[11px] font-mono text-slate-500 space-x-3">
                  <span>总收: <strong className="text-emerald-600">{formatSpeed(data.network?.totalRxRate)}</strong></span>
                  <span>总发: <strong className="text-sky-600">{formatSpeed(data.network?.totalTxRate)}</strong></span>
                </div>
              </div>

              {data.network?.interfaces?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.network.interfaces.map((net, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 flex justify-between items-center font-mono">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800 text-xs">{net.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-50 text-violet-700 border border-violet-200">
                            Interface
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          累计接收: {formatBytes(net.cumulativeRxBytes)}  •  累计发送: {formatBytes(net.cumulativeTxBytes)}
                        </span>
                      </div>

                      <div className="text-right text-xs space-y-0.5">
                        <div className="text-emerald-600 font-bold flex items-center justify-end space-x-1">
                          <ArrowDown className="h-3.5 w-3.5" />
                          <span>{formatSpeed(net.rxSpeedBytes)}</span>
                        </div>
                        <div className="text-sky-600 font-bold flex items-center justify-end space-x-1">
                          <ArrowUp className="h-3.5 w-3.5" />
                          <span>{formatSpeed(net.txSpeedBytes)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  {loading ? '正在拉取实时网络接口数据...' : '未检测到活跃的网络接口'}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TOP PROCESSES (Top 进程) */}
          {activeTab === 'processes' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-indigo-500" />
                  <h4 className="font-bold text-slate-800 text-xs">
                    活跃进程列表 (展示 Top {filteredProcesses.length}，系统总计 {data.processes?.total || 0})
                  </h4>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="按 PID / 进程名搜索..."
                      value={processSearch}
                      onChange={(e) => setProcessSearch(e.target.value)}
                      className="pl-8 pr-2.5 py-1 text-xs bg-slate-100 focus:bg-white border border-transparent focus:border-sky-300 rounded-lg outline-none w-44"
                    />
                  </div>

                  {/* Sort buttons */}
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-mono">
                    <button
                      onClick={() => setProcessSortBy('cpu')}
                      className={`px-2.5 py-1 ${processSortBy === 'cpu' ? 'bg-sky-500 text-white font-bold' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      CPU 序
                    </button>
                    <button
                      onClick={() => setProcessSortBy('mem')}
                      className={`px-2.5 py-1 ${processSortBy === 'mem' ? 'bg-sky-500 text-white font-bold' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      内存序
                    </button>
                  </div>
                </div>
              </div>

              {filteredProcesses.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">PID</th>
                        <th className="py-2.5 px-3">进程名 / 命令</th>
                        <th className="py-2.5 px-3">执行用户</th>
                        <th className="py-2.5 px-3 text-center">状态</th>
                        <th className="py-2.5 px-3 text-center">线程</th>
                        <th className="py-2.5 px-3 text-right">内存 (RSS)</th>
                        <th className="py-2.5 px-3 text-right">CPU %</th>
                        <th className="py-2.5 px-3 text-right">内存 %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {filteredProcesses.map((proc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 text-slate-400">{proc.pid}</td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-800 block truncate max-w-[200px]" title={proc.cmdline || proc.name}>
                              {proc.name}
                            </span>
                            {proc.cmdline && proc.cmdline !== proc.name && (
                              <span className="text-[10px] text-slate-400 truncate block max-w-[280px]" title={proc.cmdline}>
                                {proc.cmdline}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-500">{proc.username}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px]">
                              {proc.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-500">{proc.numThreads}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{formatBytes(proc.rssBytes)}</td>
                          <td className="py-2 px-3 text-right text-sky-600 font-bold">{proc.cpuPercent}%</td>
                          <td className="py-2 px-3 text-right text-indigo-600 font-bold">{proc.memPercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  {loading ? '正在按需拉取节点进程列表...' : '未找到匹配的进程'}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DOCKER CONTAINERS (容器) */}
          {activeTab === 'containers' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs flex items-center space-x-2">
                  <Box className="h-4 w-4 text-emerald-500" />
                  <span>Docker 容器运行状态 ({data.containers?.length || 0})</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  原生对接 Glances Docker 插件引擎
                </span>
              </div>

              {data.containers?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.containers.map((c, idx) => {
                    const isRunning = c.status === 'running' || c.status === 'healthy';
                    return (
                      <div key={idx} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span className="font-bold text-slate-800 text-xs font-mono">{c.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate max-w-[220px]" title={c.image}>
                                {c.image}
                              </span>
                            </div>

                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                              isRunning 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {c.status}
                            </span>
                          </div>

                          {c.ports && (
                            <div className="text-[10px] font-mono text-slate-500 bg-white/70 p-1.5 rounded border border-slate-200/60 mb-2 truncate">
                              端口映射: {c.ports}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-200/60">
                          <span>运行: {c.uptime || '运行中'}</span>
                          <span>内存: <strong className="text-slate-700">{formatBytes(c.memoryUsageBytes)}</strong></span>
                          <span>CPU: <strong className="text-sky-600">{c.cpuPercent}%</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  {loading ? '正在探测 Docker 容器环境...' : '当前节点未检测到运行中的 Docker 容器服务'}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <span>按需深钻技术架构 · 轻量低耗轮询</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            关闭详情面板
          </button>
        </div>
      </div>
    </div>
  );
}