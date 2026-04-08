import { forwardRef, useState } from 'react'
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
}

const CollagePreview = forwardRef<HTMLDivElement, Props>(
  ({ tokenIds, getImageUrl, layout, gap, bgColor, showIds, fillParent, className }, ref) => {
    const { cols } = getGridConfig(layout, tokenIds.length)
    const [loaded, setLoaded] = useState<Record<number, boolean>>({})

    return (
      <div
        ref={ref}
        className={className}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: `${gap}px`,
          backgroundColor: bgColor,
          padding: `${gap}px`,
          width: '100%',
          height: fillParent ? '100%' : undefined,
          minHeight: fillParent ? 0 : undefined,
          boxSizing: 'border-box',
        }}
      >
        {tokenIds.map(id => (
          <div key={id} className="relative aspect-square overflow-hidden">
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
        ))}
      </div>
    )
  }
)

CollagePreview.displayName = 'CollagePreview'
export default CollagePreview
