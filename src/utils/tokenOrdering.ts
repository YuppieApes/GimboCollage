export type SortMode = 'background' | 'rarityAsc' | 'rarityDesc'

export type TokenAttr = { trait_type: string; value: string }

export type TokenMetaRecord = {
  attrs: TokenAttr[]
  traitCount: number
  rarity: number
  /** 3D MML document URL from token metadata (when present). */
  mml?: string
  /** 3D GLB mesh URL from token metadata (when present). */
  glb?: string
}

export type GimbozMetadataById = Record<string, TokenMetaRecord>

const BACKGROUND_TRAIT = 'background'

function getMetaForToken(byId: GimbozMetadataById | null, tokenId: number): TokenMetaRecord | null {
  if (!byId) return null
  return byId[String(tokenId)] ?? null
}

function backgroundValue(meta: TokenMetaRecord | null): string {
  if (!meta?.attrs?.length) return ''
  const a = meta.attrs.find(
    x => x.trait_type.trim().toLowerCase() === BACKGROUND_TRAIT,
  )
  return a?.value?.trim() ?? ''
}

/** Unknown / missing metadata sorts last for background; rarity Infinity for missing. */
export function sortTokenIds(
  ids: number[],
  mode: SortMode,
  byId: GimbozMetadataById | null,
): number[] {
  const copy = [...ids]
  if (!byId) {
    copy.sort((a, b) => a - b)
    return copy
  }
  if (mode === 'background') {
    copy.sort((a, b) => {
      const ba = backgroundValue(getMetaForToken(byId, a)).toLowerCase()
      const bb = backgroundValue(getMetaForToken(byId, b)).toLowerCase()
      if (ba === '' && bb === '') return a - b
      if (ba === '') return 1
      if (bb === '') return -1
      const c = ba.localeCompare(bb)
      return c !== 0 ? c : a - b
    })
    return copy
  }
  // Higher `rarity` score = rarer NFT (sum of 1/trait-frequency). Missing metadata sorts last.
  // rarityAsc in UI = "Rarest first" → descending score
  if (mode === 'rarityAsc') {
    copy.sort((a, b) => {
      const ma = getMetaForToken(byId, a)
      const mb = getMetaForToken(byId, b)
      const ra = ma?.rarity ?? Number.NEGATIVE_INFINITY
      const rb = mb?.rarity ?? Number.NEGATIVE_INFINITY
      const d = rb - ra
      if (!Number.isNaN(d) && d !== 0) return d
      return a - b
    })
    return copy
  }
  // rarityDesc = "Least rare first" → ascending score
  copy.sort((a, b) => {
    const ma = getMetaForToken(byId, a)
    const mb = getMetaForToken(byId, b)
    const ra = ma?.rarity ?? Number.POSITIVE_INFINITY
    const rb = mb?.rarity ?? Number.POSITIVE_INFINITY
    const d = ra - rb
    if (!Number.isNaN(d) && d !== 0) return d
    return a - b
  })
  return copy
}

/**
 * Keep tokens whose traitCount === n. Missing metadata is excluded when filter is applied.
 */
export function filterByTraitCount(
  ids: number[],
  n: number,
  byId: GimbozMetadataById | null,
): number[] {
  if (!byId) return []
  return ids.filter(id => {
    const m = getMetaForToken(byId, id)
    if (!m) return false
    return m.traitCount === n
  })
}
