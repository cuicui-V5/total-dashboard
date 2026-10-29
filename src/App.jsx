import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Header from './components/Header';
import OverviewPage from './components/OverviewPage';
import NodeCard from './components/NodeCard';
import NodeDetailModal from './components/NodeDetailModal';
import KumaSection from './components/KumaSection';
import KumaChartsPage from './components/KumaChartsPage';
import BwhSection from './components/BwhSection';
import FloatingAlerts from './components/FloatingAlerts';
import { 
  Server, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function App() {
  // Instant Hydration from LocalStorage cache (0ms perceived load time!)
  const [fleetData, setFleetData] = useState(() => {
    try {
      const saved = localStorage.getItem('total_dashboard_cache');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(!fleetData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60000); // 60s (1 min) interval
  const hasFleetDataRef = React.useRef(false);

  const fetchFleet = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const url = isManual ? '/api/fleet?force=true' : '/api/fleet';
      const res = await axios.get(url, { timeout: 8000 });
      setFleetData(res.data);
      hasFleetDataRef.current = true;
      setError(null);
      
      // Save snapshot for next instant startup
      try {
        localStorage.setItem('total_dashboard_cache', JSON.stringify(res.data));
      } catch (e) {
        // ignore localStorage quota errors
      }
    } catch (err) {
      console.warn('Failed to fetch fleet metrics:', err);
      // Only set blocking error if we have no prior data
      if (!hasFleetDataRef.current) {
        setError('正在连接后台监控引擎，请稍候...');
      }
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchFleet(false);
  }, [fetchFleet]);

  // Periodic non-blocking polling
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      fetchFleet(false);
    }, autoRefreshInterval);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchFleet]);

  // Filtered nodes
  const filteredNodes = (fleetData?.nodes || []).filter(n => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.label?.toLowerCase().includes(q) ||
      n.system?.hostname?.toLowerCase().includes(q) ||
      n.tag?.toLowerCase().includes(q) ||
      n.url?.toLowerCase().includes(q)
    );
  });

  // Filtered Kuma monitors
  const filteredMonitors = (fleetData?.kuma?.monitors || []).filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.hostname?.toLowerCase().includes(q) ||
      m.url?.toLowerCase().includes(q) ||
      m.type?.toLowerCase().includes(q)
    );
  });

  // Filtered BWH instances
  const filteredBwh = (fleetData?.bwh || []).filter(b => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.label?.toLowerCase().includes(q) ||
      b.datacenter?.toLowerCase().includes(q) ||
      b.ip?.toLowerCase().includes(q) ||
      String(b.veid).includes(q)
    );
  });

  const alerts = fleetData?.summary?.alerts || [];

  return (
    <div className="min-h-screen flex flex-col justify-between relative">
      <div>
        {/* Navigation & Toolbar with Tab Switch Animations */}
        <Header
          totalNodes={fleetData?.nodes?.length || 6}
          onlineNodes={fleetData?.nodes?.filter(n => n.online)?.length || 0}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          autoRefreshInterval={autoRefreshInterval}
          setAutoRefreshInterval={setAutoRefreshInterval}
          isRefreshing={isRefreshing}
          onManualRefresh={() => fetchFleet(true)}
          lastUpdated={fleetData?.timestamp}
          alertCount={alerts.length}
        />

        {/* Global Floating Toast Alert Bubbles (Fixed positioning, ZERO layout shift!) */}
        <FloatingAlerts alerts={alerts} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          
          {/* Initial Loading placeholder only if zero cache */}
          {loading && !fleetData && (
            <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-sky-500" />
              <p className="text-sm font-medium">正在连接本地与云端节点数据...</p>
            </div>
          )}

          {/* Soft connection notice */}
          {error && !fleetData && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center space-x-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">正在同步数据</p>
                <p className="text-xs text-amber-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {fleetData && (
            <>
              {/* TAB 1: CONCISE EXECUTIVE OVERVIEW (综合概览) */}
              {activeTab === 'overview' && (
                <div key="overview" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both">
                  <OverviewPage 
                    fleetData={fleetData}
                    onSelectNode={setSelectedNode}
                    onNavigateTab={setActiveTab}
                  />
                </div>
              )}

              {/* TAB 2: DETAILED FLEET NODES (设备节点详情) */}
              {activeTab === 'nodes' && (
                <div key="nodes" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both">
                  <section className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Server className="h-4 w-4 text-sky-600" />
                        <h2 className="text-base font-bold text-slate-800 tracking-tight">
                          设备节点详情与规格 ({filteredNodes.length})
                        </h2>
                      </div>
                      <span className="text-xs text-slate-400">
                        独立异步轮询 • 毫秒级极速响应 • 点击卡片可查看进程与详细挂载
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredNodes.map(node => (
                        <NodeCard 
                          key={node.id} 
                          node={node} 
                          onOpenDetails={setSelectedNode} 
                        />
                      ))}
                    </div>

                    {filteredNodes.length === 0 && (
                      <div className="p-8 text-center text-xs text-slate-400 bg-white/60 rounded-xl border border-slate-200">
                        未找到匹配 "{searchQuery}" 的设备节点
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* TAB 3: DETAILED KUMA NETWORK MONITORS (网络链路状态) */}
              {activeTab === 'kuma' && (
                <div key="kuma" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both">
                  <section>
                    <KumaSection kuma={{
                      ...fleetData.kuma,
                      monitors: filteredMonitors
                    }} />
                  </section>
                </div>
              )}

              {/* TAB 4: HIGH DENSITY LATENCY CHARTS (千点时序图表) */}
              {activeTab === 'kuma-charts' && (
                <div key="kuma-charts" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both">
                  <section>
                    <KumaChartsPage kuma={fleetData.kuma} />
                  </section>
                </div>
              )}

              {/* TAB 5: DETAILED VPS & BANDWIDTH (搬瓦工 VPS 流量) */}
              {activeTab === 'bwh' && (
                <div key="bwh" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both">
                  <section>
                    <BwhSection bwhInstances={filteredBwh} />
                  </section>
                </div>
              )}
            </>
          )}

          {/* Node Detail Popup Drawer */}
          {selectedNode && (
            <NodeDetailModal
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          )}

        </main>
      </div>

      {/* Elegant Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white/60 backdrop-blur-md py-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-600">TotalDashboard</span>
            <span>•</span>
            <span>异步聚合与后台持久轮询引擎</span>
          </div>
          <div>
            运行于 PVE Ubuntu • 浅色优雅现代设计
          </div>
        </div>
      </footer>
    </div>
  );
}
