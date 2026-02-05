'use client';

import { OperatorHUD } from '@/components/operator/OperatorHUD';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

interface LivePageClientProps {
  eventId: string;
  eventName: string;
  projectorFont?: string | null;
  bibleMode?: boolean;
  bibleVersionId?: string | null;
  initialSetlist: Array<{
    id: string;
    title: string;
    artist: string | null;
    sequenceOrder: number;
  }>;
  hasSupabaseMismatch: boolean;
  frontendProjectRef: string | null;
  backendProjectRef: string | null;
  backendConfigured: boolean;
  backendHealthError: Error | null;
}

/**
 * Client component for Live page that handles empty states and Supabase mismatch
 */
export function LivePageClient({
  eventId,
  eventName,
  projectorFont = null,
  bibleMode = false,
  bibleVersionId = null,
  initialSetlist,
  hasSupabaseMismatch,
  frontendProjectRef,
  backendProjectRef,
  backendConfigured,
  backendHealthError,
}: LivePageClientProps) {
  // Show Supabase mismatch error
  if (hasSupabaseMismatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Supabase Configuration Mismatch</h1>
          </div>
          
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 space-y-4">
            <p className="text-slate-300">
              The frontend and backend are pointing to different Supabase projects (or backend Supabase is not configured). 
              This prevents live sessions from working because the backend cannot find events that exist in the frontend database.
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-slate-400">Frontend Project:</span>
                <span className="font-mono text-sm text-white">{frontendProjectRef || 'Not configured'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-slate-400">Backend Project:</span>
                <span className="font-mono text-sm text-white">
                  {backendProjectRef || (backendHealthError ? 'Health check failed' : (backendConfigured ? 'Configured but no ref' : 'Not configured'))}
                </span>
              </div>
            </div>
            
            {backendHealthError && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-300">
                  ⚠️ Could not verify backend configuration. Check that the backend is accessible and the health endpoint is working.
                </p>
              </div>
            )}
            
            <div className="pt-4 border-t border-white/10">
              <p className="text-sm text-slate-400 mb-3">To fix this:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                <li>Go to your backend deployment (Railway/Vercel)</li>
                <li>Set <code className="bg-white/10 px-1 py-0.5 rounded">SUPABASE_URL</code> and <code className="bg-white/10 px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> to match the frontend project</li>
                <li>Verify the backend health endpoint returns the correct project ref</li>
                <li>Redeploy the backend</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
          
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Show empty setlist error
  if (initialSetlist.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-xl font-semibold">No Setlist Loaded</h1>
          </div>
          
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
            <p className="text-slate-300 mb-4">
              This event doesn&apos;t have any songs in its setlist yet. Add songs to the event before starting a live session.
            </p>
            
            <div className="flex flex-col gap-3">
              <Link
                href={`/events/${eventId}`}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                Go to Event
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show backend health error (non-blocking, but log it)
  if (backendHealthError) {
    console.warn('[LivePage] Failed to fetch backend health:', backendHealthError);
  }

  // Normal operation: render OperatorHUD with initial setlist
  return (
    <OperatorHUD
      eventId={eventId}
      eventName={eventName}
      initialProjectorFont={projectorFont}
      initialBibleMode={bibleMode}
      initialBibleVersionId={bibleVersionId}
      initialSetlist={initialSetlist}
    />
  );
}
