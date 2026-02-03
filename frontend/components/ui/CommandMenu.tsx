'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'cmdk'
import { Music, Calendar, BookOpen, Plus, Moon, Sun, LogOut, Home, X, Clock } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'

type Song = Database['public']['Tables']['songs']['Row']
type Event = Database['public']['Tables']['events']['Row']

interface RecentSearch {
  query: string
  ts: number
}

const RECENT_SEARCHES_KEY = 'parleap.commandMenu.recents'
const MAX_RECENT_SEARCHES = 10

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type CommandContext = 'ALL' | 'SONG' | 'VERSE' | 'EVENT'

interface ParsedInput {
  context: CommandContext
  query: string
}

// Parse raw input to extract command context and query
function parseInput(rawInput: string): ParsedInput {
  const trimmed = rawInput.trim()
  
  if (!trimmed) {
    return { context: 'ALL', query: '' }
  }
  
  // Check for slash commands
  // Match /song or /s (must be followed by space or end of string)
  if (trimmed.match(/^\/s(ong)?(\s|$)/)) {
    const query = trimmed.replace(/^\/s(ong)?\s*/, '').trim()
    return { context: 'SONG', query }
  }
  
  // Match /verse or /v (must be followed by space or end of string)
  if (trimmed.match(/^\/v(erse)?(\s|$)/)) {
    const query = trimmed.replace(/^\/v(erse)?\s*/, '').trim()
    return { context: 'VERSE', query }
  }
  
  // Match /event or /e (must be followed by space or end of string)
  if (trimmed.match(/^\/e(vent)?(\s|$)/)) {
    const query = trimmed.replace(/^\/e(vent)?\s*/, '').trim()
    return { context: 'EVENT', query }
  }
  
  // If input is exactly '/', return empty query but keep it for hint menu
  if (trimmed === '/') {
    return { context: 'ALL', query: '' }
  }
  
  // Default: no command, search all
  return { context: 'ALL', query: trimmed }
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter()
  const { signOut } = useAuthStore()
  const [songs, setSongs] = useState<Song[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [rawInput, setRawInput] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  
  // Parse input to get context and query
  const { context: commandContext, query: searchQuery } = parseInput(rawInput)

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as RecentSearch[]
          setRecentSearches(parsed)
        }
      } catch (error) {
        console.error('Error loading recent searches:', error)
      }
    }
  }, [])

  // Save search to recent searches
  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return
    
    const newRecent: RecentSearch = { query: query.trim(), ts: Date.now() }
    const updated = [
      newRecent,
      ...recentSearches.filter((r) => r.query.toLowerCase() !== query.trim().toLowerCase())
    ].slice(0, MAX_RECENT_SEARCHES)
    
    setRecentSearches(updated)
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('Error saving recent search:', error)
    }
  }

  // Clear all recent searches
  const clearRecentSearches = () => {
    setRecentSearches([])
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch (error) {
      console.error('Error clearing recent searches:', error)
    }
  }

  // Remove a single recent search
  const removeRecentSearch = (query: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = recentSearches.filter((r) => r.query !== query)
    setRecentSearches(updated)
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('Error removing recent search:', error)
    }
  }

  // Restore a recent search query
  const restoreRecentSearch = (query: string) => {
    setRawInput(query)
    // Focus will be handled by cmdk
  }

  // Check dark mode on mount and when open
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
  }, [open])

  // Fetch songs and events when palette opens
  useEffect(() => {
    if (open) {
      setLoading(true)
      const supabase = createClient()
      
      Promise.all([
        supabase
          .from('songs')
          .select('id, title, artist, lyrics')
          .order('title', { ascending: true }),
        supabase
          .from('events')
          .select('id, name, event_date, status')
          .order('event_date', { ascending: false, nullsFirst: false }),
      ])
        .then(([songsResult, eventsResult]) => {
          if (songsResult.data) setSongs(songsResult.data)
          if (eventsResult.data) setEvents(eventsResult.data)
        })
        .catch((error) => {
          console.error('Error fetching data for command menu:', error)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [open])

  // Filter songs by search query (title, artist, or lyrics)
  const filteredSongs = songs.filter((song) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      song.title?.toLowerCase().includes(query) ||
      song.artist?.toLowerCase().includes(query) ||
      song.lyrics?.toLowerCase().includes(query)
    )
  })

  // Filter events by search query
  const filteredEvents = events.filter((event) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return event.name?.toLowerCase().includes(query)
  })

  // Check if search looks like a Bible reference (e.g., "John 3:16", "Psalm 23")
  const isBibleReference = /^[a-z]+\s*\d+[:\d]*$/i.test(searchQuery.trim())

  // Mock scripture items
  const scriptureItems = [
    { id: 'psalm-23', label: 'Psalm 23', reference: 'Psalm 23' },
    { id: 'john-3-16', label: 'John 3:16', reference: 'John 3:16' },
    { id: 'romans-8-28', label: 'Romans 8:28', reference: 'Romans 8:28' },
    { id: 'philippians-4-13', label: 'Philippians 4:13', reference: 'Philippians 4:13' },
  ]

  const filteredScripture = scriptureItems.filter((item) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return item.label.toLowerCase().includes(query) || item.reference.toLowerCase().includes(query)
  })

  const handleSongSelect = (songId: string) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery)
    }
    router.push(`/dashboard/songs/${songId}`)
    onOpenChange(false)
  }

  const handleEventSelect = (eventId: string) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery)
    }
    router.push(`/events/${eventId}`)
    onOpenChange(false)
  }

  const handleCreateEvent = () => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery)
    }
    router.push('/events/new')
    onOpenChange(false)
  }

  const handleToggleDarkMode = () => {
    const currentlyDark = document.documentElement.classList.contains('dark')
    if (currentlyDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
    onOpenChange(false)
  }

  const handleLogOut = async () => {
    await signOut()
    router.push('/auth/login')
    onOpenChange(false)
  }

  const handleNavigate = (path: string) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery)
    }
    router.push(path)
    onOpenChange(false)
  }

  const handleScriptureSelect = (reference: string) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery)
    }
    // Future: Navigate to Bible Reader
    console.log('Navigate to scripture:', reference)
    onOpenChange(false)
  }

  // Handle slash command selection from hint menu
  const handleSetContext = (command: string) => {
    setRawInput(`${command} `)
  }

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setRawInput('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl shadow-2xl [&>button]:hidden">
        <Command
          className="rounded-xl"
          shouldFilter={false}
        >
          <div className="relative">
            {/* Context Badge */}
            {commandContext !== 'ALL' && (
              <Badge
                variant={
                  commandContext === 'SONG' ? 'orange' :
                  commandContext === 'VERSE' ? 'yellow' :
                  'blue'
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center gap-1.5"
              >
                {commandContext === 'SONG' && <>🎵 Songs</>}
                {commandContext === 'VERSE' && <>📖 Scripture</>}
                {commandContext === 'EVENT' && <>📅 Events</>}
              </Badge>
            )}
            <CommandInput
              placeholder="Search songs, events, or commands..."
              value={rawInput}
              onValueChange={setRawInput}
              autoFocus
              className={`h-14 text-lg border-0 border-b border-white/10 bg-transparent text-white placeholder:text-gray-500 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_rgba(255,140,0,0.25)] ${
                commandContext !== 'ALL' ? 'pl-24' : ''
              }`}
            />
          </div>
          <CommandList className="max-h-[400px] overflow-y-auto p-2">
            <CommandEmpty className="py-6 text-center text-sm text-gray-400">
              {loading ? 'Loading...' : 'No results found.'}
            </CommandEmpty>

            {/* GROUP 0: Slash Hint Menu */}
            {rawInput.trim() === '/' && (
              <CommandGroup heading="Filter Commands">
                <CommandItem
                  onSelect={() => handleSetContext('/song')}
                  className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                >
                  <Music className="mr-2 h-4 w-4" />
                  <span>Filter by Song</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => handleSetContext('/verse')}
                  className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-yellow-500/10 data-[selected=true]:text-yellow-500 data-[selected=true]:border-l-2 data-[selected=true]:border-yellow-500"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>Filter by Verse</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => handleSetContext('/event')}
                  className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-blue-500/10 data-[selected=true]:text-blue-500 data-[selected=true]:border-l-2 data-[selected=true]:border-blue-500"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Filter by Event</span>
                </CommandItem>
              </CommandGroup>
            )}

            {/* GROUP 1: Recent Searches */}
            {!rawInput && recentSearches.length > 0 && (
              <CommandGroup heading="Recent">
                {recentSearches.map((recent) => (
                  <CommandItem
                    key={`${recent.query}-${recent.ts}`}
                    onSelect={() => restoreRecentSearch(recent.query)}
                    className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500 group"
                  >
                    <Clock className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{recent.query}</span>
                    <button
                      onClick={(e) => removeRecentSearch(recent.query, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                      aria-label="Remove recent search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </CommandItem>
                ))}
                <CommandItem
                  onSelect={clearRecentSearches}
                  className="text-gray-500 p-2 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 text-xs italic"
                >
                  <span className="ml-6">Clear recent searches</span>
                </CommandItem>
              </CommandGroup>
            )}

            {/* GROUP 2: Suggestions (context-aware quick actions) */}
            {!rawInput && (
              <CommandGroup heading="Suggestions">
                <CommandItem
                  onSelect={() => handleNavigate('/dashboard')}
                  className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                >
                  <Home className="mr-2 h-4 w-4" />
                  <span>Go to Dashboard</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => handleNavigate('/songs')}
                  className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                >
                  <Music className="mr-2 h-4 w-4" />
                  <span>Go to Songs</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => handleNavigate('/events')}
                  className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Go to Events</span>
                </CommandItem>
              </CommandGroup>
            )}

            {/* GROUP 3: Songs */}
            {(commandContext === 'ALL' || commandContext === 'SONG') && filteredSongs.length > 0 && (
              <CommandGroup heading="Songs">
                {filteredSongs.slice(0, 10).map((song) => (
                  <CommandItem
                    key={song.id}
                    onSelect={() => handleSongSelect(song.id)}
                    className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                  >
                    <Music className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{song.title}</span>
                      {song.artist && (
                        <span className="text-xs text-gray-500">{song.artist}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* GROUP 4: Scripture */}
            {(commandContext === 'ALL' || commandContext === 'VERSE') && (filteredScripture.length > 0 || isBibleReference) && (
              <CommandGroup heading="Scripture">
                {filteredScripture.map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => handleScriptureSelect(item.reference)}
                    className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                  >
                    <BookOpen className="mr-2 h-4 w-4 text-yellow-500" />
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
                {isBibleReference && !filteredScripture.some((s) => s.reference.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                  <CommandItem
                    onSelect={() => handleScriptureSelect(searchQuery.trim())}
                    className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                  >
                    <BookOpen className="mr-2 h-4 w-4 text-yellow-500" />
                    <span>Open {searchQuery.trim()}</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}

            {/* GROUP 5: Events */}
            {(commandContext === 'ALL' || commandContext === 'EVENT') && filteredEvents.length > 0 && (
              <CommandGroup heading="Events">
                {filteredEvents.slice(0, 10).map((event) => (
                  <CommandItem
                    key={event.id}
                    onSelect={() => handleEventSelect(event.id)}
                    className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{event.name}</span>
                      {event.event_date && (
                        <span className="text-xs text-gray-500">
                          {new Date(event.event_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* GROUP 6: Commands */}
            <CommandGroup heading="Commands">
              <CommandItem
                onSelect={handleCreateEvent}
                className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>Create Event</span>
              </CommandItem>
              <CommandItem
                onSelect={handleToggleDarkMode}
                className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
              >
                {isDark ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    <span>Toggle Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    <span>Toggle Dark Mode</span>
                  </>
                )}
              </CommandItem>
              <CommandItem
                onSelect={handleLogOut}
                className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log Out</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
