import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, X, Bell, ChevronDown, ChevronUp } from 'lucide-react';

export default function FloatingAlerts({ alerts = [] }) {
  // Track dismissed alerts by source + message key
  const [dismissedKeys, setDismissedKeys] = useState(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter out dismissed alerts
  const activeAlerts = alerts.filter(a => !dismissedKeys.has(`${a.source}_${a.message}`));

  const dismissAlert = (key) => {
    setDismissedKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const clearAll = () => {
    const allKeys = new Set(alerts.map(a => `${a.source}_${a.message}`));
    setDismissedKeys(allKeys);
  };

  if (activeAlerts.length === 0) return null;

  return (
    <aside 
      aria-label="系统告警通知"
      className="fixed top-20 right-4 sm:right-6 z-50 flex flex-col items-end space-y-2 pointer-events-none max-w-sm sm:max-w-md w-full animate-in slide-in-from-right-4 fade-in duration-300"
    >
      {/* Top Floating Badge Bar */}
      <div className="pointer-events-auto flex items-center space-x-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-slate-200/90 text-xs text-slate-700">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
        <span className="font-semibold">{activeAlerts.length} 条系统告警</span>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-0.5 hover:bg-slate-100 rounded text-slate-500 transition-colors"
          title={isCollapsed ? "展开告警列表" : "折叠告警"}
        >
          {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        {activeAlerts.length > 1 && !isCollapsed && (
          <button
            onClick={clearAll}
            className="text-[10px] text-slate-400 hover:text-slate-600 pl-1 border-l border-slate-200 transition-colors"
          >
            全部忽略
          </button>
        )}
      </div>

      {/* Floating Alert Cards Stack */}
      {!isCollapsed && (
        <div className="pointer-events-auto w-full space-y-2">
          {activeAlerts.map((alert) => {
            const key = `${alert.source}_${alert.message}`;
            const isCritical = alert.level === 'critical';

            return (
              <div
                key={key}
                className={`p-3.5 rounded-2xl shadow-xl border backdrop-blur-xl transition-all duration-300 hover:shadow-2xl flex items-start justify-between space-x-3 text-xs animate-in slide-in-from-top-2 fade-in ${
                  isCritical
                    ? 'bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-500/10'
                    : 'bg-amber-50/95 border-amber-200 text-amber-900 shadow-amber-500/10'
                }`}
              >
                <div className="flex items-start space-x-2.5">
                  <div className={`p-1 rounded-lg mt-0.5 shrink-0 ${isCritical ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
                    {isCritical ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{alert.source}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full uppercase font-bold border ${
                        isCritical 
                          ? 'bg-rose-100 text-rose-700 border-rose-300' 
                          : 'bg-amber-100 text-amber-700 border-amber-300'
                      }`}>
                        {alert.level}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600 font-sans">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => dismissAlert(key)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0"
                  title="关闭此提示"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
