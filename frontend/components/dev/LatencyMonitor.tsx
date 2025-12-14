'use client';

import { useEffect, useState } from 'react';
import { getLatencyTracker, type LatencyMetrics } from '@/lib/latency/tracker';
import { cn } from '@/lib/utils';

/**
 * Latency Monitor (Dev Tool)
 * 
 * Displays real-time latency metrics in a corner overlay.
 * Only visible in development mode.
 */
export function LatencyMonitor() {
  const [metrics, setMetrics] = useState<LatencyMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const tracker = getLatencyTracker();
    
    // Update metrics every 100ms
    const interval = setInterval(() => {
      const latest = tracker.getLatest();
      if (latest) {
        setMetrics(latest.metrics);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Don't render in production
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!metrics) {
    return null;
  }

  const getColor = (value: number, threshold: number) => {
    if (value <= threshold * 0.5) return 'text-green-400';
    if (value <= threshold) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTotalColor = () => {
    if (metrics.total <= 250) return 'text-green-400';
    if (metrics.total <= 500) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 rounded-lg border border-white/10 bg-black/90 p-3 shadow-lg backdrop-blur-sm',
        !isVisible && 'hidden'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-white">Latenc-o-meter</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-white text-xs"
          aria-label="Close latency monitor"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-1 text-xs font-mono">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Mic → Network:</span>
          <span className={getColor(metrics.micToNetwork, 50)}>
            {metrics.micToNetwork}ms
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Network → Server:</span>
          <span className={getColor(metrics.networkToServer, 100)}>
            {metrics.networkToServer}ms
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">AI Processing:</span>
          <span className={getColor(metrics.aiProcessing, 300)}>
            {metrics.aiProcessing}ms
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Server → Client:</span>
          <span className={getColor(metrics.serverToClient, 50)}>
            {metrics.serverToClient}ms
          </span>
        </div>
        
        <div className="border-t border-white/10 pt-1 mt-1 flex justify-between gap-4">
          <span className="text-slate-300 font-semibold">Total:</span>
          <span className={cn('font-semibold', getTotalColor())}>
            {metrics.total}ms
          </span>
        </div>
      </div>
    </div>
  );
}

