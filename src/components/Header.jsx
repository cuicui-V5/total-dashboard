import React from 'react';
import { 
  Server, 
  RefreshCw, 
  Search, 
  Activity, 
  Layers, 
  HardDriveDownload,
  Sparkles,
  TrendingUp,
  Bell
} from 'lucide-react';

export default function Header({ 
  totalNodes, 
  onlineNodes, 
  activeTab, 
  setActiveTab, 
  searchQuery, 
  setSearchQuery, 
  autoRefreshInterval, 
  setAutoRefreshInterval, 
  isRefreshing, 
  onManualRefresh, 
  lastUpdated,
  alertCount = 0
}) {
  const isAllOnline = totalNodes > 0 && onlineNodes === totalNodes;

  const tabs = [
    { id: 'overview', label: '综合概览', icon: Layers },
    { id: 'nodes', label: '设备节点', badge: totalNodes, icon: Server },
    { id: 'kuma', label: '网络链路', icon: Activity },
    { id: 'kuma-charts', label: '时序图表', icon: TrendingUp },
    { id: 'bwh', label: 'VPS 流量', icon: HardDriveDownload },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-200/80 shadow-subtle mb-6 backdrop-blur-md bg-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Cluster Status Pill */}
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 transition-transform hover:scale-105 duration-200">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                  TotalDashboard
                </h1>
                <div className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  isAllOnline 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isAllOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{onlineNodes}/{totalNodes} 在线</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                五台设备监控 • Uptime Kuma 链路 • 搬瓦工流量配额
              </p>
            </div>
          </div>

          {/* Right Controls: Search, Auto-refresh, Manual Refresh */}
          <div className="flex items-center flex-wrap gap-2.5">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索节点或服务..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-sky-300 rounded-lg outline-none transition-all w-36 sm:w-44 focus:w-56 text-slate-700 placeholder-slate-400 shadow-xs"
              />
            </div>

            {/* Auto-refresh interval dropdown */}
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="text-xs bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-none hover:border-slate-300 focus:border-sky-500 transition-colors cursor-pointer shadow-xs"
              title="自动刷新周期"
            >
              <option value={60000}>1 分钟刷新</option>
              <option value={30000}>30 秒刷新</option>
              <option value={10000}>10 秒刷新</option>
              <option value={0}>暂停自动刷新</option>
            </select>

            {/* Manual refresh button */}
            <button
              onClick={onManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-all shadow-xs disabled:opacity-50 active:scale-95"
              title="立即刷新数据"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isRefreshing ? 'animate-spin text-sky-600' : ''}`} />
              <span className="hidden sm:inline">刷新</span>
            </button>
          </div>
        </div>

        {/* Animated Navigation Tabs Bar */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-200/60 pt-3.5">
          
          <nav className="flex items-center space-x-1 sm:space-x-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-inner overflow-x-auto overflow-y-hidden no-scrollbar max-w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center space-x-2 sm:space-x-2.5 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out whitespace-nowrap active:scale-[0.98] ${
                    isActive
                      ? 'bg-white text-sky-700 shadow-md shadow-slate-200/80 font-bold border border-slate-200/60 scale-[1.01]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  <Icon className={`h-4 w-4 sm:h-4.5 sm:w-4.5 transition-transform duration-200 ${isActive ? 'scale-110 text-sky-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold transition-colors ${
                      isActive ? 'bg-sky-100 text-sky-700' : 'bg-slate-200/80 text-slate-600'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
          
          <div className="text-xs text-slate-400 hidden lg:flex items-center space-x-1.5 pl-4 shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>最近同步: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '--:--:--'}</span>
          </div>
        </div>

      </div>
    </header>
  );
}
