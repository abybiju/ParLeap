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
import { Music, Calendar, BookOpen, Plus, Moon, Sun, LogOut, Home } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Song = Database['public']['Tables']['songs']['Row']
type Event = Database['public']['Tables']['events']['Row']

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter()
  const { signOut } = useAuthStore()
  const [songs, setSongs] = useState<Song[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [isDark, setIsDark] = useState(false)

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
    if (!search) return true
    const query = search.toLowerCase()
    return (
      song.title?.toLowerCase().includes(query) ||
      song.artist?.toLowerCase().includes(query) ||
      song.lyrics?.toLowerCase().includes(query)
    )
  })

  // Filter events by search query
  const filteredEvents = events.filter((event) => {
    if (!search) return true
    const query = search.toLowerCase()
    return event.name?.toLowerCase().includes(query)
  })

  // Check if search looks like a Bible reference (e.g., "John 3:16", "Psalm 23")
  const isBibleReference = /^[a-z]+\s*\d+[:\d]*$/i.test(search.trim())

  // Mock scripture items
  const scriptureItems = [
    { id: 'psalm-23', label: 'Psalm 23', reference: 'Psalm 23' },
    { id: 'john-3-16', label: 'John 3:16', reference: 'John 3:16' },
    { id: 'romans-8-28', label: 'Romans 8:28', reference: 'Romans 8:28' },
    { id: 'philippians-4-13', label: 'Philippians 4:13', reference: 'Philippians 4:13' },
  ]

  const filteredScripture = scriptureItems.filter((item) => {
    if (!search) return true
    const query = search.toLowerCase()
    return item.label.toLowerCase().includes(query) || item.reference.toLowerCase().includes(query)
  })

  const handleSongSelect = (songId: string) => {
    router.push(`/dashboard/songs/${songId}`)
    onOpenChange(false)
  }

  const handleEventSelect = (eventId: string) => {
    router.push(`/events/${eventId}`)
    onOpenChange(false)
  }

  const handleCreateEvent = () => {
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
    router.push(path)
    onOpenChange(false)
  }

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 border-white/10 bg-[#0A0A0A] shadow-2xl [&>button]:hidden [&>div]:bg-black/60 [&>div]:backdrop-blur-sm">
        <Command
          className="rounded-xl"
          shouldFilter={false}
        >
          <CommandInput
            placeholder="Type a command or search..."
            value={search}
            onValueChange={setSearch}
            className="h-14 text-lg border-0 border-b border-white/10 bg-transparent text-white placeholder:text-gray-500 focus:ring-0 focus:ring-offset-0"
          />
          <CommandList className="max-h-[400px] overflow-y-auto p-2">
            <CommandEmpty className="py-6 text-center text-sm text-gray-400">
              {loading ? 'Loading...' : 'No results found.'}
            </CommandEmpty>

            {/* GROUP 1: Suggestions (context-aware quick actions) */}
            {!search && (
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

            {/* GROUP 2: Songs */}
            {filteredSongs.length > 0 && (
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

            {/* GROUP 3: Scripture */}
            {(filteredScripture.length > 0 || isBibleReference) && (
              <CommandGroup heading="Scripture">
                {filteredScripture.map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      // Future: Navigate to Bible Reader
                      console.log('Navigate to scripture:', item.reference)
                      onOpenChange(false)
                    }}
                    className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                  >
                    <BookOpen className="mr-2 h-4 w-4 text-yellow-500" />
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
                {isBibleReference && !filteredScripture.some((s) => s.reference.toLowerCase() === search.trim().toLowerCase()) && (
                  <CommandItem
                    onSelect={() => {
                      // Future: Navigate to Bible Reader with parsed reference
                      console.log('Navigate to scripture:', search.trim())
                      onOpenChange(false)
                    }}
                    className="text-gray-400 p-3 rounded-lg cursor-pointer transition-all data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-500 data-[selected=true]:border-l-2 data-[selected=true]:border-orange-500"
                  >
                    <BookOpen className="mr-2 h-4 w-4 text-yellow-500" />
                    <span>Open {search.trim()}</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}

            {/* GROUP 4: Events */}
            {filteredEvents.length > 0 && (
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

            {/* GROUP 5: Commands */}
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
