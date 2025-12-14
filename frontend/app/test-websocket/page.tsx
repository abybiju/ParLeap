import { WebSocketTest } from '@/components/WebSocketTest';
import { LatencyMonitor } from '@/components/dev/LatencyMonitor';

/**
 * Public WebSocket Test Page
 * 
 * This page is accessible without authentication for testing purposes
 */
export default function WebSocketTestPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">WebSocket Protocol Test</h1>
          <p className="text-slate-300">
            Test the WebSocket connection and protocol without authentication
          </p>
        </div>
        <WebSocketTest />
      </div>
      <LatencyMonitor />
    </main>
  );
}

