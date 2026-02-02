'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { CalendarClock, ChevronLeft, ChevronRight, Target } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface GlassDatePickerProps {
  value?: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
}

// Helper functions
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function getFirstDayOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  // Convert to Monday = 0, Sunday = 6
  return (firstDay.getDay() + 6) % 7
}

function getMonthName(date: Date): string {
  return format(date, 'MMMM')
}

function getYearRange(): number[] {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i)
  }
  return years
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

function isSameDay(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

// Format date and time for display
function formatDateTime(date: Date): string {
  return format(date, 'MMM d, yyyy - h:mm a')
}

// Get timezone abbreviation
function getTimezoneAbbr(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
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

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

type ViewMode = 'day' | 'month' | 'year'

export function GlassDatePicker({ value, onChange, placeholder = 'Select date and time' }: GlassDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => value || new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(value || null)
  const [viewMode, setViewMode] = useState<ViewMode>('day')
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
      setCurrentMonth(value)
      const time = extractTime(value)
      setHours(time.hours)
      setMinutes(time.minutes)
      setPeriod(time.period)
    } else {
      setSelectedDate(null)
      setHours(9)
      setMinutes(0)
      setPeriod('AM')
    }
  }, [value])

  // Helper to update parent with current date/time
  const updateDateTime = (date: Date | null, hrs: number, mins: number, per: 'AM' | 'PM') => {
    // If no date selected, use today
    const dateToUse = date || new Date()
    const newDateTime = createDateTime(dateToUse, hrs, mins, per)
    if (newDateTime) {
      // If no date was selected, also set it
      if (!date) {
        setSelectedDate(dateToUse)
      }
      onChange(newDateTime)
    }
  }

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    setSelectedDate(newDate)
    setViewMode('day')
    updateDateTime(newDate, hours, minutes, period)
  }

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentMonth.getFullYear(), monthIndex, 1)
    setCurrentMonth(newDate)
    setViewMode('day')
  }

  const handleYearSelect = (year: number) => {
    const newDate = new Date(year, currentMonth.getMonth(), 1)
    setCurrentMonth(newDate)
    setViewMode('month')
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleAutoTime = () => {
    const now = new Date()
    setSelectedDate(now)
    setCurrentMonth(now)
    const time = extractTime(now)
    setHours(time.hours)
    setMinutes(time.minutes)
    setPeriod(time.period)
    onChange(now)
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days: (number | null)[] = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    return days
  }

  const calendarDays = generateCalendarDays()
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
      <PopoverContent 
        className="w-auto p-0 bg-[#050505]/95 backdrop-blur-xl border border-white/10 rounded-xl" 
        align="start"
      >
        {/* Auto-Time Target Icon */}
        <button
          onClick={handleAutoTime}
          className="absolute top-3 right-3 z-10 text-slate-500 hover:text-orange-400 cursor-pointer transition-colors"
          title="Set to current time"
        >
          <Target className="w-4 h-4" />
        </button>

        <div className="flex">
          {/* Left: Date Picker */}
          <div className="w-[320px] p-4">
            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="text-slate-400 hover:text-orange-400 transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode(viewMode === 'month' ? 'day' : 'month')}
                  className="text-white font-medium hover:text-orange-400 transition-colors"
                >
                  {getMonthName(currentMonth)}
                </button>
                <button
                  onClick={() => setViewMode(viewMode === 'year' ? 'day' : 'year')}
                  className="text-white font-medium hover:text-orange-400 transition-colors"
                >
                  {currentMonth.getFullYear()}
                </button>
              </div>

              <button
                onClick={handleNextMonth}
                className="text-slate-400 hover:text-orange-400 transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* View Mode Content */}
            {viewMode === 'day' && (
              <>
                {/* Day Names Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAY_NAMES.map((day) => (
                    <div
                      key={day}
                      className="text-xs text-slate-400 font-medium text-center py-1"
                    >
                      {day.slice(0, 3)}
                    </div>
                  ))}
                </div>

                {/* Date Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => {
                    if (day === null) {
                      return <div key={`empty-${index}`} className="w-10 h-10" />
                    }

                    const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                    const isSelected = selectedDate && isSameDay(cellDate, selectedDate)
                    const isTodayDate = isToday(cellDate)

                    return (
                      <button
                        key={day}
                        onClick={() => handleDateSelect(day)}
                        className={cn(
                          'w-10 h-10 rounded-md transition-all duration-200 text-sm',
                          'flex items-center justify-center',
                          isSelected
                            ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold'
                            : 'text-white hover:bg-white/10',
                          isTodayDate && !isSelected && 'border-2 border-orange-500/50',
                          day === null && 'text-slate-500 opacity-50'
                        )}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {viewMode === 'month' && (
              <div className="grid grid-cols-3 gap-2">
                {MONTH_NAMES.map((month, index) => {
                  const isSelected = currentMonth.getMonth() === index
                  return (
                    <button
                      key={month}
                      onClick={() => handleMonthSelect(index)}
                      className={cn(
                        'px-4 py-2 rounded-md text-sm transition-all duration-200',
                        isSelected
                          ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold'
                          : 'text-white hover:bg-white/10'
                      )}
                    >
                      {month.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            )}

            {viewMode === 'year' && (
              <div className="max-h-[240px] overflow-y-auto pr-2">
                <div className="space-y-1">
                  {getYearRange().map((year) => {
                    const isSelected = currentMonth.getFullYear() === year
                    const isCurrentYear = new Date().getFullYear() === year
                    return (
                      <button
                        key={year}
                        onClick={() => handleYearSelect(year)}
                        className={cn(
                          'w-full px-4 py-2 rounded-md text-sm transition-all duration-200 text-left',
                          isSelected
                            ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold'
                            : 'text-white hover:bg-white/10',
                          isCurrentYear && !isSelected && 'border border-orange-500/50'
                        )}
                      >
                        {year}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-l border-white/[0.08]" />

          {/* Right: Time Picker */}
          <div className="w-[200px] p-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Hours</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={hours}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1
                    const newHours = Math.max(1, Math.min(12, val))
                    setHours(newHours)
                    updateDateTime(selectedDate, newHours, minutes, period)
                  }}
                  className="w-full bg-transparent border border-white/10 text-white text-center rounded-md px-4 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-2 block">Minutes</label>
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
                    updateDateTime(selectedDate, hours, newMinutes, period)
                  }}
                  className="w-full bg-transparent border border-white/10 text-white text-center rounded-md px-4 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-2 block">Period</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPeriod('AM')
                      updateDateTime(selectedDate, hours, minutes, 'AM')
                    }}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-md text-sm transition-all duration-200',
                      period === 'AM'
                        ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold'
                        : 'bg-transparent border border-white/10 text-white hover:bg-white/10'
                    )}
                  >
                    AM
                  </button>
                  <button
                    onClick={() => {
                      setPeriod('PM')
                      updateDateTime(selectedDate, hours, minutes, 'PM')
                    }}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-md text-sm transition-all duration-200',
                      period === 'PM'
                        ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold'
                        : 'bg-transparent border border-white/10 text-white hover:bg-white/10'
                    )}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.08]">
          <span className="text-xs text-slate-400">
            📍 {timezone} (Auto)
          </span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
