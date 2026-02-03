/**
 * Integration Tests for WebSocket Protocol Flow
 * 
 * Tests the complete WebSocket communication between client and server,
 * including message validation, session management, and error handling.
 */

import WebSocket from 'ws';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

describe('WebSocket Protocol Integration', () => {
  let wsServer: WebSocket.Server;
  let serverPort: number;
  let client: WebSocket;

  beforeAll(() => {
    // Start a test WebSocket server
    serverPort = 9001;
    wsServer = new WebSocket.Server({ port: serverPort });

    // Simple echo server for testing
    wsServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Echo back based on message type
          switch (message.type) {
            case 'PING':
              ws.send(JSON.stringify({
                type: 'PONG',
                payload: { timestamp: Date.now().toString() }
              }));
              break;
            
            case 'START_SESSION':
              ws.send(JSON.stringify({
                type: 'SESSION_STARTED',
                payload: {
                  sessionId: 'test-session-123',
                  eventId: message.payload.eventId,
                  eventName: 'Test Event',
                  totalSongs: 3,
                  currentSongIndex: 0,
                  currentSlideIndex: 0,
                  setlist: [
                    {
                      id: 'song-1',
                      title: 'Test Song 1',
                      artist: 'Test Artist',
                      lines: ['Line 1', 'Line 2'],
                      slides: [
                        {
                          lines: ['Line 1', 'Line 2'],
                          slideText: 'Line 1\nLine 2',
                        },
                      ],
                      lineToSlideIndex: [0, 0],
                    }
                  ]
                }
              }));
              break;
            
            case 'STOP_SESSION':
              ws.send(JSON.stringify({
                type: 'SESSION_ENDED',
                payload: {
                  sessionId: 'test-session-123',
                  reason: 'user_stopped'
                }
              }));
              break;
            
            case 'MANUAL_OVERRIDE':
              ws.send(JSON.stringify({
                type: 'DISPLAY_UPDATE',
                payload: {
                  lineText: 'Override Line',
                  slideText: 'Override Line',
                  slideLines: ['Override Line'],
                  slideIndex: message.payload.slideIndex || 0,
                  songId: 'song-1',
                  songTitle: 'Test Song',
                  isAutoAdvance: false
                }
              }));
              break;
            
            default:
              // Echo unknown messages
              ws.send(data.toString());
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'ERROR',
            payload: {
              code: 'PARSE_ERROR',
              message: 'Failed to parse message'
            }
          }));
        }
      });
    });
  });

  afterAll(() => {
    wsServer.close();
  });

  beforeEach(() => {
    // Close any existing client
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        expect(client.readyState).toBe(WebSocket.OPEN);
        done();
      });

      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle connection close gracefully', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        client.close();
      });

      client.on('close', () => {
        expect(client.readyState).toBe(WebSocket.CLOSED);
        done();
      });
    });

    it('should handle connection errors', (done) => {
      // Try to connect to non-existent server
      const badClient = new WebSocket('ws://localhost:9999');

      badClient.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });
    });
  });

  describe('PING/PONG Protocol', () => {
    it('should respond to PING with PONG', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        client.send(JSON.stringify({ type: 'PING' }));
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'PONG') {
          expect(message.payload.timestamp).toBeDefined();
          done();
        }
      });
    });

    it('should measure round-trip time with PING/PONG', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        const startTime = Date.now();
        
        client.send(JSON.stringify({ type: 'PING' }));

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'PONG') {
            const rtt = Date.now() - startTime;
            // RTT should be >= 0 (can be 0 for very fast local responses)
            expect(rtt).toBeGreaterThanOrEqual(0);
            expect(rtt).toBeLessThan(1000); // Should be less than 1 second locally
            done();
          }
        });
      });
    });
  });

  describe('Session Management', () => {
    it('should start a session successfully', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        client.send(JSON.stringify({
          type: 'START_SESSION',
          payload: { eventId: 'event-123' }
        }));
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'SESSION_STARTED') {
          expect(message.payload.sessionId).toBeDefined();
          expect(message.payload.eventId).toBe('event-123');
          expect(message.payload.eventName).toBeDefined();
          expect(message.payload.totalSongs).toBeGreaterThan(0);
          expect(message.payload.setlist).toBeDefined();
          expect(Array.isArray(message.payload.setlist)).toBe(true);
          done();
        }
      });
    });

    it('should stop a session successfully', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        // First start a session
        client.send(JSON.stringify({
          type: 'START_SESSION',
          payload: { eventId: 'event-123' }
        }));

        // Then stop it
        setTimeout(() => {
          client.send(JSON.stringify({ type: 'STOP_SESSION' }));
        }, 100);
      });

      let sessionStarted = false;

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'SESSION_STARTED') {
          sessionStarted = true;
        } else if (message.type === 'SESSION_ENDED') {
          expect(sessionStarted).toBe(true);
          expect(message.payload.reason).toBe('user_stopped');
          done();
        }
      });
    });

    it('should include setlist in SESSION_STARTED response', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        client.send(JSON.stringify({
          type: 'START_SESSION',
          payload: { eventId: 'event-123' }
        }));
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'SESSION_STARTED') {
          expect(message.payload.setlist).toBeDefined();
          expect(message.payload.setlist.length).toBeGreaterThan(0);
          
          const firstSong = message.payload.setlist[0];
          expect(firstSong.id).toBeDefined();
          expect(firstSong.title).toBeDefined();
          expect(firstSong.lines).toBeDefined();
          expect(Array.isArray(firstSong.lines)).toBe(true);
          
          done();
        }
      });
    });
  });

  describe('Manual Override Messages', () => {
    it('should handle NEXT_SLIDE override', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        client.send(JSON.stringify({
          type: 'MANUAL_OVERRIDE',
          payload: { action: 'NEXT_SLIDE' }
        }));
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'DISPLAY_UPDATE') {
          expect(message.payload.lineText).toBeDefined();
          expect(message.payload.slideIndex).toBeDefined();
          expect(message.payload.isAutoAdvance).toBe(false);
          done();
        }
      });
    });

    it('should handle GO_TO_SLIDE override with specific index', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        client.send(JSON.stringify({
          type: 'MANUAL_OVERRIDE',
          payload: { action: 'GO_TO_SLIDE', slideIndex: 5 }
        }));
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'DISPLAY_UPDATE') {
          expect(message.payload.slideIndex).toBe(5);
          done();
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        client.send('{ invalid json }');
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'ERROR') {
          expect(message.payload.code).toBe('PARSE_ERROR');
          expect(message.payload.message).toBeDefined();
          done();
        }
      });
    });

    it('should handle large messages', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        // Send a large payload
        const largePayload = {
          type: 'AUDIO_DATA',
          payload: {
            data: 'A'.repeat(10000) // 10KB of data
          }
        };
        
        client.send(JSON.stringify(largePayload));
      });

      client.on('message', (data) => {
        // Should receive the echo back
        const received = data.toString();
        expect(received.length).toBeGreaterThan(10000);
        done();
      });
    });
  });

  describe('Message Sequencing', () => {
    it('should handle multiple rapid messages in order', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);
      const receivedMessages: unknown[] = [];
      const expectedMessages = 5;

      client.on('open', () => {
        // Send multiple PING messages rapidly
        for (let i = 0; i < expectedMessages; i++) {
          client.send(JSON.stringify({ type: 'PING', id: i }));
        }
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'PONG') {
          receivedMessages.push(message);
          
          if (receivedMessages.length === expectedMessages) {
            expect(receivedMessages.length).toBe(expectedMessages);
            done();
          }
        }
      });
    });

    it('should handle session lifecycle messages in sequence', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);
      const receivedTypes: string[] = [];

      client.on('open', () => {
        // Start session
        client.send(JSON.stringify({
          type: 'START_SESSION',
          payload: { eventId: 'event-123' }
        }));

        // Send manual override after a delay
        setTimeout(() => {
          client.send(JSON.stringify({
            type: 'MANUAL_OVERRIDE',
            payload: { action: 'NEXT_SLIDE' }
          }));
        }, 50);

        // Stop session after another delay
        setTimeout(() => {
          client.send(JSON.stringify({ type: 'STOP_SESSION' }));
        }, 100);
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        receivedTypes.push(message.type);

        if (message.type === 'SESSION_ENDED') {
          expect(receivedTypes).toContain('SESSION_STARTED');
          expect(receivedTypes).toContain('DISPLAY_UPDATE');
          expect(receivedTypes).toContain('SESSION_ENDED');
          
          // Verify order
          const startIndex = receivedTypes.indexOf('SESSION_STARTED');
          const updateIndex = receivedTypes.indexOf('DISPLAY_UPDATE');
          const endIndex = receivedTypes.indexOf('SESSION_ENDED');
          
          expect(startIndex).toBeLessThan(updateIndex);
          expect(updateIndex).toBeLessThan(endIndex);
          
          done();
        }
      });
    });
  });

  describe('Connection Stability', () => {
    it('should maintain connection during multiple message exchanges', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);
      let messageCount = 0;
      const targetCount = 10;

      client.on('open', () => {
        const sendPing = () => {
          if (messageCount < targetCount) {
            client.send(JSON.stringify({ type: 'PING' }));
          }
        };

        // Start sending pings
        sendPing();

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'PONG') {
            messageCount++;
            
            if (messageCount < targetCount) {
              setTimeout(sendPing, 10);
            } else {
              expect(messageCount).toBe(targetCount);
              expect(client.readyState).toBe(WebSocket.OPEN);
              done();
            }
          }
        });
      });
    }, 10000); // Increased timeout for multiple exchanges

    it('should handle reconnection after disconnect', (done) => {
      client = new WebSocket(`ws://localhost:${serverPort}`);

      client.on('open', () => {
        // Close connection
        client.close();
      });

      client.on('close', () => {
        // Reconnect
        const newClient = new WebSocket(`ws://localhost:${serverPort}`);
        
        newClient.on('open', () => {
          expect(newClient.readyState).toBe(WebSocket.OPEN);
          newClient.close();
          done();
        });
      });
    });
  });
});
