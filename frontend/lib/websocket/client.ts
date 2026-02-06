/**
 * WebSocket Client Utility
 * 
 * Manages WebSocket connection to Railway backend with:
 * - Connection state management
 * - Automatic reconnection with exponential backoff
 * - Message sending and receiving
 * - Event-based message handling
 * - Type-safe message protocol
 * - Latency tracking for performance monitoring
 */

import type { ClientMessage, ServerMessage } from './types';
import { getLatencyTracker } from '../latency/tracker';

export type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'error';

// Re-export types for convenience
export type { ClientMessage, ServerMessage } from './types';

type MessageHandler = (message: ServerMessage) => void;
type StateChangeHandler = (state: WebSocketState) => void;
type RTTChangeHandler = (rtt: number, averageRTT: number) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private state: WebSocketState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private stateChangeHandlers: Set<StateChangeHandler> = new Set();
  private rttChangeHandlers: Set<RTTChangeHandler> = new Set();
  private shouldReconnect = true;
  private latencyTracker = getLatencyTracker();
  private messageIdCounter = 0;
  
  // RTT Monitoring
  private pingInterval: NodeJS.Timeout | null = null;
  private pingIntervalMs = 5000; // Ping every 5 seconds
  private rttHistory: number[] = [];
  private maxRttHistorySize = 5; // Keep last 5 RTT values
  private currentRTT: number = 0;
  private averageRTT: number = 0;
  private pendingPingTimestamp: number | null = null;

  constructor() {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      console.warn('NEXT_PUBLIC_WS_URL not set. WebSocket will not connect.');
      this.url = '';
      return;
    }
    this.url = wsUrl;
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (!this.url) {
      console.error('WebSocket URL not configured');
      this.setState('error');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting or connected');
      return;
    }

    this.setState('connecting');
    this.shouldReconnect = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // Reset delay on successful connection
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          
          // Handle PONG for RTT measurement (skip latency tracker - PONG is handled by RTT system)
          if (message.type === 'PONG' && this.pendingPingTimestamp !== null) {
            const rtt = Date.now() - this.pendingPingTimestamp;
            this.updateRTT(rtt);
            this.pendingPingTimestamp = null;
            // Don't track PONG in latency tracker - it's handled by RTT system
            this.handleMessage(message);
            return;
          }
          
          // Track latency for messages with timing metadata (except PONG)
          if ('timing' in message && message.timing && message.type !== 'PONG') {
            // Use message type as identifier (simplified - in production might use correlation IDs)
            const messageId = `${message.type}_${Date.now()}`;
            this.latencyTracker.recordReceive(messageId, message.type, message.timing);
          }
          
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.setState('error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.setState('disconnected');
        this.ws = null;
        this.stopPingInterval();

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.setState('error');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPingInterval();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  /**
   * Send a typed message to the server
   */
  send(message: ClientMessage, micCaptureTime?: number): void {
    if (!this.isConnected() || !this.ws) {
      console.error('Cannot send message: WebSocket not connected');
      return;
    }

    try {
      // Generate message ID for latency tracking
      const messageId = `${message.type}_${++this.messageIdCounter}_${Date.now()}`;
      
      // Record send time for latency tracking
      this.latencyTracker.recordSend(messageId, micCaptureTime);
      
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  /**
   * Send START_SESSION message
   */
  startSession(eventId: string): void {
    this.send({ type: 'START_SESSION', payload: { eventId } });
  }

  /**
   * Send UPDATE_EVENT_SETTINGS message
   */
  updateEventSettings(settings: { projectorFont?: string; bibleMode?: boolean; bibleVersionId?: string | null; bibleFollow?: boolean }): void {
    this.send({ type: 'UPDATE_EVENT_SETTINGS', payload: settings });
  }

  /**
   * Send MANUAL_OVERRIDE message
   */
  manualOverride(action: 'NEXT_SLIDE' | 'PREV_SLIDE' | 'GO_TO_SLIDE', slideIndex?: number, songId?: string): void {
    this.send({ type: 'MANUAL_OVERRIDE', payload: { action, slideIndex, songId } });
  }

  /**
   * Send STOP_SESSION message
   */
  stopSession(): void {
    this.send({ type: 'STOP_SESSION' });
  }

  /**
   * Send PING message
   */
  ping(): void {
    this.pendingPingTimestamp = Date.now();
    this.send({ type: 'PING' });
  }

  /**
   * Get current RTT
   */
  getRTT(): number {
    return this.currentRTT;
  }

  /**
   * Get average RTT
   */
  getAverageRTT(): number {
    return this.averageRTT;
  }

  /**
   * Check if connection is degraded (average RTT > 500ms)
   */
  isDegraded(): boolean {
    return this.averageRTT > 500;
  }

  /**
   * Register an RTT change handler
   */
  onRTTChange(handler: RTTChangeHandler): () => void {
    this.rttChangeHandlers.add(handler);
    return () => {
      this.rttChangeHandlers.delete(handler);
    };
  }

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Register a state change handler
   */
  onStateChange(handler: StateChangeHandler): () => void {
    this.stateChangeHandlers.add(handler);
    return () => {
      this.stateChangeHandlers.delete(handler);
    };
  }

  /**
   * Set connection state and notify handlers
   */
  private setState(newState: WebSocketState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.stateChangeHandlers.forEach((handler) => handler(newState));
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: ServerMessage): void {
    this.messageHandlers.forEach((handler) => handler(message));
  }

  /**
   * Start automatic PING interval for RTT monitoring
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      return; // Already started
    }

    // Send initial ping
    this.ping();

    // Set up interval
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.ping();
      }
    }, this.pingIntervalMs);
  }

  /**
   * Stop automatic PING interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.pendingPingTimestamp = null;
  }

  /**
   * Update RTT values and notify handlers
   */
  private updateRTT(rtt: number): void {
    this.currentRTT = rtt;

    // Add to history
    this.rttHistory.push(rtt);
    if (this.rttHistory.length > this.maxRttHistorySize) {
      this.rttHistory.shift();
    }

    // Calculate average
    const sum = this.rttHistory.reduce((acc, val) => acc + val, 0);
    this.averageRTT = Math.round(sum / this.rttHistory.length);

    // Notify handlers
    this.rttChangeHandlers.forEach((handler) => handler(this.currentRTT, this.averageRTT));
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

// Singleton instance
let clientInstance: WebSocketClient | null = null;

/**
 * Get the WebSocket client instance (singleton)
 */
export function getWebSocketClient(): WebSocketClient {
  if (!clientInstance) {
    clientInstance = new WebSocketClient();
  }
  return clientInstance;
}
