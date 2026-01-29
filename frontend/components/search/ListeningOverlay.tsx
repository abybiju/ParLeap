'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Music, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { audioBufferToWav, arrayBufferToBase64 } from '@/lib/audioUtils'

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

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioChunksRef = useRef<Float32Array[]>([])
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRecordingRef = useRef<boolean>(false)

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      isRecordingRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current)
      stopRecording()
    }
  }, [])

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setState('idle')
      setError(null)
      setResults([])
      setRecordingTime(0)
      isRecordingRef.current = false
      // Auto-start recording after a brief delay
      const timeout = setTimeout(() => {
        startRecording()
      }, 500)
      return () => clearTimeout(timeout)
    } else {
      isRecordingRef.current = false
      stopRecording()
      return undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 22050, // Match BasicPitch's expected sample rate
        } 
      })

      mediaStreamRef.current = stream

      // Set up AudioContext for recording and visualization
      audioContextRef.current = new AudioContext({ sampleRate: 22050 })
      const source = audioContextRef.current.createMediaStreamSource(stream)
      
      // Set up analyser for visualization
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 64
      source.connect(analyserRef.current)

      // Set up ScriptProcessorNode to capture raw audio samples
      // Note: ScriptProcessorNode is deprecated but widely supported
      // Alternative would be AudioWorklet but requires separate file
      const bufferSize = 4096
      const scriptProcessor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1)
      scriptProcessorRef.current = scriptProcessor
      
      audioChunksRef.current = []
      
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        // Copy the audio data
        audioChunksRef.current.push(new Float32Array(inputData))
      }
      
      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContextRef.current.destination)

      // Start visualizing
      visualize()

      isRecordingRef.current = true
      setState('recording')
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          // Cap at 5 seconds for display (reduced to prevent payload too large)
          if (t >= 5) {
            return 5
          }
          return t + 1
        })
      }, 1000)

      // Auto-stop after 5 seconds (reduced to prevent payload too large)
      autoStopTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          stopRecording()
        }
      }, 5000)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Could not access microphone. Please grant permission.')
      setState('error')
    }
  }

  const stopRecording = () => {
    // Prevent multiple calls
    if (!isRecordingRef.current) return
    
    isRecordingRef.current = false
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current)
      autoStopTimeoutRef.current = null
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    // Disconnect script processor
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect()
      scriptProcessorRef.current = null
    }
    
    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    
    // Process the recording only if we have data
    if (audioChunksRef.current.length > 0) {
      processRecording()
    } else {
      setError('No audio recorded. Please try again.')
      setState('error')
    }
    
    // Close audio context
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
      if (!audioContextRef.current || audioChunksRef.current.length === 0) {
        throw new Error('No audio data recorded')
      }

      // Combine all audio chunks into a single Float32Array
      const totalLength = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0)
      const combinedAudio = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of audioChunksRef.current) {
        combinedAudio.set(chunk, offset)
        offset += chunk.length
      }

      // Create AudioBuffer from the combined samples
      const sampleRate = audioContextRef.current.sampleRate
      const audioBuffer = audioContextRef.current.createBuffer(1, combinedAudio.length, sampleRate)
      audioBuffer.copyToChannel(combinedAudio, 0)

      // Convert AudioBuffer to WAV format
      const wavBuffer = audioBufferToWav(audioBuffer)
      const base64Audio = arrayBufferToBase64(wavBuffer)

      // Send to backend with timeout
      // Use production backend URL if NEXT_PUBLIC_BACKEND_URL is not set
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
        (typeof window !== 'undefined' && window.location.hostname === 'www.parleap.com' 
          ? 'https://parleapbackend-production.up.railway.app'
          : 'http://localhost:3001')
      
      console.log('[HumSearch] Sending request to:', `${backendUrl}/api/hum-search`)
      console.log('[HumSearch] Audio size:', base64Audio.length, 'chars (base64)')
      
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      let response: Response
      try {
        response = await fetch(`${backendUrl}/api/hum-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: base64Audio,
            limit: 5,
            threshold: 0.4,
          }),
          signal: controller.signal,
        })
        console.log('[HumSearch] Response status:', response.status, response.statusText)
      } catch (err) {
        clearTimeout(timeoutId)
        console.error('[HumSearch] Fetch error:', err)
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.')
        }
        if (err instanceof Error && err.message.includes('Failed to fetch')) {
          throw new Error(`Cannot connect to backend. Check if ${backendUrl} is accessible.`)
        }
        throw err
      }
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        // Clone response before reading to avoid "body already read" error
        const responseClone = response.clone()
        let errorData: any = {}
        let errorMessage = `Search failed: ${response.status} ${response.statusText}`
        
        try {
          errorData = await responseClone.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // Response is not JSON, try text
          try {
            const text = await response.text()
            console.error('[HumSearch] Non-JSON error response:', text)
            errorMessage = text || errorMessage
          } catch {
            // Can't read response at all
            console.error('[HumSearch] Cannot read error response')
          }
        }
        
        console.error('[HumSearch] Error response:', errorData)
        
        // Provide user-friendly error messages
        if (response.status === 413) {
          throw new Error('Audio file too large. Please record a shorter clip (3-5 seconds).')
        } else if (response.status === 400) {
          throw new Error(errorMessage || 'Invalid audio format. Please try again.')
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(errorMessage)
        }
      }

      const data = await response.json()
      console.log('[HumSearch] Received results:', data)
      
      if (data.results && data.results.length > 0) {
        setResults(data.results)
        setState('results')
      } else {
        console.log('[HumSearch] No results found')
        setError('No matching songs found. Try humming louder or longer!')
        setState('error')
      }
    } catch (err) {
      console.error('[HumSearch] Processing error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to search. Please try again.'
      setError(errorMessage)
      setState('error')
    } finally {
      // Clear audio chunks for next recording
      audioChunksRef.current = []
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
              Hum your melody ({Math.max(0, 5 - recordingTime)}s remaining)
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
