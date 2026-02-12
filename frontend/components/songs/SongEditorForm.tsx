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
        <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm text-gray-400">
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
        <div className={mode === 'page' ? 'space-y-4' : 'px-6 py-4 space-y-4 border-b border-white/10'}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium text-white">
                Title <span className="text-orange-500">*</span>
              </label>
              <Input
                id="title"
                placeholder="Amazing Grace"
                {...register('title')}
                className={`bg-white/5 border-white/10 text-white placeholder:text-gray-500 ${errors.title ? 'border-orange-500' : ''}`}
              />
              {errors.title && (
                <p className="text-xs text-orange-500">{errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="artist" className="text-sm font-medium text-white">
                Artist
              </label>
              <Input
                id="artist"
                placeholder="John Newton"
                {...register('artist')}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ccli_number" className="text-sm font-medium text-white">
                CCLI #
              </label>
              <Input
                id="ccli_number"
                placeholder="1234567"
                {...register('ccli_number')}
                className="font-mono bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Split view: Lyrics input | Preview */}
        <div className={mode === 'page' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden'}>
          {/* Left: Raw lyrics input */}
          <div className={mode === 'page' ? 'space-y-2' : 'flex flex-col border-r border-white/10 overflow-hidden'}>
            {mode === 'modal' && (
              <div className="px-4 py-2 border-b border-white/10 bg-white/5">
                <span className="text-xs font-medium text-white uppercase tracking-wider">
                  Lyrics
                </span>
              </div>
            )}
            {mode === 'page' && (
              <label htmlFor="lyrics" className="text-sm font-medium text-white">
                Lyrics <span className="text-orange-500">*</span>
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
                className={`${mode === 'page' ? 'min-h-[400px]' : 'h-full'} resize-none font-mono text-sm leading-relaxed bg-white/5 border-white/10 text-white placeholder:text-gray-500 ${
                  errors.lyrics ? 'border-orange-500' : ''
                }`}
              />
              {errors.lyrics && (
                <p className="text-xs text-orange-500 mt-2">{errors.lyrics.message}</p>
              )}
            </div>
          </div>

          {/* Right: Live preview */}
          <div className={mode === 'page' ? 'space-y-2' : 'flex flex-col overflow-hidden'}>
            {mode === 'modal' && (
              <div className="px-4 py-2 border-b border-white/10 bg-white/5">
                <span className="text-xs font-medium text-white uppercase tracking-wider">
                  Slide Preview
                </span>
              </div>
            )}
            {mode === 'page' && (
              <label className="text-sm font-medium text-white">
                Slide Preview
              </label>
            )}
          <div className={mode === 'page' ? '' : 'flex-1 p-4 overflow-hidden'}>
            <SongPreviewCards
              lyrics={lyricsValue}
              ccliNumber={watch('ccli_number') || undefined}
              className={mode === 'page' ? 'min-h-[400px]' : 'h-full'}
            />
          </div>
        </div>
        </div>

        {/* Footer */}
        <div className={mode === 'page' ? 'flex items-center justify-between pt-6 border-t' : 'px-6 py-4 border-t border-white/10 flex items-center justify-between bg-[#0A0A0A]'}>
          <span className="text-xs text-gray-400">
            {isDirty ? 'Draft auto-saved' : ''}
          </span>
          <div className="flex gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Song'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
