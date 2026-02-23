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
import { getSongsSearch, getEventsSearch } from '@/app/events/actions'
import { Badge } from '@/components/ui/badge'
import { getBackendHttpUrl } from '@/lib/utils/backendUrl'

interface BibleVersionOption {
  id: string
  name: string
  abbrev: string
  is_default: boolean
}

const SONGS_SEARCH_LIMIT = 20
const EVENTS_SEARCH_LIMIT = 10
const SEARCH_DEBOUNCE_MS = 300

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
  const [songs, setSongs] = useState<{ id: string; title: string; artist: string | null }[]>([])
  const [events, setEvents] = useState<{ id: string; name: string; event_date: string | null; status: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [rawInput, setRawInput] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [bibleVersions, setBibleVersions] = useState<BibleVersionOption[]>([])

  // Parse input to get context and query
  const { context: commandContext, query: searchQuery } = parseInput(rawInput)

  const defaultBibleVersionId = bibleVersions.find((v) => v.is_default)?.id ?? bibleVersions[0]?.id ?? null

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

  // Server-side search: debounced when user types (no fetch on open)
  useEffect(() => {
    if (!open) return

    const q = searchQuery.trim()
    const timer = setTimeout(() => {
      if (!q) {
        setSongs([])
        setEvents([])
        setLoading(false)
        return
      }
      setLoading(true)
      Promise.all([
        getSongsSearch({ query: q, limit: SONGS_SEARCH_LIMIT, offset: 0 }),
        getEventsSearch({ query: q, limit: EVENTS_SEARCH_LIMIT }),
      ])
        .then(([songsRes, eventsRes]) => {
          setSongs(songsRes.data)
          setEvents(eventsRes.data)
        })
        .catch((err) => {
          console.error('Command menu search error:', err)
          setSongs([])
          setEvents([])
        })
        .finally(() => setLoading(false))
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [open, searchQuery])

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

  // Fetch Bible versions when command palette opens (for VERSE context / version picker)
  useEffect(() => {
    if (!open) return
    const backend = getBackendHttpUrl()
    fetch(`${backend}/api/bible/versions`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch versions')))
      .then((data: { versions?: BibleVersionOption[] }) => setBibleVersions(data.versions ?? []))
      .catch(() => setBibleVersions([]))
  }, [open])

  // Songs and events are now server-side search results (set in debounced effect above)

  // Check if search looks like a Bible reference (e.g. "John 3:16", "Psalm 23", "Matthew 2:4-5")
  const isBibleReference = /^[a-z]+\s*\d+([:\d\-]+)?$/i.test(searchQuery.trim())

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

  const handleScriptureSelect = (reference: string, versionId?: string | null) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery)
    }
    const vid = versionId ?? defaultBibleVersionId
    if (vid) {
      router.push(`/bible?ref=${encodeURIComponent(reference)}&version=${encodeURIComponent(vid)}`)
    }
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
          <div className="relative w-full">
            {/* Context Badge */}
            {commandContext !== 'ALL' && (
              <Badge
                variant={
                  commandContext === 'SONG' ? 'orange' :
                  commandContext === 'VERSE' ? 'yellow' :
                  'blue'
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center gap-1.5 border-0"
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
              className={`w-full h-14 text-lg border-0 border-b border-white/10 bg-transparent text-white placeholder:text-gray-500 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                commandContext !== 'ALL' ? 'pl-24 pr-4' : 'px-4'
              }`}
            />
          </div>
          <CommandList className="max-h-[400px] overflow-y-auto p-2 pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-white/20">
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

            {/* GROUP 2b: Open Song Library when /song with no query */}
            {commandContext === 'SONG' && !searchQuery.trim() && (
              <CommandGroup heading="Songs">
                <CommandItem
                  onSelect={() => handleNavigate('/songs')}
                  className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                >
                  <Music className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Open Song Library</span>
                    <span className="text-xs text-gray-500">Type a song name to search</span>
                  </div>
                </CommandItem>
              </CommandGroup>
            )}

            {/* GROUP 3: Songs (server-side search; show when user has typed) */}
            {(commandContext === 'ALL' || commandContext === 'SONG') && searchQuery.trim() && songs.length > 0 && (
              <CommandGroup heading="Songs">
                {songs.slice(0, 10).map((song) => (
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

            {/* GROUP 4: Scripture (shortcuts + typed reference with version picker) */}
            {(commandContext === 'ALL' || commandContext === 'VERSE') && (filteredScripture.length > 0 || isBibleReference || (commandContext === 'VERSE' && !searchQuery.trim())) && (
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
                  <>
                    {defaultBibleVersionId && (
                      <CommandItem
                        onSelect={() => handleScriptureSelect(searchQuery.trim())}
                        className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                      >
                        <BookOpen className="mr-2 h-4 w-4 text-yellow-500" />
                        <span>Open {searchQuery.trim()}</span>
                      </CommandItem>
                    )}
                    {bibleVersions.map((v) => (
                      <CommandItem
                        key={v.id}
                        onSelect={() => handleScriptureSelect(searchQuery.trim(), v.id)}
                        className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500 pl-8"
                      >
                        <BookOpen className="mr-2 h-4 w-4 text-yellow-500/70" />
                        <span>Open in {v.abbrev}</span>
                      </CommandItem>
                    ))}
                  </>
                )}
              </CommandGroup>
            )}

            {/* GROUP 5: Events (server-side search; show when user has typed) */}
            {(commandContext === 'ALL' || commandContext === 'EVENT') && searchQuery.trim() && events.length > 0 && (
              <CommandGroup heading="Events">
                {events.slice(0, 10).map((event) => (
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
