'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { CommandMenu } from '@/components/ui/CommandMenu'

interface CommandMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const CommandMenuContext = createContext<CommandMenuContextValue | undefined>(undefined)

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  // Handle Cmd/Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const isModKey = isMac ? e.metaKey : e.ctrlKey
      
      if (e.key === 'k' && isModKey) {
        // Don't trigger if user is typing in an input, textarea, or contenteditable
        const target = e.target as HTMLElement
        const isInput = 
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        
        if (!isInput) {
          e.preventDefault()
          toggle()
        }
      }
      
      // Close on Escape
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, toggle])

  // Apply saved theme preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      // Default to dark mode if no preference
      document.documentElement.classList.add('dark')
    }
  }, [])

  return (
    <CommandMenuContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <CommandMenu open={open} onOpenChange={setOpen} />
    </CommandMenuContext.Provider>
  )
}

export function useCommandMenu() {
  const context = useContext(CommandMenuContext)
  if (context === undefined) {
    throw new Error('useCommandMenu must be used within a CommandProvider')
  }
  return context
}
