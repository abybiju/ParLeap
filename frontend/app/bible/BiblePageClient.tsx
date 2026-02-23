'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getBackendHttpUrl } from '@/lib/utils/backendUrl'
import { ArrowLeft, BookOpen } from 'lucide-react'

interface BibleVersionOption {
  id: string
  name: string
  abbrev: string
  is_default: boolean
}

interface VersePayload {
  reference: string
  book: string
  chapter: number
  verses: { verse: number; text: string }[]
  versionAbbrev: string
}

export function BiblePageClient() {
  const searchParams = useSearchParams()
  const refParam = searchParams.get('ref') ?? ''
  const versionParam = searchParams.get('version') ?? ''

  const [versions, setVersions] = useState<BibleVersionOption[]>([])
  const [payload, setPayload] = useState<VersePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const defaultVersionId = versions.find((v) => v.is_default)?.id ?? versions[0]?.id ?? ''
  const selectedVersionId = versionParam || defaultVersionId

  const fetchVersions = useCallback(async () => {
    const backend = getBackendHttpUrl()
    const res = await fetch(`${backend}/api/bible/versions`)
    if (!res.ok) return
    const data = await res.json()
    setVersions(data.versions ?? [])
  }, [])

  const fetchVerse = useCallback(
    async (ref: string, versionId: string) => {
      if (!ref.trim() || !versionId) {
        setPayload(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      const backend = getBackendHttpUrl()
      try {
        const res = await fetch(
          `${backend}/api/bible/verse?ref=${encodeURIComponent(ref)}&versionId=${encodeURIComponent(versionId)}`
        )
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Failed to load verse')
          setPayload(null)
          return
        }
        setPayload(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load verse')
        setPayload(null)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  useEffect(() => {
    if (!refParam) {
      setLoading(false)
      setPayload(null)
      return
    }
    const versionId = versionParam || (versions.find((v) => v.is_default)?.id ?? versions[0]?.id)
    if (versionId) {
      fetchVerse(refParam, versionId)
    } else if (versions.length === 0) {
      setLoading(true)
    } else {
      setLoading(false)
    }
  }, [refParam, versionParam, versions, fetchVerse])

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    if (!id || !refParam) return
    const url = new URL(window.location.href)
    url.searchParams.set('version', id)
    window.history.replaceState({}, '', url.toString())
    fetchVerse(refParam, id)
  }

  if (!refParam) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-400 mb-6">No reference specified. Use the command palette (⌘K) and type <code className="bg-white/10 px-1.5 py-0.5 rounded">/verse Matthew 2:4-5</code> to open a verse.</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <span className="text-gray-600">|</span>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-yellow-500" />
          <span className="font-medium text-white">{refParam}</span>
        </div>
        {versions.length > 0 && (
          <select
            value={selectedVersionId}
            onChange={handleVersionChange}
            className="ml-auto bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            aria-label="Bible version"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.abbrev})
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <p className="text-gray-400">Loading…</p>
      )}

      {error && (
        <p className="text-red-400 mb-4">{error}</p>
      )}

      {!loading && payload && (
        <div className="space-y-4">
          {payload.versionAbbrev && (
            <p className="text-xs text-gray-500 uppercase tracking-wide">{payload.versionAbbrev}</p>
          )}
          <div className="space-y-3 text-lg text-gray-200 leading-relaxed">
            {payload.verses.map((v) => (
              <p key={v.verse}>
                <span className="text-gray-500 font-medium mr-2 align-super text-sm">{v.verse}</span>
                {v.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
