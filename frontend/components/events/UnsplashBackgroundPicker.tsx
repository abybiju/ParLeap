'use client';

import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateEventBackground } from '@/app/events/actions';
import type { UnsplashSearchResult } from '@/app/api/unsplash/search/route';
import { toast } from 'sonner';

interface UnsplashBackgroundPickerProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UnsplashBackgroundPicker({
  eventId,
  open,
  onOpenChange,
  onSuccess,
}: UnsplashBackgroundPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnsplashSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch(`/api/unsplash/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Search failed');
        return;
      }
      setResults(data.results ?? []);
      if (!data.results?.length) {
        toast.info('No images found. Try another search.');
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleSelect = useCallback(
    async (url: string) => {
      setSaving(true);
      try {
        const result = await updateEventBackground(eventId, url);
        if (!result.success) {
          toast.error(result.error || 'Failed to set background');
          return;
        }
        toast.success('Background image set');
        onOpenChange(false);
        onSuccess?.();
      } finally {
        setSaving(false);
      }
    },
    [eventId, onOpenChange, onSuccess]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Search Unsplash</DialogTitle>
          <DialogDescription className="sr-only">
            Search for a background image for the projector. Results from Unsplash.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-slate-400">
          Choose a background image for the projector. Photo by photographer on Unsplash.
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="e.g. worship, sunset, church"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500"
          />
          <Button
            type="button"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="shrink-0"
          >
            <Search className="h-4 w-4 mr-1" />
            Search
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {loading && (
            <div className="py-12 text-center text-slate-400">Loading...</div>
          )}
          {!loading && results.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {results.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handleSelect(photo.urls.regular)}
                  disabled={saving}
                  className="relative aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash URL */}
                  <img
                    src={photo.urls.regular}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/70 py-1 px-2 text-[10px] text-slate-300 truncate">
                    Photo by {photo.user.name} on Unsplash
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
