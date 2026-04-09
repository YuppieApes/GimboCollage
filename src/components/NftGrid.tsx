import NftCard from './NftCard'
import type { SortMode } from '../utils/tokenOrdering'

interface Props {
  tokenIds: number[]
  selectedSet: Set<number>
  onToggle: (tokenId: number) => void
  onSelectAll: () => void
  onClearAll: () => void
  onBuildCollage: () => void
  getImageUrl: (tokenId: number) => string
  selectedCount: number
  sortMode: SortMode
  onSortMode: (mode: SortMode) => void
  onlyThreeTraits: boolean
  onOnlyThreeTraits: (value: boolean) => void
  traitsLoading: boolean
  traitsAvailable: boolean
}

export default function NftGrid({
  tokenIds,
  selectedSet,
  onToggle,
  onSelectAll,
  onClearAll,
  onBuildCollage,
  getImageUrl,
  selectedCount,
  sortMode,
  onSortMode,
  onlyThreeTraits,
  onOnlyThreeTraits,
  traitsLoading,
  traitsAvailable,
}: Props) {
  const raritySortDisabled = traitsLoading || !traitsAvailable

  return (
    <div className="w-full pb-20">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onSelectAll}
          className="px-4 py-2 rounded-lg bg-[#6FC50E] hover:bg-[#8EFD09]
                     text-[#11171A] text-sm font-semibold transition-colors"
        >
          Use All Gimboz ({tokenIds.length})
        </button>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="px-4 py-2 rounded-lg bg-[#252B2E] hover:bg-[#31392C]
                       text-[#C9D0C0] text-sm font-medium transition-colors"
          >
            Clear Selection
          </button>
        )}
        <span className="text-sm text-[#999A92] ml-auto">
          Tap to select &middot; {selectedCount} of {tokenIds.length} selected
        </span>
      </div>

      <div
        className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-4 mb-6 p-4 rounded-xl
                   bg-[#192124] border border-[#31392C]"
      >
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <label htmlFor="sort-mode" className="text-xs font-medium text-[#999A92] uppercase tracking-wider">
            Sort by
          </label>
          <select
            id="sort-mode"
            value={sortMode}
            onChange={e => onSortMode(e.target.value as SortMode)}
            className="rounded-lg bg-[#252B2E] border border-[#495151] text-[#C9D0C0] text-sm px-3 py-2
                       focus:outline-none focus:border-[#8EFD09] focus:ring-1 focus:ring-[#8EFD09]"
          >
            <option value="background">
              Background (A–Z)
            </option>
            <option value="rarityAsc" disabled={raritySortDisabled}>
              Rarest first
            </option>
            <option value="rarityDesc" disabled={raritySortDisabled}>
              Least rare first
            </option>
          </select>
          {traitsLoading && (
            <span className="text-xs text-[#70736E]">Loading traits…</span>
          )}
          {!traitsLoading && !traitsAvailable && (
            <span className="text-xs text-[#70736E]">Run npm run build-metadata for rarity sort and 3-trait filter.</span>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer pb-1 sm:pb-0">
          <input
            type="checkbox"
            checked={onlyThreeTraits}
            disabled={raritySortDisabled}
            onChange={e => onOnlyThreeTraits(e.target.checked)}
            className="w-4 h-4 rounded accent-[#8EFD09] disabled:opacity-40"
          />
          <span className="text-sm text-[#C9D0C0]">Only 3 traits</span>
        </label>
      </div>

      {tokenIds.length === 0 ? (
        <p className="text-center text-[#999A92] py-12 text-sm">
          No Gimboz match your filters. Turn off &ldquo;Only 3 traits&rdquo; or change sort.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {tokenIds.map(id => (
            <NftCard
              key={id}
              tokenId={id}
              imageUrl={getImageUrl(id)}
              selected={selectedSet.has(id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}

      {selectedCount > 0 && tokenIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#11171A]/95 backdrop-blur-sm
                        border-t border-[#31392C] p-4 z-50 animate-fade-in">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-sm text-[#C9D0C0] font-medium">
              {selectedCount} Gimboz selected
            </span>
            <button
              type="button"
              onClick={onBuildCollage}
              className="px-6 py-2.5 rounded-xl bg-[#6FC50E] hover:bg-[#8EFD09]
                         text-[#11171A] font-bold transition-colors glow-pulse"
            >
              Build Collage
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
