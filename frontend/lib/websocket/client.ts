/**
 * WebSocket Client Utility
 * 
 * Manages WebSocket connection to Railway backend with:
 * - Connection state management
 * - Automatic reconnection with exponential backoff
 * - Message sending and receiving
 * - Event-based message handling
 * - Type-safe message protocol
 */

import type { ClientMessage, ServerMessage } from './types';

export type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'error';

// Re-export types for convenience
export type { ClientMessage, ServerMessage } from './types';

type MessageHandler = (message: ServerMessage) => void;
type StateChangeHandler = (state: WebSocketState) => void;

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
  private shouldReconnect = true;

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
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
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
  send(message: ClientMessage): void {
    if (!this.isConnected() || !this.ws) {
      console.error('Cannot send message: WebSocket not connected');
      return;
    }

    try {
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
    this.send({ type: 'PING' });
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

