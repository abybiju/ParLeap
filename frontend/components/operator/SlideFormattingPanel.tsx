'use client';

import { useState } from 'react';
import { Wand2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { updateSongSlideConfig } from '@/app/songs/actions';
import { updateEventItemSlideConfig } from '@/app/events/actions';

// Simple auto-format helper (matches backend logic)
function autoFormatSlides(_lyrics: string, linesPerSlide: number = 4) {
  return {
    linesPerSlide,
    respectStanzaBreaks: true,
    manualBreaks: [],
  };
}

interface SlideFormattingPanelProps {
  songId: string;
  eventId?: string;
  eventItemId?: string;
  currentConfig?: {
    linesPerSlide?: number;
    respectStanzaBreaks?: boolean;
    manualBreaks?: number[];
  };
  lyrics: string;
  onConfigUpdated?: () => void;
}

/**
 * Slide Formatting Panel Component
 * 
 * Allows operators to customize slide formatting:
 * - Lines per slide (1-6)
 * - Respect stanza breaks toggle
 * - Magic wand auto-format
 * - Manual breaks (future: click-to-break UI)
 */
export function SlideFormattingPanel({
  songId,
  eventId,
  eventItemId,
  currentConfig,
  lyrics,
  onConfigUpdated,
}: SlideFormattingPanelProps) {
  const [linesPerSlide, setLinesPerSlide] = useState(currentConfig?.linesPerSlide ?? 4);
  const [respectStanzaBreaks, setRespectStanzaBreaks] = useState(currentConfig?.respectStanzaBreaks ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const handleMagicWand = () => {
    // Auto-format with sensible defaults
    const autoConfig = autoFormatSlides(lyrics, linesPerSlide);
    setLinesPerSlide(autoConfig.linesPerSlide);
    setRespectStanzaBreaks(autoConfig.respectStanzaBreaks);
    toast.success('Auto-formatted slides');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const config = {
        linesPerSlide,
        respectStanzaBreaks,
        manualBreaks: currentConfig?.manualBreaks ?? [],
      };

      let result;
      if (eventId && eventItemId) {
        // Save as event override
        result = await updateEventItemSlideConfig(eventId, eventItemId, config);
      } else {
        // Save as song default
        result = await updateSongSlideConfig(songId, config);
      }

      if (result.success) {
        toast.success('Slide formatting saved');
        onConfigUpdated?.();
      } else {
        toast.error(result.error || 'Failed to save formatting');
      }
    } catch (error) {
      toast.error('Failed to save formatting');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-white/10 bg-white/5 backdrop-blur">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Slide Formatting</h3>
      
      <div className="space-y-4">
        {/* Lines per slide */}
        <div>
          <label className="block text-xs text-slate-400 mb-2">
            Lines per slide
          </label>
          <select
            value={linesPerSlide}
            onChange={(e) => setLinesPerSlide(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'line' : 'lines'}
              </option>
            ))}
          </select>
        </div>

        {/* Respect stanza breaks */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">
            Respect stanza breaks
          </label>
          <button
            onClick={() => setRespectStanzaBreaks(!respectStanzaBreaks)}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${respectStanzaBreaks ? 'bg-indigo-600' : 'bg-slate-700'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${respectStanzaBreaks ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleMagicWand}
            className="flex-1 px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            Auto-format
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-3 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {eventId && eventItemId && (
          <p className="text-xs text-slate-500 mt-2">
            This override applies only to this event
          </p>
        )}
      </div>
    </div>
  );
}
