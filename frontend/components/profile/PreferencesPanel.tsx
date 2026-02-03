'use client'

import { Moon, Mail, Globe } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface PreferencesPanelProps {
  className?: string
}

export function PreferencesPanel({ className }: PreferencesPanelProps) {
  const [darkMode, setDarkMode] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(false)
  const [timezone, setTimezone] = useState('America/New_York')

  // Check current theme on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark')
      setDarkMode(isDark)
    }
  }, [])

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked)
    if (typeof window !== 'undefined') {
      if (checked) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
    }
  }

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'UTC', label: 'UTC' },
  ]

  return (
    <div
      className={cn(
        'backdrop-blur-xl bg-[#0A0A0A]/60 border border-white/10 rounded-2xl p-6',
        className
      )}
    >
      <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">PREFERENCES</span>

      <div className="mt-4 space-y-6">
        {/* Theme Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-gray-400" />
            <span className="text-white">Dark Mode</span>
          </div>
          <Switch checked={darkMode} onCheckedChange={handleDarkModeToggle} />
        </div>

        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-white">Email Notifications</span>
          </div>
          <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
        </div>

        {/* Timezone */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              TIMEZONE
            </span>
          </div>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-white focus:border-orange-500 outline-none transition-colors"
          >
            {timezones.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-[#0A0A0A]">
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
