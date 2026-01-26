import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ServerMessage } from '../types';

// We need to mock the latency tracker before importing the client
vi.mock('../../latency/tracker', () => ({
  getLatencyTracker: () => ({
    recordSend: vi.fn(),
    recordReceive: vi.fn(),
    getMetrics: vi.fn(() => ({ count: 0, average: 0, p50: 0, p95: 0, p99: 0 })),
  }),
}));

describe('WebSocketClient', () => {
  let mockWebSocket: any;
  let mockWebSocketConstructor: any;
  let WebSocketClient: any;
  let client: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock WebSocket
    mockWebSocket = {
      readyState: 0, // CONNECTING
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
    };

    mockWebSocketConstructor = vi.fn(() => mockWebSocket);
    global.WebSocket = mockWebSocketConstructor as any;

    // Mock environment variable
    process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:3001';

    // Clear module cache and reimport to get fresh instance
    vi.resetModules();
    const clientModule = await import('../client');
    client = clientModule.getWebSocketClient();
  });

  afterEach(() => {
    // Cleanup client
    if (client) {
      client.disconnect();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_WS_URL;
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with disconnected state', () => {
      expect(client.getState()).toBe('disconnected');
    });

    it('should not connect automatically', () => {
      expect(client.isConnected()).toBe(false);
      expect(mockWebSocketConstructor).not.toHaveBeenCalled();
    });

    it('should handle missing WS_URL gracefully', async () => {
      delete process.env.NEXT_PUBLIC_WS_URL;
      vi.resetModules();
      const clientModule = await import('../client');
      const freshClient = clientModule.getWebSocketClient();
      expect(freshClient.getState()).toBe('disconnected');
    });
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket server', () => {
      client.connect();

      expect(mockWebSocketConstructor).toHaveBeenCalledWith('ws://localhost:3001');
      expect(client.getState()).toBe('connecting');
    });

    it('should update state to connected on open', () => {
      const stateHandler = vi.fn();
      client.onStateChange(stateHandler);

      client.connect();
      expect(client.getState()).toBe('connecting');
      expect(stateHandler).toHaveBeenCalledWith('connecting');

      // Simulate connection open
      mockWebSocket.readyState = 1; // OPEN
      mockWebSocket.onopen?.();

      expect(client.getState()).toBe('connected');
      expect(stateHandler).toHaveBeenCalledWith('connected');
    });

    it('should update state to disconnected on close', () => {
      const stateHandler = vi.fn();
      client.onStateChange(stateHandler);

      client.connect();
      mockWebSocket.readyState = 1; // OPEN
      mockWebSocket.onopen?.();

      // Simulate close
      mockWebSocket.readyState = 3; // CLOSED
      mockWebSocket.onclose?.();

      expect(client.getState()).toBe('disconnected');
      expect(stateHandler).toHaveBeenCalledWith('disconnected');
    });

    it('should update state to error on error event', () => {
      const stateHandler = vi.fn();
      client.onStateChange(stateHandler);

      client.connect();
      
      // Simulate error
      mockWebSocket.onerror?.(new Event('error'));

      expect(client.getState()).toBe('error');
      expect(stateHandler).toHaveBeenCalledWith('error');
    });

    it('should disconnect and cleanup', () => {
      client.connect();
      mockWebSocket.readyState = 1; // OPEN
      mockWebSocket.onopen?.();

      client.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should not connect if already connecting', () => {
      client.connect();
      const firstCallCount = mockWebSocketConstructor.mock.calls.length;

      // Try to connect again while connecting
      client.connect();

      expect(mockWebSocketConstructor.mock.calls.length).toBe(firstCallCount);
    });

    it('should not connect if already connected', () => {
      client.connect();
      mockWebSocket.readyState = 1; // OPEN
      mockWebSocket.onopen?.();

      const callCount = mockWebSocketConstructor.mock.calls.length;

      // Try to connect again while connected
      client.connect();

      expect(mockWebSocketConstructor.mock.calls.length).toBe(callCount);
    });
  });

  describe('Message Handling', () => {
    it('should parse and handle incoming JSON messages', () => {
      const messageHandler = vi.fn();
      client.onMessage(messageHandler);

      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      const serverMessage: ServerMessage = {
        type: 'SESSION_STARTED',
        payload: {
          sessionId: '123',
          eventId: 'evt-1',
          eventName: 'Test Event',
          totalSongs: 5,
          currentSongIndex: 0,
          currentSlideIndex: 0,
        },
      };

      // Simulate incoming message
      mockWebSocket.onmessage?.({ data: JSON.stringify(serverMessage) });

      expect(messageHandler).toHaveBeenCalledWith(serverMessage);
    });

    it('should handle multiple message handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      client.onMessage(handler1);
      client.onMessage(handler2);

      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      const message: ServerMessage = {
        type: 'TRANSCRIPT_UPDATE',
        payload: { text: 'Hello', isFinal: false },
      };

      mockWebSocket.onmessage?.({ data: JSON.stringify(message) });

      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
    });

    it('should handle PONG messages for RTT calculation', () => {
      const rttHandler = vi.fn();
      client.onRTTChange(rttHandler);

      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      // Trigger ping (which sets pending timestamp)
      client.ping();
      
      // Advance time by 50ms
      vi.advanceTimersByTime(50);

      // Simulate PONG response
      const pongMessage: ServerMessage = {
        type: 'PONG',
        payload: { timestamp: Date.now().toString() },
      };
      mockWebSocket.onmessage?.({ data: JSON.stringify(pongMessage) });

      // RTT should be approximately 50ms
      expect(rttHandler).toHaveBeenCalled();
      const calls = rttHandler.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const [currentRTT, averageRTT] = calls[calls.length - 1];
      expect(currentRTT).toBeGreaterThanOrEqual(45);
      expect(currentRTT).toBeLessThanOrEqual(55);
    });

    it('should handle malformed JSON gracefully', () => {
      const messageHandler = vi.fn();
      client.onMessage(messageHandler);

      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Send invalid JSON
      mockWebSocket.onmessage?.({ data: '{ invalid json }' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(messageHandler).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should unsubscribe message handlers', () => {
      const handler = vi.fn();
      const unsubscribe = client.onMessage(handler);

      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      const message: ServerMessage = {
        type: 'TRANSCRIPT_UPDATE',
        payload: { text: 'Test', isFinal: false },
      };

      mockWebSocket.onmessage?.({ data: JSON.stringify(message) });
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Send another message
      mockWebSocket.onmessage?.({ data: JSON.stringify(message) });
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('Message Sending', () => {
    it('should send START_SESSION message', () => {
      client.connect();
      mockWebSocket.readyState = 1; // OPEN
      mockWebSocket.onopen?.();

      client.startSession('event-123');

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'START_SESSION',
          payload: { eventId: 'event-123' },
        })
      );
    });

    it('should send MANUAL_OVERRIDE message for NEXT_SLIDE', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      client.manualOverride('NEXT_SLIDE');

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'MANUAL_OVERRIDE',
          payload: { action: 'NEXT_SLIDE' },
        })
      );
    });

    it('should send MANUAL_OVERRIDE message for GO_TO_SLIDE with parameters', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      client.manualOverride('GO_TO_SLIDE', 5, 'song-456');

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'MANUAL_OVERRIDE',
          payload: { action: 'GO_TO_SLIDE', slideIndex: 5, songId: 'song-456' },
        })
      );
    });

    it('should send STOP_SESSION message', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      client.stopSession();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'STOP_SESSION',
        })
      );
    });

    it('should send PING message', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      client.ping();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'PING',
        })
      );
    });

    it('should not send when not connected', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.startSession('event-123');

      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Cannot send message: WebSocket not connected'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt to reconnect on disconnect', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      // Simulate disconnect
      mockWebSocket.readyState = 3;
      mockWebSocket.onclose?.();

      expect(client.getState()).toBe('disconnected');

      // Advance time to trigger reconnect (1 second initial delay)
      vi.advanceTimersByTime(1000);

      // Should attempt to reconnect
      expect(mockWebSocketConstructor.mock.calls.length).toBeGreaterThan(1);
    });

    it('should use exponential backoff for reconnection', () => {
      client.connect();

      // Simulate multiple failed connections
      for (let i = 0; i < 3; i++) {
        mockWebSocket.readyState = 3;
        mockWebSocket.onclose?.();
        
        // Calculate expected delay: 1000 * 2^i
        const expectedDelay = 1000 * Math.pow(2, i);
        vi.advanceTimersByTime(expectedDelay);
      }

      // Should have attempted reconnection with increasing delays
      expect(mockWebSocketConstructor.mock.calls.length).toBeGreaterThan(1);
    });

    it('should not reconnect when explicitly disconnected', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      const callCount = mockWebSocketConstructor.mock.calls.length;

      client.disconnect();

      // Advance time
      vi.advanceTimersByTime(10000);

      // Should not attempt to reconnect
      expect(mockWebSocketConstructor.mock.calls.length).toBe(callCount);
    });

    it('should stop reconnecting after max attempts', () => {
      client.connect();

      const initialCallCount = mockWebSocketConstructor.mock.calls.length;

      // Simulate 11 failed connections (max is 10)
      for (let i = 0; i < 11; i++) {
        mockWebSocket.readyState = 3;
        mockWebSocket.onclose?.();
        vi.advanceTimersByTime(30000); // Max delay
      }

      // Should have attempted max 10 reconnections (initial + 10 retries = 11 total)
      expect(mockWebSocketConstructor.mock.calls.length).toBeLessThanOrEqual(initialCallCount + 10);
    });
  });

  describe('RTT Monitoring', () => {
    it('should automatically send ping on connect', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      // Should have sent initial ping
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'PING' })
      );
    });

    it('should send periodic pings', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      const initialPingCount = mockWebSocket.send.mock.calls.filter(
        (call: any) => call[0].includes('PING')
      ).length;

      // Advance time by 5 seconds (ping interval)
      vi.advanceTimersByTime(5000);

      const afterPingCount = mockWebSocket.send.mock.calls.filter(
        (call: any) => call[0].includes('PING')
      ).length;

      expect(afterPingCount).toBeGreaterThan(initialPingCount);
    });

    it('should calculate average RTT from history', () => {
      const rttHandler = vi.fn();
      client.onRTTChange(rttHandler);

      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      // Send multiple pings and pongs with different RTTs
      const rtts = [50, 60, 55, 70, 65];
      
      rtts.forEach((rtt) => {
        client.ping();
        vi.advanceTimersByTime(rtt);
        
        const pong: ServerMessage = {
          type: 'PONG',
          payload: { timestamp: Date.now().toString() },
        };
        mockWebSocket.onmessage?.({ data: JSON.stringify(pong) });
      });

      // Get the last call's average RTT
      const calls = rttHandler.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const [, averageRTT] = calls[calls.length - 1];

      // Average should be (50+60+55+70+65) / 5 = 60
      expect(averageRTT).toBeCloseTo(60, 0);
    });

    it('should detect degraded connection', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      // Simulate multiple high RTTs to build average over 500ms
      for (let i = 0; i < 5; i++) {
        client.ping();
        vi.advanceTimersByTime(600);
        
        const pong: ServerMessage = {
          type: 'PONG',
          payload: { timestamp: Date.now().toString() },
        };
        mockWebSocket.onmessage?.({ data: JSON.stringify(pong) });
      }

      expect(client.isDegraded()).toBe(true);
    });

    it('should stop ping interval on disconnect', () => {
      client.connect();
      mockWebSocket.readyState = 1;
      mockWebSocket.onopen?.();

      client.disconnect();

      const pingCount = mockWebSocket.send.mock.calls.filter(
        (call: any) => call[0].includes('PING')
      ).length;

      // Advance time
      vi.advanceTimersByTime(10000);

      const afterDisconnectPingCount = mockWebSocket.send.mock.calls.filter(
        (call: any) => call[0].includes('PING')
      ).length;

      // No new pings should be sent
      expect(afterDisconnectPingCount).toBe(pingCount);
    });
  });

  describe('State Change Handlers', () => {
    it('should notify state change handlers on state transitions', () => {
      const handler = vi.fn();
      client.onStateChange(handler);

      // Simulate state transition by triggering WebSocket events
      mockWebSocket.readyState = 3;
      mockWebSocket.onclose?.();
      
      // Should be called with disconnected
      expect(handler).toHaveBeenCalledWith('disconnected');
    });

    it('should unsubscribe state change handlers', () => {
      const handler = vi.fn();
      const unsubscribe = client.onStateChange(handler);

      // Unsubscribe immediately
      unsubscribe();

      // Now try to trigger state changes
      mockWebSocket.readyState = 3;
      mockWebSocket.onclose?.();
      
      // Handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });

    it('should only notify on actual state changes', () => {
      const handler = vi.fn();
      client.onStateChange(handler);

      const currentState = client.getState();

      // If already in a stable state, registering handler shouldn't trigger
      expect(handler).not.toHaveBeenCalled();
      
      // Verify that setState only fires on actual changes
      if (currentState === 'disconnected') {
        client.connect();
        const calls = handler.mock.calls.length;
        // Try to "connect" again (should not trigger another event)
        client.connect();
        expect(handler.mock.calls.length).toBe(calls);
      }
    });
  });
});
