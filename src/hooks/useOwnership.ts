import { useState, useEffect, useCallback } from 'react'

interface OwnershipData {
  [address: string]: number[]
}

const IMAGE_BASE = 'https://storage.googleapis.com/gimboz-public/AjhoiwlksdnERUB/3d/pfp/'
const IMAGE_EXT = '.png'

/** Poll ownership.json so deploys / CI updates show up without a full reload. */
const REFETCH_MS = 3 * 60 * 1000

let ownershipCache: OwnershipData | null = null

export function useOwnership() {
  const [ownership, setOwnership] = useState<OwnershipData | null>(ownershipCache)
  const [loading, setLoading] = useState(!ownershipCache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(initial: boolean) {
      try {
        const res = await fetch(`/ownership.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load ownership data')
        const data: OwnershipData = await res.json()
        ownershipCache = data
        if (!cancelled) {
          setOwnership(data)
          setError(null)
          if (initial) setLoading(false)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          if (initial && !ownershipCache) {
            setError(err instanceof Error ? err.message : 'Failed to load ownership')
          }
          if (initial) setLoading(false)
        }
      }
    }

    const hadCache = ownershipCache != null
    if (hadCache) {
      setOwnership(ownershipCache)
      setLoading(false)
    }

    void load(!hadCache)

    const intervalId = window.setInterval(() => {
      void load(false)
    }, REFETCH_MS)

    const refetch = () => {
      void load(false)
    }

    const onFocus = () => {
      refetch()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch()
      }
    }

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        refetch()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  const getTokensForWallet = useCallback((address: string): number[] => {
    if (!ownership) return []
    const normalized = address.toLowerCase()
    return ownership[normalized] || []
  }, [ownership])

  const getImageUrl = useCallback((tokenId: number): string => {
    return `${IMAGE_BASE}${tokenId}${IMAGE_EXT}`
  }, [])

  return { ownership, loading, error, getTokensForWallet, getImageUrl }
}
