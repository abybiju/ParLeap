'use client'

import { Moon, Mail, Globe } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useState, useEffect } from 'react'
import { StatsDeck } from '../StatsDeck'

export function AccountSection() {
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
    <div className="space-y-8">
      {/* Stats Card */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-8">
        <div>
          <h2 className="text-xl font-semibold text-white">Account Statistics</h2>
          <p className="text-sm text-gray-400 mt-1">Overview of your account activity</p>
        </div>

        <div className="border-b border-white/5 my-6" />

        <StatsDeck className="bg-transparent border-0 p-0" />
      </div>

      {/* Preferences Card */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-8">
        <div>
          <h2 className="text-xl font-semibold text-white">Preferences</h2>
          <p className="text-sm text-gray-400 mt-1">Customize your experience</p>
        </div>

        <div className="border-b border-white/5 my-6" />

        <div className="grid grid-cols-1 gap-6">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-gray-400" />
              <div>
                <label className="text-sm font-medium text-white">Dark Mode</label>
                <p className="text-xs text-gray-400">Toggle dark theme</p>
              </div>
            </div>
            <Switch checked={darkMode} onCheckedChange={handleDarkModeToggle} />
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <div>
                <label className="text-sm font-medium text-white">Email Notifications</label>
                <p className="text-xs text-gray-400">Receive email updates</p>
              </div>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>

          {/* Timezone */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <label className="text-sm font-medium text-gray-400">Timezone</label>
            </div>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-gray-900">
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
