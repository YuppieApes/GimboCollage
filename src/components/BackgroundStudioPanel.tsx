import { useCallback, useEffect, useRef, useState } from 'react'
import { composeCutoutOnBackground } from '../utils/composeCutout'
import CutoutEraserCanvas from './CutoutEraserCanvas'

async function fetchImageBlobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`Could not load image (${res.status})`)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error('Loaded file is not an image')
  }
  return blob
}

interface Props {
  tokenIds: number[]
  getImageUrl: (tokenId: number) => string
}

export default function BackgroundStudioPanel({ tokenIds, getImageUrl }: Props) {
  const bgImageInputRef = useRef<HTMLInputElement>(null)

  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null)
  const [cutoutBusy, setCutoutBusy] = useState(false)
  const [cutoutError, setCutoutError] = useState<string | null>(null)
  const [cutoutBlob, setCutoutBlob] = useState<Blob | null>(null)
  const processedTokenIdRef = useRef<number | null>(null)

  const [behindColor, setBehindColor] = useState('#11171A')
  const [behindImageFile, setBehindImageFile] = useState<File | null>(null)
  const compositeUrlRef = useRef<string | null>(null)
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null)
  const [compositeBusy, setCompositeBusy] = useState(false)
  const [compositeError, setCompositeError] = useState<string | null>(null)

  const clearCutout = useCallback(() => {
    setCutoutBlob(null)
    processedTokenIdRef.current = null
  }, [])

  const revokeComposite = useCallback(() => {
    if (compositeUrlRef.current) {
      URL.revokeObjectURL(compositeUrlRef.current)
      compositeUrlRef.current = null
    }
    setCompositeUrl(null)
  }, [])

  useEffect(
    () => () => {
      if (compositeUrlRef.current) {
        URL.revokeObjectURL(compositeUrlRef.current)
        compositeUrlRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    if (selectedTokenId != null && !tokenIds.includes(selectedTokenId)) {
      setSelectedTokenId(null)
      clearCutout()
      revokeComposite()
      setBehindImageFile(null)
    }
  }, [tokenIds, selectedTokenId, clearCutout, revokeComposite])

  const selectToken = (id: number) => {
    if (id !== selectedTokenId) {
      clearCutout()
      revokeComposite()
      setBehindImageFile(null)
      setCutoutError(null)
      setCompositeError(null)
    }
    setSelectedTokenId(id)
  }

  const handleCutoutEdited = useCallback((blob: Blob) => {
    setCutoutBlob(blob)
  }, [])

  const runRemoveBackground = async () => {
    if (selectedTokenId == null) return
    const id = selectedTokenId
    setCutoutError(null)
    setCompositeError(null)
    clearCutout()
    revokeComposite()
    setBehindImageFile(null)
    setCutoutBusy(true)
    try {
      const imageUrl = getImageUrl(id)
      const imageBlob = await fetchImageBlobFromUrl(imageUrl)
      const { removeBackground } = await import('@imgly/background-removal')
      const blob = await removeBackground(imageBlob, {
        model: 'isnet_quint8',
        output: { format: 'image/png', type: 'foreground' },
      })
      processedTokenIdRef.current = id
      setCutoutBlob(blob)
    } catch (err) {
      console.error(err)
      setCutoutError(
        err instanceof Error
          ? err.message
          : 'Could not remove background. The image may block cross-origin loading.',
      )
    } finally {
      setCutoutBusy(false)
    }
  }

  useEffect(() => {
    if (!cutoutBlob) {
      revokeComposite()
      return
    }

    let cancelled = false
    setCompositeBusy(true)
    setCompositeError(null)
    void (async () => {
      try {
        const out = await composeCutoutOnBackground(cutoutBlob, behindColor, behindImageFile)
        if (cancelled) return
        revokeComposite()
        const u = URL.createObjectURL(out)
        compositeUrlRef.current = u
        setCompositeUrl(u)
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setCompositeError(
            err instanceof Error ? err.message : 'Could not build preview with background.',
          )
        }
      } finally {
        if (!cancelled) setCompositeBusy(false)
      }
    })()

    return () => {
      cancelled = true
      revokeComposite()
    }
  }, [cutoutBlob, behindColor, behindImageFile, revokeComposite])

  const handleBehindImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    setBehindImageFile(f)
  }

  const triggerDownload = (blob: Blob, filename: string) => {
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u
    a.download = filename
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(u), 2000)
  }

  const handleDownloadTransparent = () => {
    const id = processedTokenIdRef.current
    if (!cutoutBlob || id == null) return
    triggerDownload(cutoutBlob, `gimboz-${id}-transparent.png`)
  }

  const handleDownloadWithBackground = async () => {
    const id = processedTokenIdRef.current
    if (!cutoutBlob || id == null) return
    setCompositeError(null)
    try {
      const out = await composeCutoutOnBackground(cutoutBlob, behindColor, behindImageFile)
      triggerDownload(out, `gimboz-${id}-with-background.png`)
    } catch (err) {
      console.error(err)
      setCompositeError(
        err instanceof Error ? err.message : 'Could not export image with background.',
      )
    }
  }

  const hasCutout = cutoutBlob != null
  const idForLabel = processedTokenIdRef.current ?? selectedTokenId

  return (
    <div className="mb-6 rounded-2xl border border-[#31392C] bg-[#161C1F] overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-[#2a3236] min-h-[min(520px,70vh)]">
        {/* Remove background — wallet Gimboz only */}
        <div className="flex flex-col p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5c6568] mb-2">
            Remove background
          </p>
          <h3 className="text-lg font-semibold text-[#E8EBE6] tracking-tight mb-5">Pick a Gimboz</h3>

          {tokenIds.length === 0 ? (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-[#2f383c] bg-[#11171A]/60 px-6 py-12 text-center">
              <p className="text-sm text-[#6d7679]">No Gimboz in this session. Go back and load a wallet.</p>
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-2.5 mb-5 max-h-[min(42vh,360px)] min-h-0 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-width:thin] [scrollbar-gutter:stable] items-start content-start auto-rows-min"
                role="listbox"
                aria-label="Gimboz in wallet"
              >
                {tokenIds.map(id => {
                  const active = selectedTokenId === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => selectToken(id)}
                      className={`group relative w-full min-w-0 aspect-square shrink-0 rounded-xl overflow-hidden ring-1 transition-all duration-200
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8EFD09] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161C1F]
                        ${active
                          ? 'ring-2 ring-[#8EFD09] shadow-[0_0_20px_rgba(142,253,9,0.25)] z-[1]'
                          : 'ring-[#2a3236] hover:ring-[#4a5459]'
                        }`}
                      aria-label={`Select Gimboz number ${id}`}
                    >
                      <img
                        src={getImageUrl(id)}
                        alt=""
                        crossOrigin="anonymous"
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-1 text-center text-[10px] font-mono font-medium text-white/90">
                        #{id}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                disabled={selectedTokenId == null || cutoutBusy}
                onClick={() => void runRemoveBackground()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#252B2E] text-[#C9D0C0] text-sm font-semibold border border-[#3d474c] hover:border-[#6FC50E]/50 hover:bg-[#2c3438] disabled:opacity-40 disabled:pointer-events-none transition-all"
              >
                {cutoutBusy ? 'Removing background…' : 'Remove background'}
              </button>

              {cutoutBusy && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[#8a9396]">
                  <span className="h-3.5 w-3.5 border-2 border-[#6FC50E] border-t-transparent rounded-full animate-spin shrink-0" />
                  Working on your device — may take a moment.
                </div>
              )}
              {cutoutError && (
                <p className="mt-3 text-xs text-red-400/95 leading-relaxed" role="alert">
                  {cutoutError}
                </p>
              )}

              {cutoutBlob && !cutoutBusy && (
                <div className="mt-5 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5c6568]">
                    Transparent preview
                  </p>
                  <CutoutEraserCanvas blob={cutoutBlob} onBlobCommit={handleCutoutEdited} />
                  <button
                    type="button"
                    onClick={handleDownloadTransparent}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#6FC50E] text-[#11171A] text-sm font-bold hover:bg-[#8EFD09] transition-colors"
                  >
                    Download transparent PNG
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Custom background */}
        <div className="flex flex-col p-6 sm:p-8 bg-[#12181b]/80">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5c6568] mb-2">
            Custom background
          </p>
          <h3 className="text-lg font-semibold text-[#E8EBE6] tracking-tight mb-5">Composite & export</h3>

          {!hasCutout ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2f383c] bg-[#0d1214]/50 px-6 py-16 text-center">
              <div className="w-10 h-10 rounded-full bg-[#1f282c] flex items-center justify-center mb-3 ring-1 ring-[#2a3236]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#5c6568]" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <p className="text-sm text-[#6d7679] max-w-[220px] leading-relaxed">
                Remove a Gimboz background first — then you can style and download it here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-xl bg-[#1a2226] px-3 py-2 ring-1 ring-[#2a3236]">
                  <span className="text-[10px] uppercase tracking-wider text-[#6d7679]">Fill</span>
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/i.test(behindColor) ? behindColor : '#11171a'}
                    onChange={e => setBehindColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded-md border-0 bg-transparent p-0"
                    aria-label="Background color"
                  />
                </label>
                <input
                  ref={bgImageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Upload background image"
                  onChange={handleBehindImageChange}
                />
                <button
                  type="button"
                  onClick={() => bgImageInputRef.current?.click()}
                  className="rounded-xl bg-[#1a2226] px-4 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#2a3236] hover:ring-[#6FC50E]/40 transition-all"
                >
                  Upload image
                </button>
                {behindImageFile && (
                  <button
                    type="button"
                    onClick={() => setBehindImageFile(null)}
                    className="text-xs text-[#6d7679] hover:text-[#C9D0C0] transition-colors"
                  >
                    Clear image
                  </button>
                )}
              </div>
              {behindImageFile && (
                <p className="text-[11px] text-[#5c6568] truncate">{behindImageFile.name}</p>
              )}
              {compositeError && (
                <p className="text-xs text-red-400/95" role="alert">
                  {compositeError}
                </p>
              )}

              <div className="flex-1 min-h-[160px] flex items-center justify-center rounded-xl bg-[#0d1214] ring-1 ring-[#2a3236] p-3">
                {compositeBusy ? (
                  <span className="h-8 w-8 border-2 border-[#6FC50E] border-t-transparent rounded-full animate-spin" />
                ) : compositeUrl ? (
                  <img
                    src={compositeUrl}
                    alt={idForLabel != null ? `Gimboz ${idForLabel} with background` : 'With background'}
                    className="max-h-56 max-w-full rounded-lg object-contain shadow-lg"
                  />
                ) : null}
              </div>

              <button
                type="button"
                disabled={compositeBusy || !compositeUrl}
                onClick={() => void handleDownloadWithBackground()}
                className="w-full py-3 rounded-xl bg-[#6FC50E] text-[#11171A] text-sm font-bold hover:bg-[#8EFD09] disabled:opacity-35 disabled:pointer-events-none transition-colors"
              >
                Download with background
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
