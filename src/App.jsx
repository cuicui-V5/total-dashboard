import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import NodeCard from './components/NodeCard';
import NodeDetailModal from './components/NodeDetailModal';
import KumaSection from './components/KumaSection';
import BwhSection from './components/BwhSection';
import AlertBanner from './components/AlertBanner';
import { 
  Server, 
  Layers, 
  Activity, 
  HardDriveDownload, 
  AlertCircle, 
  RefreshCw,
  Cpu,
  Database,
  ArrowDownUp
} from 'lucide-react';

export default function App() {
  const [fleetData, setFleetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(10000); // 10 seconds default

  const fetchFleet = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const url = isManual ? '/api/fleet?force=true' : '/api/fleet';
      const res = await axios.get(url);
      setFleetData(res.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch fleet metrics:', err);
      setError('无法连接后端服务或数据拉取失败，请检查网络或后端状态。');
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchFleet(false);
  }, [fetchFleet]);

  // Periodic polling
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

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        {/* Navigation & Toolbar */}
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
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          
          {/* Global Alert notifications */}
          <AlertBanner alerts={fleetData?.summary?.alerts} />

          {/* Initial Loading Skeleton */}
          {loading && !fleetData && (
            <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-sky-500" />
              <p className="text-sm font-medium">正在拉取各节点与服务监控数据...</p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">数据加载异常</p>
                <p className="text-xs text-rose-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {fleetData && (
            <>
              {/* Top High-level Metric Stat Cards */}
              <SummaryCards summary={fleetData.summary} />

              {/* TAB CONTENT: ALL or NODES */}
              {(activeTab === 'all' || activeTab === 'nodes') && (
                <section className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Server className="h-4 w-4 text-sky-600" />
                      <h2 className="text-base font-bold text-slate-800 tracking-tight">
                        设备节点详情 ({filteredNodes.length})
                      </h2>
                    </div>
                    <span className="text-xs text-slate-400">
                      实时采集 CPU、内存、磁盘与进程指标
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
              )}

              {/* TAB CONTENT: ALL or KUMA */}
              {(activeTab === 'all' || activeTab === 'kuma') && (
                <section>
                  <KumaSection kuma={{
                    ...fleetData.kuma,
                    monitors: filteredMonitors
                  }} />
                </section>
              )}

              {/* TAB CONTENT: ALL or BWH */}
              {(activeTab === 'all' || activeTab === 'bwh') && (
                <section>
                  <BwhSection bwhInstances={filteredBwh} />
                </section>
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
            <span>Glances + Uptime Kuma + KiwiVM 聚合看板</span>
          </div>
          <div>
            运行于 PVE Ubuntu • 浅色优雅现代设计
          </div>
        </div>
      </footer>
    </div>
  );
}
