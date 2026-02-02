'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SongEditorForm } from './SongEditorForm'
import { useSongDraft } from '@/lib/hooks/useSongDraft'
import type { Database } from '@/lib/supabase/types'

type Song = Database['public']['Tables']['songs']['Row']

interface SongEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  song?: Song | null
  onSuccess?: () => void
}

export function SongEditorModal({
  open,
  onOpenChange,
  song,
  onSuccess,
}: SongEditorModalProps) {
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const { hasDraft } = useSongDraft(song?.id)

  // Check for draft on open
  useEffect(() => {
    if (open && hasDraft()) {
      setShowDraftPrompt(true)
    } else {
      setShowDraftPrompt(false)
    }
  }, [open, hasDraft])

  const handleSuccess = () => {
    onOpenChange(false)
    onSuccess?.()
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {song ? 'Edit Song' : 'New Song'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <SongEditorForm
          song={song}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          showDraftPrompt={showDraftPrompt}
          onRestoreDraft={() => setShowDraftPrompt(false)}
          onDiscardDraft={() => setShowDraftPrompt(false)}
          mode="modal"
        />
      </DialogContent>
    </Dialog>
  )
}
