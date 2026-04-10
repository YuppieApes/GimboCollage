import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

/** Longest edge cap for canvas editing (memory vs quality). */
const MAX_EDIT_SIDE = 2800

const checkerWrapStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #252d31 25%, transparent 25%), linear-gradient(-45deg, #252d31 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #252d31 75%), linear-gradient(-45deg, transparent 75%, #252d31 75%)',
  backgroundSize: '10px 10px',
  backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0',
  backgroundColor: '#1a2226',
}

function canvasCoords(e: React.PointerEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  const sx = canvas.width / rect.width
  const sy = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * sx,
    y: (e.clientY - rect.top) * sy,
  }
}

type Pt = { x: number; y: number }

interface Props {
  blob: Blob
  onBlobCommit: (blob: Blob) => void
}

export default function CutoutEraserCanvas({ blob, onBlobCommit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [brushSize, setBrushSize] = useState(20)
  const brushRef = useRef(brushSize)
  brushRef.current = brushSize

  const drawing = useRef(false)
  const last = useRef<Pt | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let cleaned = false
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      if (cleaned) return
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w === 0 || h === 0) return
      const scale = Math.min(1, MAX_EDIT_SIDE / Math.max(w, h))
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      canvas.width = w
      canvas.height = h
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
    }
    img.src = url
    return () => {
      cleaned = true
      URL.revokeObjectURL(url)
    }
  }, [blob])

  const eraseLine = (from: Pt, to: Pt) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    const r = brushRef.current
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineWidth = r * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.restore()
  }

  const eraseDot = (p: Pt) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    const r = brushRef.current
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const commit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((b) => {
      if (b) onBlobCommit(b)
    }, 'image/png')
  }, [onBlobCommit])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const c = canvasRef.current
    if (!c || c.width === 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = canvasCoords(e, c)
    drawing.current = true
    last.current = p
    eraseDot(p)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const c = canvasRef.current
    if (!c) return
    const p = canvasCoords(e, c)
    eraseLine(last.current, p)
    last.current = p
  }

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      /* ignore */
    }
    drawing.current = false
    last.current = null
    commit()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5c6568]">
          Manual eraser
        </span>
        <input
          type="range"
          min={4}
          max={72}
          value={brushSize}
          onChange={e => setBrushSize(Number(e.target.value))}
          className="w-32 accent-[#6FC50E]"
          aria-label="Eraser size"
        />
        <span className="text-xs font-mono tabular-nums text-[#8a9396]">{brushSize}px</span>
      </div>
      <div className="inline-flex max-w-full rounded-xl p-1.5 ring-1 ring-[#2a3236]" style={checkerWrapStyle}>
        <canvas
          ref={canvasRef}
          className="max-h-52 w-auto max-w-full rounded-lg cursor-crosshair touch-none block mx-auto"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
      </div>
      <p className="text-[11px] text-[#5c6568] leading-relaxed">
        Brush over leftover edges to erase them to transparency. Updates apply when you release the stroke.
      </p>
    </div>
  )
}
