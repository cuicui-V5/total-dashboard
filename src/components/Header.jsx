import React from 'react';
import { 
  Server, 
  RefreshCw, 
  Search, 
  Activity, 
  Layers, 
  ShieldCheck, 
  HardDriveDownload,
  Wifi,
  Sparkles
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
  lastUpdated 
}) {
  const isAllOnline = totalNodes > 0 && onlineNodes === totalNodes;

  const tabs = [
    { id: 'all', label: '综合总览', icon: Layers },
    { id: 'nodes', label: `设备节点 (${totalNodes})`, icon: Server },
    { id: 'kuma', label: '链路监控', icon: Activity },
    { id: 'bwh', label: 'VPS 流量', icon: HardDriveDownload },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-200/80 shadow-subtle mb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Status Badge */}
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                  TotalDashboard
                </h1>
                <div className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  isAllOnline 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isAllOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{onlineNodes}/{totalNodes} 在线</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                六台设备监控 • Uptime Kuma 链路 • 搬瓦工流量配额
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
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-sky-300 rounded-lg outline-none transition-all w-36 sm:w-44 focus:w-56 text-slate-700 placeholder-slate-400"
              />
            </div>

            {/* Auto-refresh interval dropdown */}
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="text-xs bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-none hover:border-slate-300 focus:border-sky-500 transition-colors cursor-pointer shadow-sm"
              title="自动刷新周期"
            >
              <option value={5000}>5 秒刷新</option>
              <option value={10000}>10 秒刷新</option>
              <option value={30000}>30 秒刷新</option>
              <option value={0}>暂停自动刷新</option>
            </select>

            {/* Manual refresh button */}
            <button
              onClick={onManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-all shadow-sm disabled:opacity-50"
              title="立即刷新数据"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isRefreshing ? 'animate-spin text-sky-600' : ''}`} />
              <span className="hidden sm:inline">刷新</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 flex items-center space-x-1 overflow-x-auto border-t border-slate-200/60 pt-2.5 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 shadow-sm border border-sky-200/70'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
          
          <div className="ml-auto text-[11px] text-slate-400 hidden lg:flex items-center space-x-1">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>最近同步: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--:--:--'}</span>
          </div>
        </div>

      </div>
    </header>
  );
}
