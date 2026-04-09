import { forwardRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { type LayoutType, getGridConfig } from './LayoutPicker'

interface Props {
  tokenIds: number[]
  getImageUrl: (tokenId: number) => string
  layout: LayoutType
  gap: number
  bgColor: string
  showIds: boolean
  /** Fill parent height (e.g. full-screen lightbox). */
  fillParent?: boolean
  className?: string
  /**
   * Outer inset around the grid. Defaults to `gap` for backwards compatibility.
   * Use `0` for edge-to-edge mosaics (e.g. social export).
   */
  outerPaddingPx?: number
  /** Pixel radius for each tile; falls back to Tailwind rounded-lg when omitted. */
  tileBorderRadiusPx?: number
  /** Optional class on each tile wrapper (e.g. ring/shadow). */
  tileClassName?: string
}

function TokenTile({
  id,
  getImageUrl,
  loaded,
  setLoaded,
  showIds,
  style,
  className = '',
}: {
  id: number
  getImageUrl: (tokenId: number) => string
  loaded: Record<number, boolean>
  setLoaded: Dispatch<SetStateAction<Record<number, boolean>>>
  showIds: boolean
  style?: CSSProperties
  className?: string
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[#0d1214] ${className}`}
      style={style}
    >
      <img
        src={getImageUrl(id)}
        alt={`Gimboz #${id}`}
        crossOrigin="anonymous"
        onLoad={() => setLoaded(prev => ({ ...prev, [id]: true }))}
        className={`w-full h-full object-cover transition-opacity duration-200
          ${loaded[id] ? 'opacity-100' : 'opacity-0'}`}
      />
      {!loaded[id] && (
        <div className="absolute inset-0 bg-[#192124] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#8EFD09] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {showIds && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-0.5">
          <span className="text-[10px] font-bold text-white">#{id}</span>
        </div>
      )}
    </div>
  )
}

const CollagePreview = forwardRef<HTMLDivElement, Props>(
  (
    {
      tokenIds,
      getImageUrl,
      layout,
      gap,
      bgColor,
      showIds,
      fillParent,
      className,
      outerPaddingPx,
      tileBorderRadiusPx,
      tileClassName = '',
    },
    ref,
  ) => {
    const [loaded, setLoaded] = useState<Record<number, boolean>>({})
    const count = tokenIds.length
    const { cols } = getGridConfig(layout, Math.max(1, count))
    const pad = outerPaddingPx !== undefined ? outerPaddingPx : gap

    const baseUniform: CSSProperties = {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: `${gap}px`,
      backgroundColor: bgColor,
      padding: `${pad}px`,
      width: '100%',
      height: fillParent ? '100%' : undefined,
      minHeight: fillParent ? 0 : undefined,
      boxSizing: 'border-box',
    }

    const tileRadiusStyle: CSSProperties | undefined =
      tileBorderRadiusPx != null ? { borderRadius: tileBorderRadiusPx } : undefined

    return (
      <div ref={ref} className={className} style={baseUniform}>
        {tokenIds.map(id => (
          <TokenTile
            key={id}
            id={id}
            getImageUrl={getImageUrl}
            loaded={loaded}
            setLoaded={setLoaded}
            showIds={showIds}
            className={`aspect-square ${tileBorderRadiusPx == null ? 'rounded-lg' : ''} ${tileClassName}`.trim()}
            style={tileRadiusStyle}
          />
        ))}
      </div>
    )
  },
)

CollagePreview.displayName = 'CollagePreview'
export default CollagePreview
