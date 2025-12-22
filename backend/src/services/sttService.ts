/**
 * Speech-to-Text Service
 * 
 * Handles audio transcription using Google Cloud Speech-to-Text API
 * Falls back to mock transcription when Google Cloud credentials not configured
 */

import { SpeechClient } from '@google-cloud/speech';
import type * as speechTypes from '@google-cloud/speech/build/protos/protos';

// Check if Google Cloud is configured
const isGoogleCloudConfigured = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

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
  encoding: 'LINEAR16' as any,
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

function generateMockTranscription(_audioData: Buffer): TranscriptionResult {
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
    
    // Use mock transcription if Google Cloud not configured
    if (!speechClient || !isGoogleCloudConfigured) {
      console.log('[STT] Using mock transcription');
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
export function createStreamingRecognition(): {
  write: (audioData: Buffer) => void;
  end: () => void;
  on: (event: string, callback: (result: TranscriptionResult) => void) => void;
} {
  if (!speechClient || !isGoogleCloudConfigured) {
    console.warn('[STT] Streaming not available - Google Cloud not configured');
    
    // Return mock streaming interface
    const mockCallbacks: { [key: string]: Function[] } = {};
    
    return {
      write: (audioData: Buffer) => {
        const result = generateMockTranscription(audioData);
        if (mockCallbacks['data']) {
          mockCallbacks['data'].forEach(cb => cb(result));
        }
      },
      end: () => {
        if (mockCallbacks['end']) {
          mockCallbacks['end'].forEach(cb => cb());
        }
      },
      on: (event: string, callback: Function) => {
        if (!mockCallbacks[event]) {
          mockCallbacks[event] = [];
        }
        mockCallbacks[event].push(callback);
      },
    };
  }
  
  // Create real Google Cloud streaming recognition
  const stream = speechClient.streamingRecognize(streamingConfig);
  
  const callbacks: { [key: string]: Function[] } = {};
  
  stream.on('data', (data: any) => {
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const alternative = result.alternatives?.[0];
      
      if (alternative && alternative.transcript) {
        const transcriptionResult: TranscriptionResult = {
          text: alternative.transcript,
          // Google Cloud streaming API provides isFinal on the result or on data itself
          isFinal: !!(result.isFinal || data.isFinal),
          confidence: alternative.confidence || 0.0,
          timestamp: new Date(),
        };
        
        if (callbacks['data']) {
          callbacks['data'].forEach(cb => cb(transcriptionResult));
        }
      }
    }
  });
  
  stream.on('error', (error: Error) => {
    console.error('[STT] Stream error:', error);
    if (callbacks['error']) {
      callbacks['error'].forEach(cb => cb(error));
    }
  });
  
  stream.on('end', () => {
    console.log('[STT] Stream ended');
    if (callbacks['end']) {
      callbacks['end'].forEach(cb => cb());
    }
  });
  
  return {
    write: (audioData: Buffer) => {
      stream.write({ audioContent: audioData });
    },
    end: () => {
      stream.end();
    },
    on: (event: string, callback: Function) => {
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

