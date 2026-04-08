import { useState, useEffect, useCallback } from 'react'

interface OwnershipData {
  [address: string]: number[]
}

const IMAGE_BASE = 'https://storage.googleapis.com/gimboz-public/AjhoiwlksdnERUB/3d/pfp/'
const IMAGE_EXT = '.png'

let ownershipCache: OwnershipData | null = null

export function useOwnership() {
  const [ownership, setOwnership] = useState<OwnershipData | null>(ownershipCache)
  const [loading, setLoading] = useState(!ownershipCache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ownershipCache) {
      setOwnership(ownershipCache)
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/ownership.json')
        if (!res.ok) throw new Error('Failed to load ownership data')
        const data: OwnershipData = await res.json()
        ownershipCache = data
        if (!cancelled) {
          setOwnership(data)
          setLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
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
