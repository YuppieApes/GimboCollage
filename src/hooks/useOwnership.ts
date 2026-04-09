import { useState, useEffect, useCallback } from 'react'

interface OwnershipData {
  [address: string]: number[]
}

const IMAGE_BASE = 'https://storage.googleapis.com/gimboz-public/AjhoiwlksdnERUB/3d/pfp/'
const IMAGE_EXT = '.png'

const REFETCH_MS = 30 * 60 * 1000

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
