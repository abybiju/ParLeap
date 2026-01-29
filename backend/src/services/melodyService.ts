/**
 * Melody Extraction Service
 * 
 * Extracts key-invariant and tempo-invariant melody vectors from audio files
 * for "Hum-to-Search" functionality.
 * 
 * Algorithm:
 * 1. Decode WAV file to audio samples
 * 2. Extract MIDI notes using BasicPitch AI
 * 3. Filter to monophonic melody (highest amplitude note per timeframe)
 * 4. Convert to interval deltas (key-invariant)
 * 5. Normalize rhythm ratios (tempo-invariant)
 * 6. Combine into 128D vector (64 pitch + 64 rhythm)
 */

import {
  BasicPitch,
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
  NoteEventTime,
} from '@spotify/basic-pitch';
import { WaveFile } from 'wavefile';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Monophonic melody note (filtered from polyphonic output)
 */
interface MelodyNote {
  pitchMidi: number;
  startTime: number;
  endTime: number;
}

// Monkey-patch global fetch to handle file:// URLs in Node.js
// This is needed because TensorFlow.js uses fetch() to load models
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  
  if (url.startsWith('file://')) {
    const filePath = url.replace('file://', '');
    try {
      const buffer = fs.readFileSync(filePath);
      const contentType = filePath.endsWith('.json') ? 'application/json' : 'application/octet-stream';
      
      return new Response(buffer, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': contentType },
      });
    } catch (err) {
      return new Response(null, {
        status: 404,
        statusText: 'Not Found',
      });
    }
  }
  
  return originalFetch(input, init);
};

// Model path - BasicPitch model is included in the package
function findModelPath(): string {
  // Try multiple possible locations (including monorepo root)
  const possiblePaths = [
    // Monorepo root node_modules (npm workspaces hoisting)
    path.join(__dirname, '../../../node_modules/@spotify/basic-pitch/model/model.json'),
    // From cwd going up one level (if running from backend/)
    path.join(process.cwd(), '../node_modules/@spotify/basic-pitch/model/model.json'),
    // Backend-local node_modules (if not hoisted)
    path.join(__dirname, '../../node_modules/@spotify/basic-pitch/model/model.json'),
    path.join(process.cwd(), 'node_modules/@spotify/basic-pitch/model/model.json'),
  ];

  for (const modelPath of possiblePaths) {
    if (fs.existsSync(modelPath)) {
      const absolutePath = path.resolve(modelPath);
      return `file://${absolutePath}`;
    }
  }

  throw new Error(
    `Could not find BasicPitch model. Tried:\n${possiblePaths.join('\n')}\n\n` +
    'Make sure @spotify/basic-pitch is installed: npm install @spotify/basic-pitch'
  );
}

const modelPath = findModelPath();

/**
 * Extract a 128-dimensional melody vector from audio buffer
 * 
 * @param audioBuffer - Raw WAV file buffer
 * @returns Promise resolving to 128D vector (64 pitch intervals + 64 rhythm ratios)
 */
export async function getMelodyVector(audioBuffer: Buffer): Promise<number[]> {
  // 1. Decode WAV to float32 samples
  // Note: BasicPitch resamples to 22050 Hz internally, so we don't need sampleRate
  const wav = new WaveFile(audioBuffer);
  const samples = wav.getSamples(true, Float32Array);
  
  // Handle mono/stereo conversion
  let audioData: Float32Array;
  if (Array.isArray(samples)) {
    // Stereo: mix down to mono
    const left = new Float32Array(samples[0] as unknown as ArrayLike<number>);
    const right = new Float32Array(samples[1] as unknown as ArrayLike<number>);
    audioData = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      audioData[i] = (left[i] + right[i]) / 2;
    }
  } else {
    audioData = new Float32Array(samples as unknown as ArrayLike<number>);
  }
  
  // 2. Run BasicPitch to extract MIDI notes
  // BasicPitch will load the model internally from the path
  const basicPitch = new BasicPitch(modelPath);
  
  // Collect frames, onsets, and contours from callbacks
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  
  await basicPitch.evaluateModel(
    audioData,
    (f: number[][], o: number[][], c: number[][]) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (_p: number) => {
      // Progress callback (optional)
    }
  );
  
  // Convert frames/onsets to note events
  // Parameters: onsetThreshold, frameThreshold, minNoteLength
  const notes = outputToNotesPoly(frames, onsets, 0.25, 0.25, 5);
  
  // Add pitch bends to notes
  const notesWithBends = addPitchBendsToNoteEvents(contours, notes);
  
  // Convert to time-based note events
  const noteEvents: NoteEventTime[] = noteFramesToTime(notesWithBends);
  
  if (noteEvents.length === 0) {
    throw new Error('No notes detected in audio file');
  }
  
  // 3. Filter to monophonic melody (highest amplitude note at each timeframe)
  const melody = filterToMelody(noteEvents);
  
  if (melody.length < 2) {
    throw new Error('Insufficient notes for melody extraction (need at least 2 notes)');
  }
  
  // 4. Extract pitch intervals (KEY INVARIANT)
  // Interval delta = current note - previous note (in semitones)
  const pitchIntervals: number[] = [];
  for (let i = 1; i < melody.length; i++) {
    const interval = melody[i].pitchMidi - melody[i - 1].pitchMidi;
    pitchIntervals.push(interval);
  }
  
  // 5. Extract rhythm ratios (TEMPO INVARIANT)
  // Normalize inter-onset intervals by total duration
  const totalDuration = melody[melody.length - 1].startTime - melody[0].startTime;
  if (totalDuration <= 0) {
    throw new Error('Invalid duration: total duration must be positive');
  }
  
  const rhythmRatios: number[] = [];
  for (let i = 1; i < melody.length; i++) {
    const interOnsetInterval = melody[i].startTime - melody[i - 1].startTime;
    const ratio = interOnsetInterval / totalDuration;
    rhythmRatios.push(ratio);
  }
  
  // 6. Normalize and resize to 64 + 64 = 128 dimensions
  const pitchVector = resizeArray(pitchIntervals, 64);
  const rhythmVector = resizeArray(rhythmRatios, 64);
  
  return [...pitchVector, ...rhythmVector];
}

/**
 * Filter polyphonic notes to monophonic melody
 * Takes the highest amplitude note at each timeframe
 */
function filterToMelody(noteEvents: NoteEventTime[]): MelodyNote[] {
  // Sort by start time, then by amplitude (descending)
  const sorted = [...noteEvents].sort((a, b) => {
    if (Math.abs(a.startTimeSeconds - b.startTimeSeconds) < 0.01) {
      // Same timeframe: prefer higher amplitude
      return b.amplitude - a.amplitude;
    }
    return a.startTimeSeconds - b.startTimeSeconds;
  });
  
  // Group by time windows (10ms windows)
  const windowSize = 0.01; // 10ms
  const melody: MelodyNote[] = [];
  const processed: Set<number> = new Set();
  
  for (const note of sorted) {
    const windowStart = Math.floor(note.startTimeSeconds / windowSize) * windowSize;
    
    if (!processed.has(windowStart)) {
      melody.push({
        pitchMidi: note.pitchMidi,
        startTime: note.startTimeSeconds,
        endTime: note.startTimeSeconds + note.durationSeconds,
      });
      processed.add(windowStart);
    }
  }
  
  // Sort final melody by start time
  return melody.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Resize array to target length
 * - If shorter: pad with zeros
 * - If longer: truncate or downsample
 */
function resizeArray(arr: number[], targetLength: number): number[] {
  if (arr.length === targetLength) {
    return arr;
  }
  
  if (arr.length < targetLength) {
    // Pad with zeros
    return [...arr, ...new Array(targetLength - arr.length).fill(0)];
  }
  
  // Downsample: take evenly spaced samples
  const step = arr.length / targetLength;
  const result: number[] = [];
  for (let i = 0; i < targetLength; i++) {
    const index = Math.floor(i * step);
    result.push(arr[index]);
  }
  
  return result;
}

/**
 * Extract melody vector from file path (convenience function)
 */
export async function getMelodyVectorFromFile(filePath: string): Promise<number[]> {
  const audioBuffer = fs.readFileSync(filePath);
  return getMelodyVector(audioBuffer);
}
