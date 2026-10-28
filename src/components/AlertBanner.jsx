import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export default function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {alerts.map((alert, idx) => {
        const isCritical = alert.level === 'critical';
        return (
          <div
            key={idx}
            className={`px-4 py-2.5 rounded-xl border flex items-center justify-between text-xs animate-in slide-in-from-top-2 duration-200 ${
              isCritical
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {isCritical ? (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              )}
              <span className="font-semibold">{alert.source}:</span>
              <span>{alert.message}</span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border bg-white/70">
              {alert.level}
            </span>
          </div>
        );
      })}
    </div>
  );
}
