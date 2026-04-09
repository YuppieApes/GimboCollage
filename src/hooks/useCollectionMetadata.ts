import { useState, useEffect } from 'react'
import type { GimbozMetadataById } from '../utils/tokenOrdering'

export type CollectionMetadataPayload = {
  byId: GimbozMetadataById
  builtAt: string
}

let cache: CollectionMetadataPayload | null = null

const REFETCH_MS = 30 * 60 * 1000

export function useCollectionMetadata() {
  const [data, setData] = useState<CollectionMetadataPayload | null>(cache)
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(initial: boolean) {
      try {
        const res = await fetch(`/gimboz-metadata.json?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { byId?: GimbozMetadataById; builtAt?: string }
        const payload: CollectionMetadataPayload = {
          byId: json.byId ?? {},
          builtAt: json.builtAt ?? '',
        }
        cache = payload
        if (!cancelled) {
          setData(payload)
          setError(null)
          if (initial) setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          if (initial && !cache) {
            setError(e instanceof Error ? e.message : 'Failed to load metadata')
            setData({ byId: {}, builtAt: '' })
          }
          if (initial) setLoading(false)
        }
      }
    }

    const hadCache = cache != null
    if (hadCache) {
      setData(cache)
      setLoading(false)
    }

    void load(!hadCache)

    const intervalId = window.setInterval(() => {
      void load(false)
    }, REFETCH_MS)

    const onFocus = () => {
      void load(false)
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return {
    byId: data?.byId ?? null,
    builtAt: data?.builtAt ?? '',
    loading,
    error,
    hasTraits: data != null && Object.keys(data.byId).length > 0,
  }
}
