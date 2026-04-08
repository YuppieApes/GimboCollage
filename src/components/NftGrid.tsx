import NftCard from './NftCard'

interface Props {
  tokenIds: number[]
  selectedSet: Set<number>
  onToggle: (tokenId: number) => void
  onSelectAll: () => void
  onClearAll: () => void
  onBuildCollage: () => void
  getImageUrl: (tokenId: number) => string
  selectedCount: number
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
}: Props) {
  return (
    <div className="w-full pb-20">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={onSelectAll}
          className="px-4 py-2 rounded-lg bg-[#6FC50E] hover:bg-[#8EFD09]
                     text-[#11171A] text-sm font-semibold transition-colors"
        >
          Use All Gimboz ({tokenIds.length})
        </button>
        {selectedCount > 0 && (
          <button
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

      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#11171A]/95 backdrop-blur-sm
                        border-t border-[#31392C] p-4 z-50 animate-fade-in">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-sm text-[#C9D0C0] font-medium">
              {selectedCount} Gimboz selected
            </span>
            <button
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
