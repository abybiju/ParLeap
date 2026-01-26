import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Music, LayoutDashboard, Zap } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="z-10 max-w-5xl w-full items-center justify-center text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ParLeap
          </h1>
          <p className="text-xl text-muted-foreground">
            AI-Powered Presentation Platform
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-2xl mx-auto">
            Automate content display at live events with real-time AI transcription and intelligent slide matching
          </p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center mt-12">
          <Link href="/songs">
            <Button size="lg" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Music className="h-5 w-5" />
              Song Library
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard
            </Button>
          </Link>
          <Link href="/test-websocket">
            <Button size="lg" variant="outline" className="gap-2">
              <Zap className="h-5 w-5" />
              Test WebSocket
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 rounded-lg border border-white/10 bg-white/5 backdrop-blur">
            <h3 className="font-semibold mb-2 text-indigo-400">Real-Time STT</h3>
            <p className="text-sm text-muted-foreground">
              Live transcription powered by ElevenLabs with sub-500ms latency
            </p>
          </div>
          <div className="p-6 rounded-lg border border-white/10 bg-white/5 backdrop-blur">
            <h3 className="font-semibold mb-2 text-indigo-400">AI Matching</h3>
            <p className="text-sm text-muted-foreground">
              Intelligent fuzzy matching with auto-advance for seamless presentations
            </p>
          </div>
          <div className="p-6 rounded-lg border border-white/10 bg-white/5 backdrop-blur">
            <h3 className="font-semibold mb-2 text-indigo-400">Song Management</h3>
            <p className="text-sm text-muted-foreground">
              Notion-style editor with stanza-aware parsing and live preview
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

