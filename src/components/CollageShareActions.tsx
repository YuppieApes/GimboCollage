import { useState, type RefObject } from 'react'
import {
  collageToPngBlob,
  copyCollageImageToClipboard,
  openXIntentWithText,
  X_COLLAGE_CAPTION,
} from '../utils/collagePng'

interface Props {
  targetRef: RefObject<HTMLDivElement | null>
  filename?: string
}

export default function CollageShareActions({
  targetRef,
  filename = 'gimboz-collage',
}: Props) {
  const [busy, setBusy] = useState<'download' | 'copy' | 'x' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3500)
  }

  const handleDownload = async () => {
    if (!targetRef.current) return
    setBusy('download')
    try {
      const dataUrl = URL.createObjectURL(await collageToPngBlob(targetRef.current))
      const link = document.createElement('a')
      link.download = `${filename}.png`
      link.href = dataUrl
      link.click()
      URL.revokeObjectURL(dataUrl)
      showToast('PNG downloaded')
    } catch (err) {
      console.error(err)
      alert('Download failed. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const handleCopyImage = async () => {
    if (!targetRef.current) return
    if (!navigator.clipboard?.write) {
      alert('Copy to clipboard is not supported in this browser.')
      return
    }
    setBusy('copy')
    try {
      await copyCollageImageToClipboard(targetRef.current)
      showToast('Collage copied')
    } catch (err) {
      console.error(err)
      alert('Could not copy image. Try Download PNG instead.')
    } finally {
      setBusy(null)
    }
  }

  const handlePostOnX = async () => {
    if (!targetRef.current) return
    if (!navigator.clipboard?.write) {
      alert('Clipboard is required to post with your collage. Try Chrome or Edge, or use Download.')
      return
    }
    setBusy('x')
    try {
      await copyCollageImageToClipboard(targetRef.current)
      openXIntentWithText(X_COLLAGE_CAPTION)
      showToast('Collage copied')
    } catch (err) {
      console.error(err)
      alert('Could not prepare post. Try Copy image, then open X manually.')
    } finally {
      setBusy(null)
    }
  }

  const spin = (key: typeof busy) =>
    busy === key ? (
      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
    ) : null

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy !== null}
          className="px-5 py-3 rounded-xl bg-[#6FC50E] hover:bg-[#8EFD09] disabled:opacity-50
                     text-[#11171A] font-bold transition-colors inline-flex items-center gap-2"
        >
          {spin('download')}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PNG
        </button>

        <button
          type="button"
          onClick={handleCopyImage}
          disabled={busy !== null}
          className="px-5 py-3 rounded-xl bg-[#252B2E] hover:bg-[#31392C] border border-[#495151] disabled:opacity-50
                     text-[#C9D0C0] font-semibold transition-colors inline-flex items-center gap-2"
        >
          {spin('copy')}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy image
        </button>

        <button
          type="button"
          onClick={handlePostOnX}
          disabled={busy !== null}
          className="px-5 py-3 rounded-xl bg-[#11171A] hover:bg-[#192124] border border-[#495151] disabled:opacity-50
                     text-[#C9D0C0] font-semibold transition-colors inline-flex items-center gap-2"
        >
          {spin('x')}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Post on X
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl bg-[#192124] border border-[#6FC50E]
                     text-[#C9D0C0] text-sm shadow-lg max-w-[min(90vw,28rem)] text-center animate-fade-in"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
