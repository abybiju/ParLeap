'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Music, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'results' | 'error'

export function ListeningOverlay({ open, onClose, onSelectSong }: ListeningOverlayProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(16).fill(0.1))
  const [recordingTime, setRecordingTime] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      stopRecording()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setState('idle')
      setError(null)
      setResults([])
      setRecordingTime(0)
      // Auto-start recording after a brief delay
      const timeout = setTimeout(() => {
        startRecording()
      }, 500)
      return () => clearTimeout(timeout)
    } else {
      stopRecording()
    }
  }, [open])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      })

      // Set up audio analysis for visualization
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 64
      source.connect(analyserRef.current)

      // Start visualizing
      visualize()

      // Set up MediaRecorder - try WAV-compatible format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')
        ? 'audio/webm;codecs=pcm'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        processRecording()
      }

      mediaRecorderRef.current.start(100) // Collect in 100ms chunks
      setState('recording')
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording()
        }
      }, 10000)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Could not access microphone. Please grant permission.')
      setState('error')
    }
  }

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close()
    }
  }

  const visualize = () => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

    const draw = () => {
      if (!analyserRef.current) return
      animationFrameRef.current = requestAnimationFrame(draw)
      analyserRef.current.getByteFrequencyData(dataArray)

      // Convert to normalized levels (0-1)
      const levels = Array.from({ length: 16 }, (_, i) => {
        const index = Math.floor((i / 16) * dataArray.length)
        return Math.max(0.1, dataArray[index] / 255)
      })
      setAudioLevels(levels)
    }

    draw()
  }

  const processRecording = async () => {
    setState('processing')
    setAudioLevels(Array(16).fill(0.1))

    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
      
      // Convert to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        }
      })
      reader.readAsDataURL(audioBlob)
      const base64Audio = await base64Promise

      // Send to backend
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
      const response = await fetch(`${backendUrl}/api/hum-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64Audio,
          limit: 5,
          threshold: 0.4,
        }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        setResults(data.results)
        setState('results')
      } else {
        setError('No matching songs found. Try humming louder or longer!')
        setState('error')
      }
    } catch (err) {
      console.error('Processing error:', err)
      setError('Failed to search. Please try again.')
      setState('error')
    }
  }

  const handleRetry = () => {
    setError(null)
    setResults([])
    startRecording()
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
      {/* Close button */}
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
        {/* Recording State */}
        {state === 'recording' && (
          <div className="text-center">
            {/* Animated Microphone */}
            <div className="relative w-32 h-32 mx-auto mb-8">
              {/* Pulsing rings */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse-ring" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse-ring-slow" style={{ animationDelay: '0.5s' }} />
              
              {/* Center circle */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/50">
                <Music className="w-12 h-12 text-white animate-bounce-subtle" />
              </div>
            </div>

            {/* Text */}
            <p className="text-2xl font-bold text-white mb-2">
              Listening...
            </p>
            <p className="text-white/60 mb-6">
              Hum your melody ({10 - recordingTime}s remaining)
            </p>

            {/* Real Waveform Visualization */}
            <div className="flex items-end justify-center gap-1 h-20 mb-6">
              {audioLevels.map((level, i) => (
                <div
                  key={i}
                  className="w-2 bg-gradient-to-t from-orange-500 via-red-500 to-pink-500 rounded-full transition-all duration-75"
                  style={{
                    height: `${level * 100}%`,
                    opacity: 0.6 + level * 0.4,
                  }}
                />
              ))}
            </div>

            {/* Stop button */}
            <button
              onClick={stopRecording}
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              Stop & Search
            </button>
          </div>
        )}

        {/* Processing State */}
        {state === 'processing' && (
          <div className="text-center py-8">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-orange-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            <p className="text-xl font-semibold text-white mb-2">
              Analyzing melody...
            </p>
            <p className="text-white/60">
              Finding matching songs
            </p>
          </div>
        )}

        {/* Results State */}
        {state === 'results' && results.length > 0 && (
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h3 className="text-xl font-bold text-white">
                Found {results.length} match{results.length > 1 ? 'es' : ''}!
              </h3>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {results.map((result, index) => (
                <button
                  key={result.songId}
                  onClick={() => handleSelectSong(result.songId)}
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
                        <p className="text-sm text-white/60 truncate">
                          {result.artist}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        result.similarity > 0.8 ? 'bg-green-500/20 text-green-400' :
                        result.similarity > 0.6 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-white/10 text-white/60'
                      )}>
                        {Math.round(result.similarity * 100)}% match
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleRetry}
              className="w-full mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="text-center py-8 animate-fade-in-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-xl font-semibold text-white mb-2">
              Oops!
            </p>
            <p className="text-white/60 mb-6">
              {error}
            </p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Idle State (brief loading before recording starts) */}
        {state === 'idle' && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-white/60">Preparing microphone...</p>
          </div>
        )}
      </div>
    </div>
  )
}
