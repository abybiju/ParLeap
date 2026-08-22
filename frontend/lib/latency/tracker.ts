/**
 * Latency Tracker
 * 
 * Tracks latency at each stage of the pipeline:
 * - Mic → Network: Time from audio capture to message send
 * - Network → Server: Time from send to server receive
 * - AI Processing: Time spent on server processing
 * - Total: End-to-end latency
 */

import type { TimingMetadata } from '../websocket/types';

export interface LatencyMetrics {
  micToNetwork: number;      // ms: Audio capture → Network send
  networkToServer: number;   // ms: Network send → Server receive
  aiProcessing: number;      // ms: Server processing time
  serverToClient: number;    // ms: Server send → Client receive
  total: number;             // ms: End-to-end latency
}

export interface LatencyMeasurement {
  messageType: string;
  metrics: LatencyMetrics;
  timestamp: number;
}

/**
 * Track latency for a message flow
 */
export class LatencyTracker {
  private sendTimestamps = new Map<string, number>();
  private measurements: LatencyMeasurement[] = [];
  private maxMeasurements = 100; // Keep last 100 measurements

  /**
   * Record when a message is sent to the server
   */
  recordSend(messageId: string, micCaptureTime?: number): void {
    const sendTime = Date.now();
    this.sendTimestamps.set(messageId, sendTime);
    
    // If mic capture time is provided, store it for later use when we receive the response
    if (micCaptureTime !== undefined) {
      this.sendTimestamps.set(`${messageId}_mic`, micCaptureTime);
    }
    // AUDIO_DATA is sent ~15×/s for the whole service; never let this map grow unbounded.
    while (this.sendTimestamps.size > LatencyTracker.MAX_PENDING_SENDS) {
      const oldest = this.sendTimestamps.keys().next().value;
      if (oldest === undefined) break;
      this.sendTimestamps.delete(oldest);
    }
  }

  private static readonly MAX_PENDING_SENDS = 256;

  /**
   * Record when a response is received from the server
   */
  recordReceive(
    messageId: string,
    messageType: string,
    timing?: TimingMetadata
  ): LatencyMetrics | null {
    const receiveTime = Date.now();
    const sendTime = this.sendTimestamps.get(messageId);
    const micCaptureTime = this.sendTimestamps.get(`${messageId}_mic`);

    // Most server messages (DISPLAY_UPDATE, SESSION_STARTED, BIBLE_STATUS, …) are pushed in
    // response to audio, not to a correlated request, so there is usually no send timestamp.
    // Measure what we can from the server's timing metadata instead of bailing out.
    if (!sendTime && !timing) {
      return null;
    }

    const metrics: LatencyMetrics = {
      micToNetwork: sendTime !== undefined && micCaptureTime !== undefined ? sendTime - micCaptureTime : 0,
      networkToServer: timing && sendTime !== undefined ? timing.serverReceivedAt - sendTime : 0,
      aiProcessing: timing ? timing.processingTimeMs : 0,
      serverToClient: timing ? Math.max(0, receiveTime - timing.serverSentAt) : sendTime !== undefined ? receiveTime - sendTime : 0,
      total: sendTime !== undefined
        ? receiveTime - (micCaptureTime ?? sendTime)
        : timing
        ? Math.max(0, receiveTime - timing.serverReceivedAt)
        : 0,
    };

    // Store measurement
    this.measurements.push({
      messageType,
      metrics,
      timestamp: receiveTime,
    });

    // Keep only last N measurements
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }

    // Clean up timestamps
    this.sendTimestamps.delete(messageId);
    this.sendTimestamps.delete(`${messageId}_mic`);

    return metrics;
  }

  /**
   * Get the latest measurement
   */
  getLatest(): LatencyMeasurement | null {
    return this.measurements.length > 0
      ? this.measurements[this.measurements.length - 1]
      : null;
  }

  /**
   * Get average metrics for a specific message type
   */
  getAverage(messageType?: string): LatencyMetrics | null {
    const filtered = messageType
      ? this.measurements.filter((m) => m.messageType === messageType)
      : this.measurements;

    if (filtered.length === 0) {
      return null;
    }

    const sum = filtered.reduce(
      (acc, m) => ({
        micToNetwork: acc.micToNetwork + m.metrics.micToNetwork,
        networkToServer: acc.networkToServer + m.metrics.networkToServer,
        aiProcessing: acc.aiProcessing + m.metrics.aiProcessing,
        serverToClient: acc.serverToClient + m.metrics.serverToClient,
        total: acc.total + m.metrics.total,
      }),
      {
        micToNetwork: 0,
        networkToServer: 0,
        aiProcessing: 0,
        serverToClient: 0,
        total: 0,
      }
    );

    const count = filtered.length;
    return {
      micToNetwork: Math.round(sum.micToNetwork / count),
      networkToServer: Math.round(sum.networkToServer / count),
      aiProcessing: Math.round(sum.aiProcessing / count),
      serverToClient: Math.round(sum.serverToClient / count),
      total: Math.round(sum.total / count),
    };
  }

  /**
   * Get all measurements
   */
  getAll(): LatencyMeasurement[] {
    return [...this.measurements];
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements = [];
    this.sendTimestamps.clear();
  }
}

// Singleton instance
let trackerInstance: LatencyTracker | null = null;

/**
 * Get the global latency tracker instance
 */
export function getLatencyTracker(): LatencyTracker {
  if (!trackerInstance) {
    trackerInstance = new LatencyTracker();
  }
  return trackerInstance;
}

