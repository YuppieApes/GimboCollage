import { useState, useRef } from 'react'
import LayoutPicker, { type LayoutType } from './LayoutPicker'
import CollagePreview from './CollagePreview'
import ExportButton from './ExportButton'

interface Props {
  tokenIds: number[]
  getImageUrl: (tokenId: number) => string
  onBack: () => void
}

export default function CollageBuilder({ tokenIds, getImageUrl, onBack }: Props) {
  const [layout, setLayout] = useState<LayoutType>(() => {
    const n = tokenIds.length
    if (n <= 4) return 'grid-2x2'
    if (n <= 9) return 'grid-3x3'
    if (n <= 16) return 'grid-4x4'
    return 'grid-auto'
  })
  const [gap, setGap] = useState(4)
  const [bgColor, setBgColor] = useState('#11171A')
  const [showIds, setShowIds] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)

  return (
    <div className="w-full animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-[#252B2E] hover:bg-[#31392C]
                     text-[#C9D0C0] text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 className="text-xl font-bold text-[#C9D0C0]">
          Build Your Collage
          <span className="text-sm font-normal text-[#999A92] ml-2">
            ({tokenIds.length} Gimboz)
          </span>
        </h2>
      </div>

      <div className="bg-[#192124] rounded-2xl p-5 mb-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#999A92] mb-2 uppercase tracking-wider">
            Layout
          </label>
          <LayoutPicker value={layout} onChange={setLayout} count={tokenIds.length} />
        </div>

        <div className="flex flex-wrap gap-6">
          <div>
            <label className="block text-xs font-medium text-[#999A92] mb-2 uppercase tracking-wider">
              Gap
            </label>
            <input
              type="range"
              min={0}
              max={16}
              value={gap}
              onChange={e => setGap(Number(e.target.value))}
              className="w-32 accent-[#8EFD09]"
            />
            <span className="ml-2 text-xs text-[#999A92]">{gap}px</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#999A92] mb-2 uppercase tracking-wider">
              Background
            </label>
            <div className="flex gap-2">
              {['#11171A', '#000000', '#ffffff', '#192124', '#8EFD09'].map(c => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all
                    ${bgColor === c ? 'border-[#8EFD09] scale-110' : 'border-[#495151]'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={bgColor}
                onChange={e => setBgColor(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
              />
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showIds}
                onChange={e => setShowIds(e.target.checked)}
                className="w-4 h-4 rounded accent-[#8EFD09]"
              />
              <span className="text-sm text-[#C9D0C0]">Show Token IDs</span>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-[#192124] rounded-2xl p-4 mb-6">
        <div className="max-w-3xl mx-auto">
          <CollagePreview
            ref={previewRef}
            tokenIds={tokenIds}
            getImageUrl={getImageUrl}
            layout={layout}
            gap={gap}
            bgColor={bgColor}
            showIds={showIds}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <ExportButton targetRef={previewRef} filename={`gimboz-collage-${tokenIds.length}`} />
      </div>
    </div>
  )
}
