/**
 * React Hook for WebSocket Connection
 * 
 * Provides a React-friendly interface to the WebSocket client
 * with typed message support
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketClient, type WebSocketState, type ClientMessage, type ServerMessage } from '../websocket/client';

export interface UseWebSocketReturn {
  state: WebSocketState;
  isConnected: boolean;
  sendMessage: (message: ClientMessage) => void;
  startSession: (eventId: string) => void;
  stopSession: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (slideIndex: number, songId?: string) => void;
  ping: () => void;
  connect: () => void;
  disconnect: () => void;
  lastMessage: ServerMessage | null;
}

/**
 * React hook for WebSocket connection
 * 
 * @param autoConnect - Whether to automatically connect on mount (default: true)
 * @returns WebSocket connection state and methods
 */
export function useWebSocket(autoConnect = true): UseWebSocketReturn {
  const client = getWebSocketClient();
  const [state, setState] = useState<WebSocketState>(client.getState());
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const messageHandlerRef = useRef<((message: ServerMessage) => void) | null>(null);

  // Update state when WebSocket state changes
  useEffect(() => {
    const unsubscribe = client.onStateChange((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [client]);

  // Handle incoming messages
  useEffect(() => {
    messageHandlerRef.current = (message: ServerMessage) => {
      setLastMessage(message);
    };

    const unsubscribe = client.onMessage(messageHandlerRef.current);

    return unsubscribe;
  }, [client]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && state === 'disconnected') {
      client.connect();
    }

    // Cleanup on unmount
    return () => {
      if (autoConnect) {
        client.disconnect();
      }
    };
  }, [autoConnect, client, state]);

  const sendMessage = useCallback(
    (message: ClientMessage) => {
      client.send(message);
    },
    [client]
  );

  const startSession = useCallback(
    (eventId: string) => {
      client.startSession(eventId);
    },
    [client]
  );

  const stopSession = useCallback(() => {
    client.stopSession();
  }, [client]);

  const nextSlide = useCallback(() => {
    client.manualOverride('NEXT_SLIDE');
  }, [client]);

  const prevSlide = useCallback(() => {
    client.manualOverride('PREV_SLIDE');
  }, [client]);

  const goToSlide = useCallback(
    (slideIndex: number, songId?: string) => {
      client.manualOverride('GO_TO_SLIDE', slideIndex, songId);
    },
    [client]
  );

  const ping = useCallback(() => {
    client.ping();
  }, [client]);

  const connect = useCallback(() => {
    client.connect();
  }, [client]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  return {
    state,
    isConnected: client.isConnected(),
    sendMessage,
    startSession,
    stopSession,
    nextSlide,
    prevSlide,
    goToSlide,
    ping,
    connect,
    disconnect,
    lastMessage,
  };
}

