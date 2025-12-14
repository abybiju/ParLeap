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
    
    // If mic capture time is provided, calculate mic → network latency
    if (micCaptureTime !== undefined) {
      const micToNetwork = sendTime - micCaptureTime;
      // Store this for later use when we receive the response
      this.sendTimestamps.set(`${messageId}_mic`, micCaptureTime);
    }
  }

  /**
   * Record when a response is received from the server
   */
  recordReceive(
    messageId: string,
    messageType: string,
    timing?: TimingMetadata
  ): LatencyMetrics | null {
    const sendTime = this.sendTimestamps.get(messageId);
    if (!sendTime) {
      console.warn(`[LatencyTracker] No send timestamp found for message: ${messageId}`);
      return null;
    }

    const receiveTime = Date.now();
    const micCaptureTime = this.sendTimestamps.get(`${messageId}_mic`);

    // Calculate metrics
    const metrics: LatencyMetrics = {
      micToNetwork: micCaptureTime !== undefined ? sendTime - micCaptureTime : 0,
      networkToServer: timing ? timing.serverReceivedAt - sendTime : 0,
      aiProcessing: timing ? timing.processingTimeMs : 0,
      serverToClient: timing ? receiveTime - timing.serverSentAt : receiveTime - sendTime,
      total: receiveTime - (micCaptureTime ?? sendTime),
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

