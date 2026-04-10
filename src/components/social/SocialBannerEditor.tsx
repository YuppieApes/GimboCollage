import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Group, Image as KonvaImage, Layer, Rect, Stage, Transformer } from 'react-konva'
import Konva from 'konva'
import { CANVAS_PRESETS, type CanvasPreset } from './canvasPresets'
import type { StickerLayer } from './socialTypes'
import { exportStageToPngBlob } from './stageToBlob'
import { copyImageBlobToClipboard, savePngBlob } from '../../utils/collagePng'
import CutoutEraserCanvas from '../CutoutEraserCanvas'
import { COLLAGE_BG_PRESETS } from '../../constants/collageBgPresets'

async function fetchImageBlobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`Could not load image (${res.status})`)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error('Loaded file is not an image')
  }
  return blob
}

function revokeBlobUrl(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

function useCrossOriginImage(src: string | undefined): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined)

  useEffect(() => {
    if (!src) {
      setImg(undefined)
      return
    }
    let cancelled = false
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!cancelled) setImg(image)
    }
    image.onerror = () => {
      if (!cancelled) setImg(undefined)
    }
    image.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  return img
}

function useLocalBlobImage(blobUrl: string | undefined): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined)

  useEffect(() => {
    if (!blobUrl) {
      setImg(undefined)
      return
    }
    let cancelled = false
    const image = new window.Image()
    image.onload = () => {
      if (!cancelled) setImg(image)
    }
    image.onerror = () => {
      if (!cancelled) setImg(undefined)
    }
    image.src = blobUrl
    return () => {
      cancelled = true
    }
  }, [blobUrl])

  return img
}

function coverDims(nw: number, nh: number, cw: number, ch: number) {
  const scale = Math.max(cw / nw, ch / nh)
  const w = nw * scale
  const h = nh * scale
  const x = (cw - w) / 2
  const y = (ch - h) / 2
  return { x, y, width: w, height: h }
}

function newStickerId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createStickerFromImage(
  tokenId: number,
  imageUrl: string,
  img: HTMLImageElement,
  cw: number,
  ch: number,
): StickerLayer {
  const nw = img.naturalWidth || img.width
  const nh = img.naturalHeight || img.height
  const target = Math.min(cw, ch) * 0.35
  const r = Math.min(target / nw, target / nh, 1)
  const width = nw * r
  const height = nh * r
  return {
    id: newStickerId(),
    tokenId,
    imageUrl,
    sourceImageUrl: imageUrl,
    x: (cw - width) / 2,
    y: (ch - height) / 2,
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  }
}

type LoadedStickerImage = {
  tokenId: number
  imageUrl: string
  img: HTMLImageElement
}

function loadStickerImage(
  tokenId: number,
  urlForToken: (id: number) => string,
): Promise<LoadedStickerImage> {
  return new Promise((resolve, reject) => {
    const imageUrl = urlForToken(tokenId)
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve({ tokenId, imageUrl, img })
    img.onerror = () => reject(new Error(`Could not load #${tokenId}`))
    img.src = imageUrl
  })
}

function layoutStickersGrid(
  loaded: LoadedStickerImage[],
  cw: number,
  ch: number,
  gapPx: number,
): StickerLayer[] {
  const n = loaded.length
  if (n === 0) return []
  const g = Math.max(0, gapPx)
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * (cw / ch))))
  const rows = Math.ceil(n / cols)
  const innerW = cw - g * (cols + 1)
  const innerH = ch - g * (rows + 1)
  const cellW = Math.max(1, innerW / cols)
  const cellH = Math.max(1, innerH / rows)

  return loaded.map((e, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cellLeft = g + col * (cellW + g)
    const cellTop = g + row * (cellH + g)
    const nw = e.img.naturalWidth || e.img.width
    const nh = e.img.naturalHeight || e.img.height
    const scale = Math.max(cellW / nw, cellH / nh)
    const width = nw * scale
    const height = nh * scale
    const x = cellLeft + (cellW - width) / 2
    const y = cellTop + (cellH - height) / 2
    return {
      id: newStickerId(),
      tokenId: e.tokenId,
      imageUrl: e.imageUrl,
      sourceImageUrl: e.imageUrl,
      x,
      y,
      width,
      height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      tile: { x: cellLeft, y: cellTop, width: cellW, height: cellH },
    }
  })
}

interface Props {
  tokenIds: number[]
  getImageUrl: (tokenId: number) => string
}

export default function SocialBannerEditor({ tokenIds, getImageUrl }: Props) {
  const [preset, setPreset] = useState<CanvasPreset>(() => CANVAS_PRESETS[0]!)
  const [bgColor, setBgColor] = useState('#11171A')
  const [bgFileUrl, setBgFileUrl] = useState<string | null>(null)
  const bgFileUrlRef = useRef<string | null>(null)

  const [stickers, setStickers] = useState<StickerLayer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState<'dl' | 'copy' | null>(null)
  const [removeBgBusy, setRemoveBgBusy] = useState(false)
  const [removeBgError, setRemoveBgError] = useState<string | null>(null)
  const [eraserForId, setEraserForId] = useState<string | null>(null)
  const [eraserBlob, setEraserBlob] = useState<Blob | null>(null)
  const [eraserBlobError, setEraserBlobError] = useState<string | null>(null)
  const [autofillBusy, setAutofillBusy] = useState(false)
  const [bannerGridGap, setBannerGridGap] = useState(0)

  const lastAutofillSnapRef = useRef<LoadedStickerImage[] | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const shapeRefs = useRef<Record<string, Konva.Image>>({})
  const wrapRef = useRef<HTMLDivElement>(null)
  const [displayScale, setDisplayScale] = useState(1)

  const bgImgEl = useLocalBlobImage(bgFileUrl ?? undefined)

  useEffect(() => {
    return () => {
      if (bgFileUrlRef.current) {
        URL.revokeObjectURL(bgFileUrlRef.current)
        bgFileUrlRef.current = null
      }
    }
  }, [])

  /** Changing canvas size would misalign layers; reset stickers + custom bg for a predictable state. */
  const handlePresetChange = (p: CanvasPreset) => {
    lastAutofillSnapRef.current = null
    setStickers(prev => {
      for (const s of prev) revokeBlobUrl(s.imageUrl)
      return []
    })
    setPreset(p)
    setSelectedId(null)
    if (bgFileUrlRef.current) {
      URL.revokeObjectURL(bgFileUrlRef.current)
      bgFileUrlRef.current = null
    }
    setBgFileUrl(null)
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w <= 0) return
      const pad = 8
      const s = Math.min(1, (w - pad) / preset.width)
      setDisplayScale(s)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [preset.width])

  const cw = preset.width
  const ch = preset.height

  useEffect(() => {
    const snap = lastAutofillSnapRef.current
    if (!snap?.length) return
    setStickers(prev => {
      if (prev.length !== snap.length) return prev
      if (!prev.every((s, i) => s.tile && s.tokenId === snap[i]!.tokenId)) return prev
      if (prev.some(s => s.imageUrl.startsWith('blob:'))) return prev
      return layoutStickersGrid(snap, cw, ch, bannerGridGap)
    })
    setSelectedId(null)
  }, [bannerGridGap, cw, ch])

  const updateSticker = useCallback((id: string, patch: Partial<StickerLayer>) => {
    setStickers(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const addSticker = useCallback(
    (tokenId: number) => {
      setLoadError(null)
      const imageUrl = getImageUrl(tokenId)
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        lastAutofillSnapRef.current = null
        setStickers(prev => [
          ...prev,
          createStickerFromImage(tokenId, imageUrl, img, cw, ch),
        ])
        setSelectedId(null)
      }
      img.onerror = () => {
        setLoadError(`Could not load #${tokenId} (CORS or network). Try another.`)
      }
      img.src = imageUrl
    },
    [getImageUrl, cw, ch],
  )

  const autofillBanner = useCallback(() => {
    if (tokenIds.length === 0 || busy !== null) return
    setAutofillBusy(true)
    setLoadError(null)
    void (async () => {
      try {
        const loaded = await Promise.all(tokenIds.map(id => loadStickerImage(id, getImageUrl)))
        lastAutofillSnapRef.current = loaded
        setStickers(prev => {
          for (const s of prev) revokeBlobUrl(s.imageUrl)
          return layoutStickersGrid(loaded, cw, ch, bannerGridGap)
        })
        setSelectedId(null)
        showToast(`Placed ${loaded.length} Gimboz on banner`)
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Could not load one or more images (CORS or network).',
        )
      } finally {
        setAutofillBusy(false)
      }
    })()
  }, [tokenIds, getImageUrl, cw, ch, bannerGridGap, busy, showToast])

  const deleteSelected = () => {
    if (!selectedId) return
    lastAutofillSnapRef.current = null
    setStickers(s => {
      const victim = s.find(x => x.id === selectedId)
      if (victim) revokeBlobUrl(victim.imageUrl)
      return s.filter(x => x.id !== selectedId)
    })
    setSelectedId(null)
  }

  const duplicateSelected = () => {
    if (!selectedId) return
    const s = stickers.find(x => x.id === selectedId)
    if (!s) return
    void (async () => {
      let imageUrl = s.imageUrl
      if (s.imageUrl.startsWith('blob:')) {
        try {
          const b = await fetch(s.imageUrl).then(r => r.blob())
          imageUrl = URL.createObjectURL(b)
        } catch {
          showToast('Could not duplicate edited image')
          return
        }
      }
      const copy: StickerLayer = {
        ...s,
        id: newStickerId(),
        imageUrl,
        x: s.x + 24,
        y: s.y + 24,
        tile: undefined,
      }
      lastAutofillSnapRef.current = null
      setStickers(prev => [...prev, copy])
      setSelectedId(copy.id)
    })()
  }

  const runRemoveBackgroundSelected = () => {
    if (!selectedId) return
    const targetId = selectedId
    const s = stickers.find(x => x.id === targetId)
    if (!s) return
    setRemoveBgError(null)
    setRemoveBgBusy(true)
    void (async () => {
      try {
        const imageBlob = await fetchImageBlobFromUrl(s.sourceImageUrl)
        const { removeBackground } = await import('@imgly/background-removal')
        const blob = await removeBackground(imageBlob, {
          model: 'isnet_quint8',
          output: { format: 'image/png', type: 'foreground' },
        })
        const newUrl = URL.createObjectURL(blob)
        lastAutofillSnapRef.current = null
        setStickers(prev =>
          prev.map(x => {
            if (x.id !== targetId) return x
            revokeBlobUrl(x.imageUrl)
            return { ...x, imageUrl: newUrl }
          }),
        )
        showToast('Background removed')
      } catch (err) {
        console.error(err)
        setRemoveBgError(
          err instanceof Error
            ? err.message
            : 'Could not remove background. The image may block cross-origin loading.',
        )
      } finally {
        setRemoveBgBusy(false)
      }
    })()
  }

  const openEraser = () => {
    if (!selectedId) return
    setEraserBlobError(null)
    setEraserBlob(null)
    setEraserForId(selectedId)
  }

  const closeEraser = useCallback(() => {
    setEraserForId(null)
    setEraserBlob(null)
    setEraserBlobError(null)
  }, [])

  const eraserImageSource = useMemo(() => {
    if (!eraserForId) return null
    return stickers.find(x => x.id === eraserForId)?.imageUrl ?? null
  }, [eraserForId, stickers])

  useEffect(() => {
    if (!eraserForId) {
      setEraserBlob(null)
      setEraserBlobError(null)
      return
    }
    if (eraserImageSource == null) {
      setEraserBlob(null)
      setEraserBlobError('Sticker not found')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const blob = await fetchImageBlobFromUrl(eraserImageSource)
        if (!cancelled) {
          setEraserBlob(blob)
          setEraserBlobError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setEraserBlob(null)
          setEraserBlobError(e instanceof Error ? e.message : 'Could not load image for eraser')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eraserForId, eraserImageSource])

  const handleEraserBlobCommit = useCallback(
    (blob: Blob) => {
      const id = eraserForId
      if (!id) return
      lastAutofillSnapRef.current = null
      setStickers(prev =>
        prev.map(s => {
          if (s.id !== id) return s
          revokeBlobUrl(s.imageUrl)
          return { ...s, imageUrl: URL.createObjectURL(blob) }
        }),
      )
      setEraserBlob(blob)
    },
    [eraserForId],
  )

  const flipH = () => {
    if (!selectedId) return
    const s = stickers.find(x => x.id === selectedId)
    if (!s) return
    updateSticker(selectedId, { scaleX: -s.scaleX })
  }

  const flipV = () => {
    if (!selectedId) return
    const s = stickers.find(x => x.id === selectedId)
    if (!s) return
    updateSticker(selectedId, { scaleY: -s.scaleY })
  }

  const bringForward = () => {
    if (!selectedId) return
    setStickers(prev => {
      const i = prev.findIndex(x => x.id === selectedId)
      if (i < 0 || i >= prev.length - 1) return prev
      const n = [...prev]
      ;[n[i], n[i + 1]] = [n[i + 1]!, n[i]!]
      return n
    })
  }

  const sendBackward = () => {
    if (!selectedId) return
    setStickers(prev => {
      const i = prev.findIndex(x => x.id === selectedId)
      if (i <= 0) return prev
      const n = [...prev]
      ;[n[i], n[i - 1]] = [n[i - 1]!, n[i]!]
      return n
    })
  }

  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    if (!selectedId) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    const node = shapeRefs.current[selectedId]
    if (node) {
      tr.nodes([node])
    } else {
      tr.nodes([])
    }
    tr.getLayer()?.batchDraw()
  }, [selectedId, stickers])

  useEffect(() => {
    if (!eraserForId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEraser()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [eraserForId, closeEraser])

  const exportBlob = async (): Promise<Blob | null> => {
    const stage = stageRef.current
    if (!stage) return null
    const tr = transformerRef.current
    return exportStageToPngBlob(stage, {
      hideWhileExporting: tr ? [tr] : [],
    })
  }

  const handleDownload = async () => {
    setBusy('dl')
    try {
      const blob = await exportBlob()
      if (!blob) {
        showToast('Export failed')
        return
      }
      const res = await savePngBlob(blob, `gimboz-banner-${preset.id}`)
      if (!res.ok) showToast('Download failed')
      else if (res.via === 'new_tab') showToast('Long-press the image to save')
      else showToast('PNG downloaded')
    } catch (e) {
      console.error(e)
      showToast('Download failed')
    } finally {
      setBusy(null)
    }
  }

  const handleCopy = async () => {
    setBusy('copy')
    try {
      const blob = await exportBlob()
      if (!blob || !navigator.clipboard?.write) {
        showToast('Copy not available')
        return
      }
      await copyImageBlobToClipboard(blob)
      showToast('Image copied')
    } catch (e) {
      console.error(e)
      showToast('Could not copy')
    } finally {
      setBusy(null)
    }
  }

  const handleBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    if (bgFileUrlRef.current) URL.revokeObjectURL(bgFileUrlRef.current)
    const url = URL.createObjectURL(f)
    bgFileUrlRef.current = url
    setBgFileUrl(url)
  }

  const clearBgImage = () => {
    if (bgFileUrlRef.current) URL.revokeObjectURL(bgFileUrlRef.current)
    bgFileUrlRef.current = null
    setBgFileUrl(null)
  }

  const bgCover = useMemo(() => {
    if (!bgImgEl) return null
    const nw = bgImgEl.naturalWidth || bgImgEl.width
    const nh = bgImgEl.naturalHeight || bgImgEl.height
    if (nw === 0 || nh === 0) return null
    return coverDims(nw, nh, cw, ch)
  }, [bgImgEl, cw, ch])

  const spin = (k: typeof busy) =>
    busy === k ? (
      <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
    ) : null

  return (
    <div className="space-y-5 mb-6">
      {CANVAS_PRESETS.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 p-1 rounded-xl bg-[#192124] border border-[#31392C] w-full max-w-full overflow-x-auto">
          {CANVAS_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetChange(p)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors
                ${preset.id === p.id
                  ? 'bg-[#6FC50E] text-[#11171A]'
                  : 'text-[#999A92] hover:text-[#C9D0C0]'
                }`}
            >
              {p.label}
              <span className="ml-1 font-mono opacity-80">
                {p.width}×{p.height}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#70736E]">
          Canvas: X / Twitter header{' '}
          <span className="font-mono text-[#999A92]">
            {preset.width}×{preset.height}
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl bg-[#1a2226] px-3 py-2 ring-1 ring-[#2a3236]">
                <span className="text-[10px] uppercase tracking-wider text-[#6d7679]">BG</span>
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/i.test(bgColor) ? bgColor : '#11171a'}
                  onChange={e => setBgColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-md border-0 bg-transparent p-0"
                  aria-label="Background color"
                />
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-[#6d7679]">
                  Presets
                </span>
                {COLLAGE_BG_PRESETS.map(c => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => setBgColor(c)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all shrink-0
                      ${bgColor.toLowerCase() === c.toLowerCase()
                        ? 'border-[#8EFD09] scale-110 ring-2 ring-[#8EFD09]/30'
                        : 'border-[#495151] hover:border-[#70736E]'
                      }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <label className="rounded-xl bg-[#252B2E] px-4 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] hover:ring-[#6FC50E]/40 cursor-pointer transition-all">
                <input type="file" accept="image/*" className="sr-only" onChange={handleBgFile} />
                BG image
              </label>
              {bgFileUrl && (
                <button
                  type="button"
                  onClick={clearBgImage}
                  className="text-xs text-[#70736E] hover:text-[#C9D0C0]"
                >
                  Clear BG image
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#1a2226] px-3 py-2 ring-1 ring-[#2a3236] max-w-full">
              <label htmlFor="banner-grid-gap" className="text-[10px] font-semibold uppercase tracking-wider text-[#6d7679] shrink-0">
                Autofill gap
              </label>
              <input
                id="banner-grid-gap"
                type="range"
                min={0}
                max={48}
                value={bannerGridGap}
                onChange={e => setBannerGridGap(Number(e.target.value))}
                className="w-32 sm:w-40 accent-[#8EFD09]"
              />
              <span className="text-xs text-[#999A92] tabular-nums w-10">{bannerGridGap}px</span>
              <p className="text-[10px] text-[#5c6568] leading-snug min-w-0 flex-1 basis-full sm:basis-auto">
                Spacing for new autofill; moving the slider also re-grids the last autofill (until you edit stickers).
              </p>
            </div>
          </div>

          {loadError && (
            <p className="text-xs text-red-400" role="alert">
              {loadError}
            </p>
          )}
          {removeBgError && (
            <p className="text-xs text-red-400" role="alert">
              {removeBgError}
            </p>
          )}

          <div ref={wrapRef} className="w-full rounded-xl border border-[#31392C] bg-[#0d1214] p-2 overflow-hidden">
            <div
              style={{
                width: cw * displayScale,
                height: ch * displayScale,
                margin: '0 auto',
              }}
            >
              <div
                style={{
                  transform: `scale(${displayScale})`,
                  transformOrigin: 'top left',
                  width: cw,
                  height: ch,
                }}
              >
                <Stage
                  ref={stageRef}
                  width={cw}
                  height={ch}
                  onMouseDown={e => {
                    const clicked = e.target
                    const name = clicked.name()
                    if (clicked === clicked.getStage() || name === 'bg') {
                      setSelectedId(null)
                    }
                  }}
                  onTouchStart={e => {
                    const clicked = e.target
                    const name = clicked.name()
                    if (clicked === clicked.getStage() || name === 'bg') {
                      setSelectedId(null)
                    }
                  }}
                >
                  <Layer>
                    <Rect name="bg" width={cw} height={ch} fill={bgColor} listening />
                    {bgImgEl && bgCover && (
                      <KonvaImage
                        image={bgImgEl}
                        x={bgCover.x}
                        y={bgCover.y}
                        width={bgCover.width}
                        height={bgCover.height}
                        listening={false}
                      />
                    )}
                    {stickers.map(s => (
                      <StickerImage
                        key={s.id}
                        sticker={s}
                        onSelect={() => setSelectedId(s.id)}
                        onChange={next => updateSticker(s.id, next)}
                        shapeRef={node => {
                          if (node) shapeRefs.current[s.id] = node
                          else delete shapeRefs.current[s.id]
                        }}
                      />
                    ))}
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled
                      enabledAnchors={[
                        'top-left',
                        'top-right',
                        'bottom-left',
                        'bottom-right',
                        'middle-left',
                        'middle-right',
                        'top-center',
                        'bottom-center',
                      ]}
                      boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 16 || newBox.height < 16) return oldBox
                        return newBox
                      }}
                    />
                  </Layer>
                </Stage>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleDownload()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#6FC50E] hover:bg-[#8EFD09] disabled:opacity-50 text-[#11171A] font-bold text-sm"
            >
              {spin('dl')}
              Download PNG
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#252B2E] border border-[#495151] disabled:opacity-50 text-[#C9D0C0] font-semibold text-sm"
            >
              {spin('copy')}
              Copy image
            </button>
          </div>
        </div>

        <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <button
            type="button"
            disabled={tokenIds.length === 0 || busy !== null || autofillBusy}
            onClick={() => autofillBanner()}
            className="w-full rounded-xl bg-[#252B2E] px-4 py-3 text-sm font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c]
                       hover:ring-[#6FC50E]/50 disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {autofillBusy ? (
              <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
            ) : null}
            Autofill banner
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5c6568]">Add Gimboz</p>
          {tokenIds.length === 0 ? (
            <p className="text-xs text-[#70736E]">No Gimboz in this build. Go back and pick a wallet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1 [scrollbar-width:thin]">
              {tokenIds.map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => addSticker(id)}
                  className="aspect-square rounded-lg overflow-hidden ring-1 ring-[#2a3236] hover:ring-[#6FC50E]/60 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8EFD09]"
                  aria-label={`Add Gimboz ${id}`}
                >
                  <img
                    src={getImageUrl(id)}
                    alt=""
                    crossOrigin="anonymous"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5c6568] pt-2">Selection</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!selectedId || removeBgBusy || busy !== null}
              onClick={() => runRemoveBackgroundSelected()}
              className="rounded-lg bg-[#252B2E] px-3 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {removeBgBusy ? (
                <span className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
              ) : null}
              Remove background
            </button>
            <button
              type="button"
              disabled={!selectedId || busy !== null}
              onClick={openEraser}
              className="rounded-lg bg-[#252B2E] px-3 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] disabled:opacity-40"
            >
              Eraser
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={deleteSelected}
              className="rounded-lg bg-[#252B2E] px-3 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] disabled:opacity-40"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={duplicateSelected}
              className="rounded-lg bg-[#252B2E] px-3 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] disabled:opacity-40"
            >
              Duplicate
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={flipH}
              className="rounded-lg bg-[#252B2E] px-3 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] disabled:opacity-40"
            >
              Flip H
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={flipV}
              className="rounded-lg bg-[#252B2E] px-3 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] disabled:opacity-40"
            >
              Flip V
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={bringForward}
              className="rounded-lg bg-[#252B2E] px-3 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] disabled:opacity-40"
            >
              Forward
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={sendBackward}
              className="rounded-lg bg-[#252B2E] px-3 py-2 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] disabled:opacity-40"
            >
              Backward
            </button>
          </div>
          <p className="text-[11px] text-[#5c6568] leading-relaxed">
            Drag to move. Handles resize and rotate. Flips use scale; combine with resize as needed.
          </p>
        </div>
      </div>

      {eraserForId &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Eraser"
            onClick={e => {
              if (e.target === e.currentTarget) closeEraser()
            }}
          >
            <div
              className="w-full max-w-lg max-h-[min(90dvh,32rem)] overflow-y-auto rounded-2xl border border-[#31392C] bg-[#192124] p-4 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-[#E8EBE6]">Eraser</h3>
                <button
                  type="button"
                  onClick={closeEraser}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#C9D0C0] ring-1 ring-[#3d474c] hover:bg-[#252B2E]"
                >
                  Done
                </button>
              </div>
              {eraserBlobError && (
                <p className="text-xs text-red-400 mb-2" role="alert">
                  {eraserBlobError}
                </p>
              )}
              {eraserBlob && !eraserBlobError ? (
                <CutoutEraserCanvas blob={eraserBlob} onBlobCommit={handleEraserBlobCommit} />
              ) : !eraserBlobError ? (
                <div className="flex justify-center py-8 text-[#70736E] text-sm">
                  <span className="h-8 w-8 border-2 border-[#6FC50E] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : null}
              <p className="text-[11px] text-[#5c6568] mt-3">Esc or backdrop click to close. Strokes update the sticker on the banner.</p>
            </div>
          </div>,
          document.body,
        )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-[#6FC50E] bg-[#192124] px-4 py-3 text-sm text-[#C9D0C0] shadow-lg max-w-[min(90vw,24rem)] text-center"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function StickerImage({
  sticker,
  onSelect,
  onChange,
  shapeRef,
}: {
  sticker: StickerLayer
  onSelect: () => void
  onChange: (next: Partial<StickerLayer>) => void
  shapeRef: (node: Konva.Image | null) => void
}) {
  const img = useCrossOriginImage(sticker.imageUrl)
  if (!img) return null

  const tile = sticker.tile
  const ix = tile ? sticker.x - tile.x : sticker.x
  const iy = tile ? sticker.y - tile.y : sticker.y

  const imageNode = (
    <KonvaImage
      ref={shapeRef}
      name={`sticker-${sticker.id}`}
      image={img}
      x={ix}
      y={iy}
      width={sticker.width}
      height={sticker.height}
      scaleX={sticker.scaleX}
      scaleY={sticker.scaleY}
      rotation={sticker.rotation}
      draggable
      onPointerDown={e => {
        e.cancelBubble = true
        if (sticker.tile) {
          flushSync(() => {
            onChange({ tile: undefined })
          })
        }
        onSelect()
      }}
      onDragEnd={e => {
        const n = e.target as Konva.Image
        const abs = n.getAbsolutePosition()
        onChange({ x: abs.x, y: abs.y })
      }}
      onTransformEnd={e => {
        const n = e.target as Konva.Image
        const abs = n.getAbsolutePosition()
        onChange({
          x: abs.x,
          y: abs.y,
          rotation: n.rotation(),
          scaleX: n.scaleX(),
          scaleY: n.scaleY(),
          width: n.width(),
          height: n.height(),
        })
      }}
    />
  )

  if (!tile) {
    return imageNode
  }

  return (
    <Group
      x={tile.x}
      y={tile.y}
      clipX={0}
      clipY={0}
      clipWidth={tile.width}
      clipHeight={tile.height}
    >
      {imageNode}
    </Group>
  )
}
