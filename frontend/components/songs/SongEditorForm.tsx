'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SongPreviewCards } from './SongPreviewCards'
import { useSongDraft } from '@/lib/hooks/useSongDraft'
import { songSchema, type SongFormData } from '@/lib/schemas/song'
import { createSong, updateSong } from '@/app/songs/actions'
import type { Database } from '@/lib/supabase/types'

type Song = Database['public']['Tables']['songs']['Row']

interface SongEditorFormProps {
  song?: Song | null
  onSuccess?: () => void
  onCancel?: () => void
  showDraftPrompt?: boolean
  onRestoreDraft?: () => void
  onDiscardDraft?: () => void
  mode?: 'modal' | 'page'
}

export function SongEditorForm({
  song,
  onSuccess,
  onCancel,
  showDraftPrompt = false,
  onRestoreDraft,
  onDiscardDraft,
  mode = 'modal',
}: SongEditorFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = Boolean(song)
  
  const { saveDraftDebounced, loadDraft, clearDraft } = useSongDraft(
    song?.id
  )

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<SongFormData>({
    resolver: zodResolver(songSchema),
    defaultValues: {
      title: '',
      artist: '',
      ccli_number: '',
      lyrics: '',
    },
  })

  const lyricsValue = watch('lyrics')
  const formValues = watch()

  // Initialize form with song data or draft
  useEffect(() => {
    if (song) {
      reset({
        title: song.title,
        artist: song.artist || '',
        ccli_number: song.ccli_number || '',
        lyrics: song.lyrics,
      })
    } else {
      reset({
        title: '',
        artist: '',
        ccli_number: '',
        lyrics: '',
      })
    }
  }, [song, reset])

  // Auto-save draft when form changes
  useEffect(() => {
    if (isDirty) {
      saveDraftDebounced(formValues)
    }
  }, [isDirty, formValues, saveDraftDebounced])

  const handleRestoreDraft = () => {
    const draft = loadDraft()
    if (draft) {
      if (draft.title) setValue('title', draft.title)
      if (draft.artist) setValue('artist', draft.artist)
      if (draft.ccli_number) setValue('ccli_number', draft.ccli_number)
      if (draft.lyrics) setValue('lyrics', draft.lyrics)
      toast.info('Draft restored')
    }
    onRestoreDraft?.()
  }

  const handleDiscardDraft = () => {
    clearDraft()
    onDiscardDraft?.()
  }

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('title', data.title)
      formData.set('artist', data.artist || '')
      formData.set('ccli_number', data.ccli_number || '')
      formData.set('lyrics', data.lyrics)

      const result = isEditing && song
        ? await updateSong(song.id, formData)
        : await createSong(formData)

      if (result.success) {
        clearDraft()
        toast.success(isEditing ? 'Song updated!' : 'Song created!')
        
        if (mode === 'page') {
          // Navigate back to songs list after save
          router.push('/songs')
          router.refresh()
        } else {
          onSuccess?.()
        }
      } else {
        toast.error(result.error || 'Something went wrong')
      }
    })
  })

  const handleCancel = () => {
    onCancel?.()
  }

  return (
    <div className={mode === 'page' ? 'space-y-6' : ''}>
      {/* Draft recovery prompt */}
      {showDraftPrompt && (
        <div className="px-6 py-3 bg-muted/50 border-b border-border/50 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            You have an unsaved draft. Would you like to restore it?
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscardDraft}
            >
              Discard
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleRestoreDraft}
            >
              Restore
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className={mode === 'page' ? 'space-y-6' : 'flex flex-col flex-1 overflow-hidden'}>
        {/* Metadata fields */}
        <div className={mode === 'page' ? 'space-y-4' : 'px-6 py-4 space-y-4 border-b border-border/50'}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="title"
                placeholder="Amazing Grace"
                {...register('title')}
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="artist" className="text-sm font-medium">
                Artist
              </label>
              <Input
                id="artist"
                placeholder="John Newton"
                {...register('artist')}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ccli_number" className="text-sm font-medium">
                CCLI #
              </label>
              <Input
                id="ccli_number"
                placeholder="1234567"
                {...register('ccli_number')}
                className="font-mono"
              />
            </div>
          </div>
        </div>

        {/* Split view: Lyrics input | Preview */}
        <div className={mode === 'page' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden'}>
          {/* Left: Raw lyrics input */}
          <div className={mode === 'page' ? 'space-y-2' : 'flex flex-col border-r border-border/50 overflow-hidden'}>
            {mode === 'modal' && (
              <div className="px-4 py-2 border-b border-border/30 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Lyrics
                </span>
              </div>
            )}
            {mode === 'page' && (
              <label htmlFor="lyrics" className="text-sm font-medium">
                Lyrics <span className="text-destructive">*</span>
              </label>
            )}
            <div className={mode === 'page' ? '' : 'flex-1 p-4 overflow-hidden'}>
              <Textarea
                id="lyrics"
                placeholder="Paste or type your lyrics here...

Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now I'm found
Was blind but now I see

'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed"
                {...register('lyrics')}
                className={`${mode === 'page' ? 'min-h-[400px]' : 'h-full'} resize-none font-mono text-sm leading-relaxed ${
                  errors.lyrics ? 'border-destructive' : ''
                }`}
              />
              {errors.lyrics && (
                <p className="text-xs text-destructive mt-2">{errors.lyrics.message}</p>
              )}
            </div>
          </div>

          {/* Right: Live preview */}
          <div className={mode === 'page' ? 'space-y-2' : 'flex flex-col overflow-hidden'}>
            {mode === 'modal' && (
              <div className="px-4 py-2 border-b border-border/30 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Slide Preview
                </span>
              </div>
            )}
            {mode === 'page' && (
              <label className="text-sm font-medium">
                Slide Preview
              </label>
            )}
            <div className={mode === 'page' ? '' : 'flex-1 p-4 overflow-hidden'}>
              <SongPreviewCards lyrics={lyricsValue} className={mode === 'page' ? 'min-h-[400px]' : 'h-full'} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={mode === 'page' ? 'flex items-center justify-between pt-6 border-t' : 'px-6 py-4 border-t border-border/50 flex items-center justify-between bg-background'}>
          <span className="text-xs text-muted-foreground">
            {isDirty ? 'Draft auto-saved' : ''}
          </span>
          <div className="flex gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Song'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
