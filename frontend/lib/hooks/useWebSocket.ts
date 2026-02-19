/**
 * React Hook for WebSocket Connection
 * 
 * Provides a React-friendly interface to the WebSocket client
 * with typed message support
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketClient, type WebSocketState, type ClientMessage, type ServerMessage } from '../websocket/client';
import { useSlideCache } from '../stores/slideCache';
import { isSessionStartedMessage, isDisplayUpdateMessage } from '../websocket/types';

export interface UseWebSocketReturn {
  state: WebSocketState;
  isConnected: boolean;
  sendMessage: (message: ClientMessage) => void;
  startSession: (eventId: string, options?: { smartListenEnabled?: boolean }) => void;
  updateEventSettings: (settings: { projectorFont?: string; bibleMode?: boolean; bibleVersionId?: string | null; bibleFollow?: boolean; smartListenEnabled?: boolean; backgroundImageUrl?: string | null; backgroundMediaType?: string | null }) => void;
  stopSession: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (slideIndex: number, songId?: string) => void;
  /** Jump to setlist item by index (songs, Bible, media). Prefer over goToSlide when using polymorphic setlist. */
  goToItem: (itemIndex: number, itemId?: string) => void;
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
  const slideCache = useSlideCache();

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

      // Cache setlist when session starts
      if (isSessionStartedMessage(message)) {
        console.log(`[useWebSocket] Received SESSION_STARTED: ${message.payload.totalSongs} songs, setlist:`, message.payload.setlist?.length ?? 0, `setlistItems:`, message.payload.setlistItems?.length ?? 0);
        if (message.payload.setlist && message.payload.setlist.length > 0) {
          slideCache.cacheSetlist(
            message.payload.eventId,
            message.payload.eventName,
            message.payload.setlist.map((song) => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              lines: song.lines,
              slides: song.slides,
              lineToSlideIndex: song.lineToSlideIndex,
            })),
            message.payload.setlistItems // Include polymorphic setlist items
          );
          // Preload initial slides
          slideCache.preloadNextSlides(message.payload.currentSongIndex, message.payload.currentSlideIndex);
        } else {
          console.warn(`[useWebSocket] SESSION_STARTED received but setlist is empty or missing`);
        }
      }

      // Preload next slides when display updates
      if (isDisplayUpdateMessage(message)) {
        const receivedAt = Date.now();
        console.log(`[WS] ⏱️ DISPLAY_UPDATE received at ${receivedAt}`);
        // #region agent log
        const p = message.payload as { slideImageUrl?: string; slideVideoUrl?: string; songTitle?: string };
        fetch('http://127.0.0.1:7243/ingest/6095c691-a3e3-4d5f-8474-ddde2a07b74e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'useWebSocket.ts:messageHandler',
            message: 'DISPLAY_UPDATE received',
            data: {
              hasSlideImageUrl: Boolean(p.slideImageUrl),
              hasSlideVideoUrl: Boolean(p.slideVideoUrl),
              songTitle: String(p.songTitle ?? '').slice(0, 50),
            },
            timestamp: receivedAt,
            hypothesisId: 'H3',
          }),
        }).catch(() => {});
        // #endregion
        // Find current song index from cached setlist
        const setlist = slideCache.setlist;
        if (setlist) {
          const songIndex = setlist.songs.findIndex((s) => s.id === message.payload.songId);
          if (songIndex !== -1) {
            slideCache.preloadNextSlides(songIndex, message.payload.slideIndex);
          }
        }
      }
    };

    const unsubscribe = client.onMessage(messageHandlerRef.current);

    return unsubscribe;
  }, [client, slideCache]);

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
    (eventId: string, options?: { smartListenEnabled?: boolean }) => {
      client.startSession(eventId, options);
    },
    [client]
  );

  const updateEventSettings = useCallback(
    (settings: { projectorFont?: string; bibleMode?: boolean; bibleVersionId?: string | null; bibleFollow?: boolean; smartListenEnabled?: boolean; backgroundImageUrl?: string | null }) => {
      client.updateEventSettings(settings);
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

  const goToItem = useCallback(
    (itemIndex: number, itemId?: string) => {
      client.manualOverride('GO_TO_ITEM', undefined, undefined, itemIndex, itemId);
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
    updateEventSettings,
    stopSession,
    nextSlide,
    prevSlide,
    goToSlide,
    goToItem,
    ping,
    connect,
    disconnect,
    lastMessage,
  };
}
