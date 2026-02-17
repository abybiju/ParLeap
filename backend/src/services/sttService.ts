/**
 * Speech-to-Text Service
 * 
 * Handles audio transcription using Google Cloud Speech-to-Text API
 * Falls back to mock transcription when Google Cloud credentials not configured
 */

import { SpeechClient } from '@google-cloud/speech';
import WebSocket from 'ws';
import type * as speechTypes from '@google-cloud/speech/build/protos/protos';

// Check if Google Cloud is configured
const isGoogleCloudConfigured = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || '';

type SttProvider = 'google' | 'elevenlabs' | 'mock';
const sttProviderEnv = (process.env.STT_PROVIDER || '').toLowerCase();
const sttProvider: SttProvider =
  sttProviderEnv === 'elevenlabs'
    ? 'elevenlabs'
    : sttProviderEnv === 'google'
    ? 'google'
    : isGoogleCloudConfigured
    ? 'google'
    : 'mock';
const isElevenLabsConfigured = sttProvider === 'elevenlabs' && elevenLabsApiKey.length > 0;

let speechClient: SpeechClient | null = null;

if (isGoogleCloudConfigured) {
  try {
    speechClient = new SpeechClient();
    console.log('✅ Google Cloud Speech-to-Text initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Google Cloud Speech client:', error);
    console.warn('⚠️  Falling back to mock transcription mode');
  }
} else {
  console.warn('⚠️  Google Cloud not configured - using mock transcription mode');
  console.warn('   Set GOOGLE_APPLICATION_CREDENTIALS in backend/.env for real STT');
}

if (sttProvider === 'elevenlabs') {
  if (!isElevenLabsConfigured) {
    console.warn('⚠️  ElevenLabs STT selected but ELEVENLABS_API_KEY missing');
    console.warn('   Falling back to mock transcription mode');
  } else {
    console.log('✅ ElevenLabs Speech-to-Text enabled');
  }
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  timestamp: Date;
}

/**
 * Configuration for audio streaming
 */
const audioConfig: speechTypes.google.cloud.speech.v1.IRecognitionConfig = {
  encoding: 1, // LINEAR16 = 1 in protobuf enum
  sampleRateHertz: 16000,
  languageCode: 'en-US',
  enableAutomaticPunctuation: true,
  model: 'default',
  useEnhanced: false, // Set to true for better accuracy (costs more)
};

const streamingConfig: speechTypes.google.cloud.speech.v1.IStreamingRecognitionConfig = {
  config: audioConfig,
  interimResults: true, // Get partial results as user speaks
};

/**
 * Mock transcription for development without Google Cloud
 * Simulates realistic transcription behavior
 */
const mockTranscriptionPhrases = [
  'Amazing grace how sweet the sound',
  'That saved a wretch like me',
  'I once was lost but now am found',
  'Was blind but now I see',
  'O Lord my God when I in awesome wonder',
  'Consider all the worlds thy hands have made',
];

let mockPhraseIndex = 0;
let mockPartialText = '';

function generateMockTranscription(audioData: Buffer): TranscriptionResult {
  void audioData;
  // Mock mode: Simulates transcription for testing
  // ⚠️ WARNING: This does NOT transcribe real audio!
  // In production, configure STT_PROVIDER=elevenlabs or Google Cloud for real transcription
  
  // Only log warning once per minute to avoid spam
  const now = Date.now();
  if (!mockTranscriptionPhrases[0] || (now % 60000) < 1000) {
    console.warn('[STT] ⚠️  MOCK MODE: Not transcribing real audio. Voice matching will NOT work.');
    console.warn('[STT] ⚠️  Configure STT_PROVIDER=elevenlabs (with ELEVENLABS_API_KEY) or Google Cloud for real transcription.');
  }
  
  // Simulate progressive transcription
  const phrase = mockTranscriptionPhrases[mockPhraseIndex % mockTranscriptionPhrases.length];
  const words = phrase.split(' ');
  
  // Add one more word each time (simulating real-time speech)
  const currentWordCount = Math.min(
    Math.floor((Date.now() % 5000) / 500) + 1,
    words.length
  );
  
  mockPartialText = words.slice(0, currentWordCount).join(' ');
  const isFinal = currentWordCount === words.length;
  
  if (isFinal) {
    mockPhraseIndex++;
    mockPartialText = '';
  }
  
  return {
    text: mockPartialText || phrase,
    isFinal,
    confidence: 0.85 + Math.random() * 0.14, // 0.85-0.99
    timestamp: new Date(),
  };
}

/**
 * Transcribe audio chunk using Google Cloud Speech-to-Text
 * Falls back to mock transcription if not configured
 */
export async function transcribeAudioChunk(
  audioBase64: string
): Promise<TranscriptionResult | null> {
  try {
    // Convert base64 to Buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    
    if (sttProvider === 'elevenlabs') {
      console.warn('[STT] ElevenLabs uses streaming mode. Ignoring chunk in transcribeAudioChunk.');
      return null;
    }

    // Use mock transcription if Google Cloud not configured
    if (!speechClient || !isGoogleCloudConfigured) {
      if (sttProvider === 'mock') {
        console.warn('[STT] ⚠️  MOCK MODE: No real STT configured. Set STT_PROVIDER=elevenlabs or configure Google Cloud.');
        console.warn('[STT] ⚠️  Voice matching will NOT work in mock mode. Configure a real STT provider.');
      }
      return generateMockTranscription(audioBuffer);
    }
    
    // Send to Google Cloud Speech-to-Text (single request mode for now)
    const audio = {
      content: audioBuffer.toString('base64'),
    };
    
    const request: speechTypes.google.cloud.speech.v1.IRecognizeRequest = {
      config: audioConfig,
      audio: audio,
    };
    
    const [response] = await speechClient.recognize(request);
    
    if (!response.results || response.results.length === 0) {
      console.log('[STT] No transcription results');
      return null;
    }
    
    // Get the best alternative
    const result = response.results[0];
    const alternative = result.alternatives?.[0];
    
    if (!alternative || !alternative.transcript) {
      console.log('[STT] No transcript in result');
      return null;
    }
    
    return {
      text: alternative.transcript,
      isFinal: true, // Single-request recognition is always final
      confidence: alternative.confidence || 0.0,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('[STT] Error transcribing audio:', error);
    return null;
  }
}

/**
 * Create a streaming recognition session
 * This is more efficient for continuous audio streaming
 * 
 * Note: This requires more complex state management
 * For now, we'll use the simpler single-request mode above
 */
type StreamCallback = (result: TranscriptionResult) => void;
type StreamEndCallback = () => void;
type StreamErrorCallback = (error: Error) => void;

export function createStreamingRecognition(): {
  write: (audioData: Buffer | string) => void;
  end: () => void;
  on: (event: 'data' | 'end' | 'error', callback: StreamCallback | StreamEndCallback | StreamErrorCallback) => void;
} {
  if (sttProvider === 'elevenlabs' && isElevenLabsConfigured) {
    const callbacks: {
      data?: StreamCallback[];
      end?: StreamEndCallback[];
      error?: StreamErrorCallback[];
    } = {};
    const pendingChunks: (Buffer | string)[] = [];
    let lastChunkSentAt = 0;
    const modelId = process.env.ELEVENLABS_MODEL_ID || 'scribe_v2_realtime';
    const languageCode = process.env.ELEVENLABS_LANGUAGE_CODE || 'en';
    const commitStrategy = process.env.ELEVENLABS_COMMIT_STRATEGY || 'vad';

    const url = new URL('wss://api.elevenlabs.io/v1/speech-to-text/realtime');
    url.searchParams.set('model_id', modelId);
    url.searchParams.set('audio_format', 'pcm_16000');
    url.searchParams.set('language_code', languageCode);
    url.searchParams.set('commit_strategy', commitStrategy);

    const socket = new WebSocket(url.toString(), {
      headers: {
        'xi-api-key': elevenLabsApiKey,
      },
    });

    const flushPending = () => {
      while (pendingChunks.length > 0 && socket.readyState === WebSocket.OPEN) {
        const chunk = pendingChunks.shift();
        if (!chunk) {
          return;
        }
        lastChunkSentAt = Date.now();
        const base64 = typeof chunk === 'string' ? chunk : chunk.toString('base64');
        socket.send(
          JSON.stringify({
            message_type: 'input_audio_chunk',
            audio_base_64: base64,
            sample_rate: 16000,
          })
        );
      }
    };

    socket.on('open', () => {
      console.log('[STT] ✅ ElevenLabs WebSocket connected');
      flushPending();
    });

    socket.on('message', (data) => {
      try {
        const payload = JSON.parse(data.toString()) as {
          message_type?: string;
          text?: string;
          confidence?: number;
        };

        if (payload.message_type === 'partial_transcript' || payload.message_type === 'committed_transcript' || payload.message_type === 'committed_transcript_with_timestamps') {
          if (lastChunkSentAt > 0) {
            const latencyMs = Date.now() - lastChunkSentAt;
            console.log(`[STT] ⏱️ latency audio_sent_to_transcript_received=${latencyMs}ms`);
          }
          const result: TranscriptionResult = {
            text: payload.text || '',
            isFinal: payload.message_type !== 'partial_transcript',
            confidence: payload.confidence ?? 0.0,
            timestamp: new Date(),
          };
          console.log(`[STT] 📝 ElevenLabs transcript: "${result.text}" (isFinal=${result.isFinal}, confidence=${result.confidence.toFixed(2)})`);
          callbacks.data?.forEach((cb) => cb(result));
        } else if (payload.message_type) {
          // Log other message types for debugging
          console.log(`[STT] 📨 ElevenLabs message: ${payload.message_type}`, payload);
        }
      } catch (error) {
        callbacks.error?.forEach((cb) => cb(error as Error));
      }
    });

    socket.on('error', (error) => {
      console.error('[STT] ❌ ElevenLabs WebSocket error:', error);
      callbacks.error?.forEach((cb) => cb(error as Error));
    });

    socket.on('close', (code, reason) => {
      console.log(`[STT] ElevenLabs WebSocket closed: code=${code}, reason=${reason?.toString() || 'none'}`);
      callbacks.end?.forEach((cb) => cb());
    });

    return {
      write: (audioData: Buffer | string) => {
        if (socket.readyState === WebSocket.OPEN) {
          lastChunkSentAt = Date.now();
          const base64 = typeof audioData === 'string' ? audioData : audioData.toString('base64');
          socket.send(
            JSON.stringify({
              message_type: 'input_audio_chunk',
              audio_base_64: base64,
              sample_rate: 16000,
            })
          );
        } else {
          pendingChunks.push(audioData);
        }
      },
      end: () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      },
      on: (event, callback) => {
        if (event === 'data') {
          callbacks.data = callbacks.data || [];
          callbacks.data.push(callback as StreamCallback);
        } else if (event === 'end') {
          callbacks.end = callbacks.end || [];
          callbacks.end.push(callback as StreamEndCallback);
        } else if (event === 'error') {
          callbacks.error = callbacks.error || [];
          callbacks.error.push(callback as StreamErrorCallback);
        }
      },
    };
  }

  if (!speechClient || !isGoogleCloudConfigured) {
    console.warn('[STT] Streaming not available - Google Cloud not configured');
    
    // Return mock streaming interface
    const mockCallbacks: { [key: string]: Array<StreamCallback | StreamEndCallback | StreamErrorCallback> } = {};
    
    return {
      write: (audioData: Buffer | string) => {
        const buf = typeof audioData === 'string' ? Buffer.from(audioData, 'base64') : audioData;
        const result = generateMockTranscription(buf);
        if (mockCallbacks['data']) {
          (mockCallbacks['data'] as StreamCallback[]).forEach(cb => (cb as StreamCallback)(result));
        }
      },
      end: () => {
        if (mockCallbacks['end']) {
          (mockCallbacks['end'] as StreamEndCallback[]).forEach(cb => (cb as StreamEndCallback)());
        }
      },
      on: (event: string, callback: StreamCallback | StreamEndCallback | StreamErrorCallback) => {
        if (!mockCallbacks[event]) {
          mockCallbacks[event] = [];
        }
        mockCallbacks[event].push(callback);
      },
    };
  }
  
  // Create real Google Cloud streaming recognition
  const stream = speechClient.streamingRecognize(streamingConfig);
  
  const callbacks: { [key: string]: Array<StreamCallback | StreamEndCallback | StreamErrorCallback> } = {};
  
  stream.on('data', (data: speechTypes.google.cloud.speech.v1.StreamingRecognizeResponse) => {
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const alternative = result.alternatives?.[0];
      
      if (alternative && alternative.transcript) {
        const transcriptionResult: TranscriptionResult = {
          text: alternative.transcript,
          // Google Cloud streaming API - isFinal is on the result
          isFinal: !!result.isFinal,
          confidence: alternative.confidence || 0.0,
          timestamp: new Date(),
        };
        
        if (callbacks['data']) {
          (callbacks['data'] as StreamCallback[]).forEach(cb => (cb as StreamCallback)(transcriptionResult));
        }
      }
    }
  });
  
  stream.on('error', (error: Error) => {
    console.error('[STT] Stream error:', error);
    if (callbacks['error']) {
      (callbacks['error'] as Array<(err: Error) => void>).forEach(cb => cb(error));
    }
  });
  
  stream.on('end', () => {
    console.log('[STT] Stream ended');
    if (callbacks['end']) {
      (callbacks['end'] as StreamEndCallback[]).forEach(cb => cb());
    }
  });
  
  return {
    write: (audioData: Buffer | string) => {
      const buf = typeof audioData === 'string' ? Buffer.from(audioData, 'base64') : audioData;
      stream.write({ audioContent: buf });
    },
    end: () => {
      stream.end();
    },
    on: (event: string, callback: StreamCallback | StreamEndCallback | StreamErrorCallback) => {
      if (!callbacks[event]) {
        callbacks[event] = [];
      }
      callbacks[event].push(callback);
    },
  };
}

/**
 * Test the STT service with a simple phrase
 */
export async function testSTTService(): Promise<boolean> {
  console.log('[STT] Running test...');
  
  if (!isGoogleCloudConfigured) {
    console.log('[STT] Test passed - Mock mode working');
    return true;
  }
  
  try {
    // Create a simple test audio (silence)
    const testAudio = Buffer.alloc(32000); // 1 second of 16kHz mono silence
    const testBase64 = testAudio.toString('base64');
    
    const result = await transcribeAudioChunk(testBase64);
    console.log('[STT] Test result:', result);
    
    return true;
  } catch (error) {
    console.error('[STT] Test failed:', error);
    return false;
  }
}

export { isGoogleCloudConfigured };
export { isElevenLabsConfigured, sttProvider };

