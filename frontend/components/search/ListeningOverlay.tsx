'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Music, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { audioBufferToWav, arrayBufferToBase64 } from '@/lib/audioUtils'

/** How often we send accumulated audio for matching (ms). */
const MATCH_INTERVAL_MS = 3000
/** Minimum audio before first match attempt (seconds). */
const MIN_AUDIO_SECONDS = 2
/** Max recording time before auto-stopping (seconds). */
const MAX_RECORDING_SECONDS = 30
/** Sample rate for recording. */
const SAMPLE_RATE = 22050
/** Only show results above this confidence. */
const MIN_CONFIDENCE = 0.25

function getBackendUrl(): string {
  if (typeof window === 'undefined') return ''
  return process.env.NEXT_PUBLIC_BACKEND_URL ||
    (window.location?.hostname === 'www.parleap.com'
      ? 'https://parleapbackend-production.up.railway.app'
      : 'http://localhost:3001')
}

interface SearchResult {
  songId: string
  title: string
  artist: string | null
  similarity: number
  lyrics: string
}

interface ListeningOverlayProps {
  open: boolean
  onClose?: () => void
  onSelectSong?: (songId: string) => void
  userSongIds?: Set<string>
  onAddSong?: (title: string, artist: string) => void
}

type OverlayState = 'idle' | 'listening' | 'results' | 'no-match' | 'error'

export function ListeningOverlay({ open, onClose, onSelectSong, userSongIds, onAddSong }: ListeningOverlayProps) {
  const [state, setState] = useState<OverlayState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(16).fill(0.1))
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [statusText, setStatusText] = useState('Start humming your melody')

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioChunksRef = useRef<Float32Array[]>([])
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const matchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isActiveRef = useRef(false)
  const matchInFlightRef = useRef(false)
  const matchAttemptRef = useRef(0)

  const cleanup = useCallback(() => {
    isActiveRef.current = false
    matchInFlightRef.current = false

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (matchIntervalRef.current) { clearInterval(matchIntervalRef.current); matchIntervalRef.current = null }
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null }
    if (scriptProcessorRef.current) { scriptProcessorRef.current.disconnect(); scriptProcessorRef.current = null }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null }
    if (audioContextRef.current?.state !== 'closed') { audioContextRef.current?.close() }
    audioContextRef.current = null
    analyserRef.current = null
  }, [])

  // Reset on close
  useEffect(() => {
    if (open) {
      setState('idle')
      setError(null)
      setResults([])
      setElapsedSeconds(0)
      setStatusText('Start humming your melody')
      matchAttemptRef.current = 0
      audioChunksRef.current = []
    } else {
      cleanup()
    }
    return () => cleanup()
  }, [open, cleanup])

  const visualize = useCallback(() => {
    if (!analyserRef.current) return
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    const draw = () => {
      if (!analyserRef.current) return
      animationFrameRef.current = requestAnimationFrame(draw)
      analyserRef.current.getByteFrequencyData(dataArray)
      const levels = Array.from({ length: 16 }, (_, i) => {
        const index = Math.floor((i / 16) * dataArray.length)
        return Math.max(0.1, dataArray[index] / 255)
      })
      setAudioLevels(levels)
    }
    draw()
  }, [])

  /** Build a WAV from all accumulated audio chunks. */
  const getAccumulatedWav = useCallback((): string | null => {
    const chunks = audioChunksRef.current
    if (chunks.length === 0) return null

    const totalLength = chunks.reduce((s, c) => s + c.length, 0)
    if (totalLength < SAMPLE_RATE * MIN_AUDIO_SECONDS) return null

    const combined = new Float32Array(totalLength)
    let offset = 0
    for (const c of chunks) { combined.set(c, offset); offset += c.length }

    // Create a temporary offline context just for buffer creation
    const buffer = new AudioBuffer({ length: combined.length, sampleRate: SAMPLE_RATE, numberOfChannels: 1 })
    buffer.copyToChannel(combined, 0)

    const wavBuffer = audioBufferToWav(buffer)
    return arrayBufferToBase64(wavBuffer)
  }, [])

  /** Send accumulated audio to backend for matching. */
  const tryMatch = useCallback(async () => {
    if (matchInFlightRef.current || !isActiveRef.current) return
    const audio = getAccumulatedWav()
    if (!audio) return

    matchInFlightRef.current = true
    matchAttemptRef.current++
    const attempt = matchAttemptRef.current

    try {
      const url = getBackendUrl()
      console.log(`[HumSearch] Match attempt #${attempt}, audio: ${audio.length} chars`)

      const res = await fetch(`${url}/api/hum-search/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio, limit: 5, threshold: MIN_CONFIDENCE }),
      })

      if (!isActiveRef.current) return // User closed while we were fetching

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        console.error(`[HumSearch] Match error ${res.status}:`, data?.error)
        // Don't stop — just try again on next interval
        matchInFlightRef.current = false
        return
      }

      const data = await res.json() as { results?: SearchResult[]; count?: number }
      const matches = data.results ?? []

      if (matches.length > 0 && matches[0].similarity >= MIN_CONFIDENCE) {
        // Found a match!
        console.log(`[HumSearch] Match found: "${matches[0].title}" (${Math.round(matches[0].similarity * 100)}%)`)
        setResults(matches)
        setState('results')
        cleanup()
        return
      }

      // No match yet — update status text
      if (attempt <= 2) {
        setStatusText('Keep humming...')
      } else if (attempt <= 5) {
        setStatusText('Still listening — try the chorus')
      } else {
        setStatusText('Hmm, keep going...')
      }
    } catch (err) {
      console.error('[HumSearch] Match request failed:', err)
    } finally {
      matchInFlightRef.current = false
    }
  }, [getAccumulatedWav, cleanup])

  const startListening = useCallback(async () => {
    try {
      audioChunksRef.current = []
      matchAttemptRef.current = 0
      matchInFlightRef.current = false

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: SAMPLE_RATE },
      })
      mediaStreamRef.current = stream

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioContextRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)

      analyserRef.current = ctx.createAnalyser()
      analyserRef.current.fftSize = 64
      source.connect(analyserRef.current)

      const scriptProcessor = ctx.createScriptProcessor(4096, 1, 1)
      scriptProcessorRef.current = scriptProcessor
      scriptProcessor.onaudioprocess = (e) => {
        audioChunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      }
      source.connect(scriptProcessor)
      scriptProcessor.connect(ctx.destination)

      visualize()

      isActiveRef.current = true
      setState('listening')
      setElapsedSeconds(0)
      setStatusText('Listening...')

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds((t) => {
          const next = t + 1
          if (next >= MAX_RECORDING_SECONDS) {
            // Time's up — do one final match attempt then stop
            isActiveRef.current = false
            if (matchIntervalRef.current) { clearInterval(matchIntervalRef.current); matchIntervalRef.current = null }

            // Final attempt
            const audio = getAccumulatedWav()
            if (audio) {
              const url = getBackendUrl()
              fetch(`${url}/api/hum-search/match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio, limit: 5, threshold: MIN_CONFIDENCE }),
              })
                .then((r) => r.json())
                .then((data: { results?: SearchResult[] }) => {
                  const matches = data.results ?? []
                  if (matches.length > 0 && matches[0].similarity >= MIN_CONFIDENCE) {
                    setResults(matches)
                    setState('results')
                  } else {
                    setState('no-match')
                  }
                  cleanup()
                })
                .catch(() => { setState('no-match'); cleanup() })
            } else {
              setState('no-match')
              cleanup()
            }
            return MAX_RECORDING_SECONDS
          }
          return next
        })
      }, 1000)

      // Match interval — try every 3 seconds
      matchIntervalRef.current = setInterval(() => {
        tryMatch()
      }, MATCH_INTERVAL_MS)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError(err instanceof Error ? err.message : 'Could not access microphone. Please grant permission.')
      setState('error')
    }
  }, [visualize, tryMatch, getAccumulatedWav, cleanup])

  const handleRetry = () => {
    setError(null)
    setResults([])
    startListening()
  }

  const handleSelectSong = (songId: string) => {
    onSelectSong?.(songId)
    onClose?.()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div
        className="glass-card p-8 max-w-lg w-full mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Idle — Start button */}
        {state === 'idle' && (
          <div className="text-center py-8">
            <p className="text-white/80 mb-6">Hum a melody to find a song</p>
            <button
              type="button"
              onClick={startListening}
              className="px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-lg font-medium hover:opacity-90 transition-opacity"
            >
              Start humming
            </button>
          </div>
        )}

        {/* Listening — waveform + status */}
        {state === 'listening' && (
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse-ring" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse-ring-slow" style={{ animationDelay: '0.5s' }} />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/50">
                <Music className="w-12 h-12 text-white animate-bounce-subtle" />
              </div>
            </div>

            <p className="text-2xl font-bold text-white mb-2">{statusText}</p>
            <p className="text-white/50 text-sm mb-6">
              {elapsedSeconds}s / {MAX_RECORDING_SECONDS}s
            </p>

            {/* Waveform */}
            <div className="flex items-end justify-center gap-1 h-20 mb-6">
              {audioLevels.map((level, i) => (
                <div
                  key={i}
                  className="w-2 bg-gradient-to-t from-orange-500 via-red-500 to-pink-500 rounded-full transition-all duration-75"
                  style={{ height: `${level * 100}%`, opacity: 0.6 + level * 0.4 }}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-1000"
                style={{ width: `${(elapsedSeconds / MAX_RECORDING_SECONDS) * 100}%` }}
              />
            </div>

            <button
              onClick={() => { cleanup(); setState('no-match') }}
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Results */}
        {state === 'results' && results.length > 0 && (
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h3 className="text-xl font-bold text-white">
                Found {results.length} match{results.length > 1 ? 'es' : ''}!
              </h3>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {results.map((result, index) => {
                const isInLibrary = !userSongIds || userSongIds.has(result.songId)
                return (
                  <button
                    key={result.songId}
                    onClick={() => {
                      if (isInLibrary) {
                        handleSelectSong(result.songId)
                      } else if (onAddSong) {
                        onAddSong(result.title, result.artist || '')
                        onClose?.()
                      }
                    }}
                    className={cn(
                      'w-full p-4 rounded-xl text-left transition-all',
                      'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/50',
                      'group animate-fade-in-up'
                    )}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate group-hover:text-orange-400 transition-colors">
                          {result.title}
                        </p>
                        {result.artist && (
                          <p className="text-sm text-white/60 truncate">{result.artist}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          result.similarity > 0.8 ? 'bg-green-500/20 text-green-400' :
                          result.similarity > 0.6 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-white/10 text-white/60'
                        )}>
                          {Math.round(result.similarity * 100)}% match
                        </span>
                        {!isInLibrary && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                            + Add
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleRetry}
              className="w-full mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {/* No match */}
        {state === 'no-match' && (
          <div className="text-center py-8 animate-fade-in-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Music className="w-8 h-8 text-orange-400" />
            </div>
            <p className="text-xl font-semibold text-white mb-2">
              No match found
            </p>
            <p className="text-white/60 mb-6">
              Try humming a clearer melody, or hum the chorus part of the song.
            </p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="text-center py-8 animate-fade-in-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-xl font-semibold text-white mb-2">Oops!</p>
            <p className="text-white/60 mb-6">{error}</p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
