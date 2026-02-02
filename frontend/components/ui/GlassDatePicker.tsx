'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { CalendarClock } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface GlassDatePickerProps {
  value?: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
}

// Format date and time for display
function formatDateTime(date: Date): string {
  return format(date, 'MMM d, yyyy - h:mm a')
}

// Get timezone abbreviation
function getTimezoneAbbr(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    // Extract abbreviation from timezone string (e.g., "America/New_York" -> "EST")
    const date = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(date)
    const tzPart = parts.find((part) => part.type === 'timeZoneName')
    return tzPart?.value || timezone.split('/').pop()?.slice(0, 3).toUpperCase() || 'UTC'
  } catch {
    return 'UTC'
  }
}

// Extract time components from Date
function extractTime(date: Date): { hours: number; minutes: number; period: 'AM' | 'PM' } {
  const hours24 = date.getHours()
  const minutes = date.getMinutes()
  const hours12 = hours24 % 12 || 12
  const period = hours24 >= 12 ? 'PM' : 'AM'
  return { hours: hours12, minutes, period }
}

// Create Date from date and time components
function createDateTime(
  date: Date | null,
  hours: number,
  minutes: number,
  period: 'AM' | 'PM'
): Date | null {
  if (!date) return null
  
  const hours24 = period === 'PM' && hours !== 12 ? hours + 12 : period === 'AM' && hours === 12 ? 0 : hours
  const newDate = new Date(date)
  newDate.setHours(hours24, minutes, 0, 0)
  return newDate
}

export function GlassDatePicker({ value, onChange, placeholder = 'Select date and time' }: GlassDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value || undefined)
  const [hours, setHours] = useState(() => {
    if (value) {
      const time = extractTime(value)
      return time.hours
    }
    return 9
  })
  const [minutes, setMinutes] = useState(() => {
    if (value) {
      const time = extractTime(value)
      return time.minutes
    }
    return 0
  })
  const [period, setPeriod] = useState<'AM' | 'PM'>(() => {
    if (value) {
      const time = extractTime(value)
      return time.period
    }
    return 'AM'
  })

  // Update internal state when value prop changes
  useEffect(() => {
    if (value) {
      setSelectedDate(value)
      const time = extractTime(value)
      setHours(time.hours)
      setMinutes(time.minutes)
      setPeriod(time.period)
    } else {
      setSelectedDate(undefined)
      setHours(9)
      setMinutes(0)
      setPeriod('AM')
    }
  }, [value])

  // Helper to update parent with current date/time
  const updateDateTime = (date: Date | undefined, hrs: number, mins: number, per: 'AM' | 'PM') => {
    if (date) {
      const newDateTime = createDateTime(date, hrs, mins, per)
      if (newDateTime) {
        onChange(newDateTime)
      }
    } else {
      onChange(null)
    }
  }

  const handleLiveClick = () => {
    const now = new Date()
    setSelectedDate(now)
    const time = extractTime(now)
    setHours(time.hours)
    setMinutes(time.minutes)
    setPeriod(time.period)
    onChange(now)
  }

  const timezone = getTimezoneAbbr()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            'bg-white/5 border-white/10 text-white',
            'hover:bg-white/10 hover:text-orange-500',
            !value && 'text-slate-400'
          )}
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          {value ? formatDateTime(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-[#050505]/95 backdrop-blur-xl border border-white/10" align="start">
        <div className="p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date)
              updateDateTime(date, hours, minutes, period)
            }}
            initialFocus
          />
        </div>
        
        {/* Time Inputs Section */}
        <div className="px-4 pb-4 border-t border-white/[0.08] pt-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Hours</label>
              <input
                type="number"
                min="1"
                max="12"
                value={hours}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1
                  const newHours = Math.max(1, Math.min(12, val))
                  setHours(newHours)
                  if (selectedDate) {
                    updateDateTime(selectedDate, newHours, minutes, period)
                  }
                }}
                className="w-full bg-transparent border border-white/10 text-white text-center rounded-md px-3 py-2 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                step="15"
                value={minutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  const newMinutes = Math.max(0, Math.min(59, val))
                  setMinutes(newMinutes)
                  if (selectedDate) {
                    updateDateTime(selectedDate, hours, newMinutes, period)
                  }
                }}
                className="w-full bg-transparent border border-white/10 text-white text-center rounded-md px-3 py-2 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Period</label>
              <select
                value={period}
                onChange={(e) => {
                  const newPeriod = e.target.value as 'AM' | 'PM'
                  setPeriod(newPeriod)
                  if (selectedDate) {
                    updateDateTime(selectedDate, hours, minutes, newPeriod)
                  }
                }}
                className="w-full bg-transparent border border-white/10 text-white text-center rounded-md px-3 py-2 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50"
              >
                <option value="AM" className="bg-[#050505]">AM</option>
                <option value="PM" className="bg-[#050505]">PM</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.08]">
          <span className="text-xs text-slate-400">
            📍 {timezone} (Auto)
          </span>
          <button
            onClick={handleLiveClick}
            className="text-xs text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider cursor-pointer transition-colors"
          >
            Live
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
