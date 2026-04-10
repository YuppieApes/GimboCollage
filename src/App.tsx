import { useState, useMemo, useEffect } from 'react'
import { useOwnership } from './hooks/useOwnership'
import { useNftSelection } from './hooks/useNftSelection'
import { useCollectionMetadata } from './hooks/useCollectionMetadata'
import { filterByTraitCount, sortTokenIds, type SortMode } from './utils/tokenOrdering'
import type { WorkspaceNavTab, WorkspaceTab } from './types/workspace'
import WalletInput from './components/WalletInput'
import NftGrid from './components/NftGrid'
import CollageBuilder from './components/CollageBuilder'
import WorkspaceTabBar from './components/WorkspaceTabBar'

type AppView = 'landing' | 'workspace'

export default function App() {
  const { loading, error, getTokensForWallet, getImageUrl } = useOwnership()
  const { byId, loading: traitsLoading, hasTraits } = useCollectionMetadata()

  const [view, setView] = useState<AppView>('landing')
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('collection')
  const [targetWallet, setTargetWallet] = useState<string>('')
  const [walletTokens, setWalletTokens] = useState<number[]>([])
  const [noResults, setNoResults] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('background')
  const [onlyThreeTraits, setOnlyThreeTraits] = useState(false)

  const displayedTokenIds = useMemo(() => {
    let ids = [...walletTokens]
    if (onlyThreeTraits && hasTraits && byId) {
      ids = filterByTraitCount(ids, 3, byId)
    }
    return sortTokenIds(ids, sortMode, byId)
  }, [walletTokens, onlyThreeTraits, sortMode, byId, hasTraits])

  const selection = useNftSelection(displayedTokenIds)

  useEffect(() => {
    if (!traitsLoading && !hasTraits && (sortMode === 'rarityAsc' || sortMode === 'rarityDesc')) {
      setSortMode('background')
    }
  }, [traitsLoading, hasTraits, sortMode])

  const collageTokenIds = useMemo(() => {
    if (selection.count > 0) {
      const picked = displayedTokenIds.filter(id => selection.selected.has(id))
      if (picked.length > 0) return picked
      return selection.selectedArray
    }
    return displayedTokenIds
  }, [selection.count, selection.selected, selection.selectedArray, displayedTokenIds])

  const handleLookup = (addr: string) => {
    const tokens = getTokensForWallet(addr)
    setTargetWallet(addr)
    setWalletTokens(tokens)
    setNoResults(tokens.length === 0)
    selection.clearAll()
    setSortMode('background')
    setOnlyThreeTraits(false)
    setWorkspaceTab('collection')
    if (tokens.length > 0) {
      setView('workspace')
    }
  }

  const handleUseAll = () => {
    if (displayedTokenIds.length === 0) return
    selection.selectAll()
    setWorkspaceTab('collage')
  }

  const handleBackToLanding = () => {
    setView('landing')
    setTargetWallet('')
    setWalletTokens([])
    setNoResults(false)
    setSortMode('background')
    setOnlyThreeTraits(false)
    setWorkspaceTab('collection')
    selection.clearAll()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#8EFD09] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#999A92] text-sm">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-red-400 text-6xl">!</div>
        <p className="text-red-400 text-center max-w-md">
          Failed to load data: {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-[#252B2E] text-[#C9D0C0] text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (view === 'workspace') {
    return (
      <div className="min-h-screen p-4 sm:p-8 max-w-7xl mx-auto">
        <WorkspaceTabBar
          active={workspaceTab === 'collage' ? null : workspaceTab}
          onChange={(t: WorkspaceNavTab) => setWorkspaceTab(t)}
        />

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6 mt-1">
          <button
            type="button"
            onClick={handleBackToLanding}
            className="px-4 py-2 rounded-lg bg-[#252B2E] hover:bg-[#31392C]
                       text-[#C9D0C0] text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            New lookup
          </button>
          <span
            className="text-xs sm:text-sm text-[#70736E] font-mono truncate max-w-[min(100%,12rem)] sm:max-w-[16rem]"
            title={targetWallet}
          >
            {targetWallet.slice(0, 6)}…{targetWallet.slice(-4)}
          </span>
        </div>

        {workspaceTab === 'collection' && (
          <>
            <p className="text-sm text-[#999A92] mb-4">
              <span className="text-[#C9D0C0] font-semibold tabular-nums">{displayedTokenIds.length}</span>
              {displayedTokenIds.length === walletTokens.length
                ? ' Gimboz'
                : ` of ${walletTokens.length} (filtered)`}
            </p>
            <NftGrid
              tokenIds={displayedTokenIds}
              selectedSet={selection.selected}
              onToggle={selection.toggle}
              onSelectAll={handleUseAll}
              onClearAll={selection.clearAll}
              getImageUrl={getImageUrl}
              selectedCount={selection.count}
              sortMode={sortMode}
              onSortMode={setSortMode}
              onlyThreeTraits={onlyThreeTraits}
              onOnlyThreeTraits={setOnlyThreeTraits}
              traitsLoading={traitsLoading}
              traitsAvailable={hasTraits}
            />
          </>
        )}

        {workspaceTab !== 'collection' && (
          <div className="max-w-6xl">
            <CollageBuilder
              compact
              builderMode={workspaceTab}
              tokenIds={collageTokenIds}
              getImageUrl={getImageUrl}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-20">
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="text-5xl sm:text-6xl font-black text-[#C9D0C0] mb-2 tracking-tight">
            GIMBOZ
          </h1>
          <p className="text-lg sm:text-xl text-[#8EFD09] font-semibold">Studio</p>
        </div>

        <div className="w-full max-w-2xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="bg-[#192124] rounded-2xl p-6 border border-[#31392C]">
            <WalletInput onLookup={handleLookup} />
          </div>
        </div>

        {noResults && (
          <div className="mt-8 bg-[#31392C]/50 border border-[#495151] rounded-xl px-6 py-4 max-w-md text-center animate-fade-in">
            <p className="text-[#C9D0C0] text-sm font-medium">No Gimboz in this wallet</p>
            <p className="text-[#70736E] text-xs mt-1 font-mono">
              {targetWallet.slice(0, 10)}…{targetWallet.slice(-6)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
