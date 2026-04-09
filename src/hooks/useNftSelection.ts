import { useState, useCallback, useEffect } from 'react'

export function useNftSelection(availableTokens: number[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    const allowed = new Set(availableTokens)
    setSelected(prev => {
      const next = new Set<number>()
      for (const id of prev) {
        if (allowed.has(id)) next.add(id)
      }
      return next
    })
  }, [availableTokens])

  const toggle = useCallback((tokenId: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(tokenId)) {
        next.delete(tokenId)
      } else {
        next.add(tokenId)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(availableTokens))
  }, [availableTokens])

  const clearAll = useCallback(() => {
    setSelected(new Set())
  }, [])

  const isSelected = useCallback((tokenId: number) => selected.has(tokenId), [selected])

  return {
    selected,
    selectedArray: Array.from(selected).sort((a, b) => a - b),
    toggle,
    selectAll,
    clearAll,
    isSelected,
    count: selected.size,
  }
}
