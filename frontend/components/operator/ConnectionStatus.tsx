'use client';

import { useEffect, useState } from 'react';
import { getWebSocketClient } from '@/lib/websocket/client';
import { cn } from '@/lib/utils';

/**
 * Connection Status Component
 * 
 * Displays connection status and "Weak Signal" badge when RTT > 500ms
 */
export function ConnectionStatus() {
  const [rtt, setRTT] = useState<number>(0);
  const [averageRTT, setAverageRTT] = useState<number>(0);
  const [isDegraded, setIsDegraded] = useState<boolean>(false);

  useEffect(() => {
    const client = getWebSocketClient();

    // Update RTT values
    const updateRTT = () => {
      setRTT(client.getRTT());
      setAverageRTT(client.getAverageRTT());
      setIsDegraded(client.isDegraded());
    };

    // Initial update
    updateRTT();

    // Subscribe to RTT changes
    const unsubscribe = client.onRTTChange((currentRTT, avgRTT) => {
      setRTT(currentRTT);
      setAverageRTT(avgRTT);
      setIsDegraded(avgRTT > 500);
    });

    // Also update periodically to catch initial connection
    const interval = setInterval(updateRTT, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (averageRTT === 0) {
    return null; // Don't show until we have RTT data
  }

  return (
    <div className="flex items-center gap-3">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            isDegraded ? 'bg-amber-400 animate-pulse' : 'bg-green-400'
          )}
        />
        <span className="text-xs text-slate-400">
          {averageRTT}ms avg
        </span>
      </div>

      {/* Weak Signal Badge */}
      {isDegraded && (
        <div
          className={cn(
            'px-2 py-1 rounded-md text-xs font-medium',
            'bg-amber-500/20 text-amber-400 border border-amber-500/50',
            'animate-pulse'
          )}
        >
          ⚠️ Weak Signal
        </div>
      )}
    </div>
  );
}

