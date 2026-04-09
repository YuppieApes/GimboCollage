import { useState, type RefObject } from 'react'
import {
  collageToPngBlob,
  copyCollageImageToClipboard,
  openBlobPngInNewTab,
  openXIntentPlaceholderTab,
  preparePostOnX,
  saveCollagePngFromNode,
  type CollagePngOptions,
  X_COLLAGE_CAPTION,
} from '../utils/collagePng'

interface Props {
  targetRef: RefObject<HTMLDivElement | null>
  filename?: string
  pngOptions?: CollagePngOptions
}

export default function CollageShareActions({
  targetRef,
  filename = 'gimboz-collage',
  pngOptions,
}: Props) {
  const [busy, setBusy] = useState<'download' | 'copy' | 'x' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [blockedX, setBlockedX] = useState<{ url: string; subtitle: string } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 4000)
  }

  const handleDownload = async () => {
    if (!targetRef.current) return
    setBusy('download')
    try {
      const res = await saveCollagePngFromNode(targetRef.current, filename, pngOptions)
      if (!res.ok) {
        alert('Download failed. Try again.')
        return
      }
      if (res.via === 'new_tab') {
        showToast('Long-press the image → Save to Photos or Share')
      } else if (res.via === 'share_sheet') {
        showToast('Save the image from the share sheet, or pick an app')
      } else {
        showToast('PNG downloaded')
      }
    } catch (err) {
      console.error(err)
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      alert('Download failed. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const handleCopyImage = async () => {
    if (!targetRef.current) return
    setBusy('copy')
    try {
      if (navigator.clipboard?.write) {
        await copyCollageImageToClipboard(targetRef.current, pngOptions)
        showToast('Collage copied')
        return
      }
      const blob = await collageToPngBlob(targetRef.current, pngOptions)
      if (openBlobPngInNewTab(blob)) {
        showToast('Image opened — long-press to Copy or Save')
      } else {
        alert(
          'Copy isn’t available in this browser. Use Download PNG, or open this page in Safari or Chrome.',
        )
      }
    } catch (err) {
      console.error(err)
      alert('Could not copy image. Try Download PNG instead.')
    } finally {
      setBusy(null)
    }
  }

  const handlePostOnX = async () => {
    if (!targetRef.current) return
    const el = targetRef.current
    setBlockedX(null)

    const placeholderTab = openXIntentPlaceholderTab()

    setBusy('x')
    try {
      const result = await preparePostOnX(el, X_COLLAGE_CAPTION, { placeholderTab, pngOptions })
      if (result.kind === 'shared') {
        showToast('Pick X in the share sheet — image and caption go together')
      } else if (result.kind === 'shared_caption_only') {
        showToast('Caption shared — add the collage from Photos if needed, or use Download PNG')
      } else {
        const { xUrl, openedTab, imageHint } = result
        if (imageHint === 'paste') {
          if (openedTab) {
            showToast('Image copied — switch to the X tab and paste to attach the collage')
          } else {
            setBlockedX({
              url: xUrl,
              subtitle: 'Popup blocked. Your image is copied — open X, then paste to attach.',
            })
            showToast('Image copied — open X below, then paste to attach the collage')
          }
        } else if (imageHint === 'save_from_tab') {
          setBlockedX({
            url: xUrl,
            subtitle:
              'A new tab has your collage — long-press the image to save, then attach it in X.',
          })
          showToast('Save the image from the new tab, then open X below')
        } else {
          if (openedTab) {
            showToast('X opened with caption — attach the collage using Download PNG or Photos')
          } else {
            setBlockedX({
              url: xUrl,
              subtitle: 'Open X below. Save the collage with Download PNG, then attach the photo.',
            })
            showToast('Use Download PNG to save the collage, then attach it in X')
          }
        }
      }
    } catch (err) {
      console.error(err)
      if (placeholderTab && !placeholderTab.closed) {
        try {
          placeholderTab.close()
        } catch {
          /* ignore */
        }
      }
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      alert(
        'Could not prepare post. Try Download PNG to save the image, then open X and attach it.',
      )
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

      {blockedX && (
        <div
          className="w-full max-w-md rounded-xl border border-[#6FC50E] bg-[#192124] px-4 py-3 text-center text-sm text-[#C9D0C0]"
          role="status"
        >
          <p className="mb-2 text-[#999A92]">{blockedX.subtitle}</p>
          <a
            href={blockedX.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6FC50E] px-4 py-2 font-semibold text-[#11171A] hover:bg-[#8EFD09]"
            onClick={() => setBlockedX(null)}
          >
            Open X with caption
          </a>
          <button
            type="button"
            onClick={() => setBlockedX(null)}
            className="mt-2 block w-full text-xs text-[#70736E] hover:text-[#C9D0C0]"
          >
            Dismiss
          </button>
        </div>
      )}

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
