import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import LayoutPicker, { type LayoutType, getGridConfig } from './LayoutPicker'
import CollagePreview from './CollagePreview'
import CollageShareActions from './CollageShareActions'

const BG_PRESETS = [
  '#11171A',
  '#000000',
  '#192124',
  '#252B2E',
  '#31392C',
  '#495151',
  '#ffffff',
  '#8EFD09',
  '#6FC50E',
  '#C9D0C0',
]

function normalizeHex6(input: string): string | null {
  const t = input.trim()
  const m = t.match(/^#?([0-9A-Fa-f]{6})$/)
  return m ? `#${m[1].toLowerCase()}` : null
}

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
  const [hexDraft, setHexDraft] = useState(bgColor)
  const [showIds, setShowIds] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHexDraft(bgColor)
  }, [bgColor])

  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [lightboxOpen])

  const handleHexBlur = () => {
    const ok = normalizeHex6(hexDraft)
    if (ok) setBgColor(ok)
    else setHexDraft(bgColor)
  }

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  const previewProps = {
    tokenIds,
    getImageUrl,
    layout,
    gap,
    bgColor,
    showIds,
  }

  const { cols: fullCols, rows: fullRows } = getGridConfig(layout, tokenIds.length)

  return (
    <div className="w-full animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
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

        <div className="flex flex-wrap gap-6 items-end">
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

          <label className="flex items-center gap-2 cursor-pointer pb-1">
            <input
              type="checkbox"
              checked={showIds}
              onChange={e => setShowIds(e.target.checked)}
              className="w-4 h-4 rounded accent-[#8EFD09]"
            />
            <span className="text-sm text-[#C9D0C0]">Show Token IDs</span>
          </label>
        </div>

        <div className="pt-2 border-t border-[#31392C]">
          <label className="block text-xs font-medium text-[#999A92] mb-3 uppercase tracking-wider">
            Collage background color
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {BG_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setBgColor(c)}
                  className={`w-9 h-9 rounded-lg border-2 transition-all shrink-0
                    ${bgColor.toLowerCase() === c.toLowerCase()
                      ? 'border-[#8EFD09] scale-110 ring-2 ring-[#8EFD09]/30'
                      : 'border-[#495151] hover:border-[#70736E]'
                    }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[#999A92]">
                <span className="sr-only">Pick a color</span>
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/i.test(bgColor) ? bgColor : '#11171a'}
                  onChange={e => setBgColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-[#495151] bg-[#252B2E] p-0.5"
                  aria-label="Color picker"
                />
                <span className="hidden sm:inline text-[#70736E]">Picker</span>
              </label>
              <div className="flex items-center gap-2">
                <label htmlFor="collage-hex" className="text-xs text-[#70736E] whitespace-nowrap">
                  Hex
                </label>
                <input
                  id="collage-hex"
                  type="text"
                  value={hexDraft}
                  onChange={e => setHexDraft(e.target.value)}
                  onBlur={handleHexBlur}
                  onKeyDown={handleHexKeyDown}
                  placeholder="#11171A"
                  spellCheck={false}
                  maxLength={7}
                  className="w-[7.5rem] px-3 py-2 rounded-lg bg-[#252B2E] border border-[#495151]
                             text-[#C9D0C0] font-mono text-sm placeholder-[#70736E]
                             focus:outline-none focus:border-[#8EFD09] focus:ring-1 focus:ring-[#8EFD09]"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-[#70736E] mt-3">
            Tap a swatch, use the color wheel, or type a hex code (e.g. <code className="text-[#999A92]">#192124</code>).
          </p>
        </div>
      </div>

      <div className="bg-[#192124] rounded-2xl p-4 mb-6">
        <p className="text-center text-xs text-[#70736E] mb-3">Click preview to view full size</p>
        <div className="max-w-3xl mx-auto">
          <div
            role="button"
            tabIndex={0}
            className="relative rounded-xl overflow-hidden cursor-zoom-in outline-none
                       ring-2 ring-transparent hover:ring-[#6FC50E] focus-visible:ring-[#8EFD09] transition-shadow"
            onClick={() => setLightboxOpen(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setLightboxOpen(true)
              }
            }}
            aria-label="Open collage preview full screen"
          >
            <CollagePreview ref={previewRef} {...previewProps} />
          </div>
        </div>
      </div>

      <CollageShareActions
        targetRef={previewRef}
        filename={`gimboz-collage-${tokenIds.length}`}
      />

      {lightboxOpen &&
        createPortal(
          <div
            className="lightbox-backdrop fixed inset-0 z-[9999] flex flex-col bg-[#11171A] h-[100dvh] w-full max-w-none"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            role="dialog"
            aria-modal="true"
            aria-label="Collage full size"
          >
            <header
              className="shrink-0 flex items-center justify-between gap-3 px-4 pb-3 pt-2 sm:px-5 sm:pb-4
                         bg-[#192124]/95 backdrop-blur-md border-b border-[#31392C] shadow-lg shadow-black/40"
            >
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2.5 min-h-[48px] min-w-[48px] px-5 py-3 rounded-full
                           bg-[#6FC50E] hover:bg-[#8EFD09] active:scale-[0.97] text-[#11171A] font-bold text-base
                           shadow-[0_0_24px_rgba(111,197,14,0.45)] transition-all duration-200 ease-out
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8EFD09] focus-visible:ring-offset-2 focus-visible:ring-offset-[#192124]"
                onClick={() => setLightboxOpen(false)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span>Back to collage</span>
              </button>
              <span className="hidden sm:block text-sm text-[#70736E] pr-2">Esc to close</span>
            </header>

            <div className="flex-1 flex items-center justify-center min-h-0 min-w-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5">
              <div
                className="lightbox-content rounded-2xl overflow-hidden shadow-2xl ring-2 ring-[#6FC50E]/40"
                style={{
                  aspectRatio: `${fullCols} / ${fullRows}`,
                  width: `min(calc(100vw - 1.5rem), calc((100dvh - 7rem) * ${fullCols} / ${fullRows}))`,
                  maxHeight: 'calc(100dvh - 7rem)',
                }}
              >
                <CollagePreview {...previewProps} fillParent className="min-h-0" />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
