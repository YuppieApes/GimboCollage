import { toPng } from 'html-to-image'

const PNG_OPTS = {
  quality: 1,
  pixelRatio: 2,
  cacheBust: true,
} as const

export async function collageToPngBlob(node: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(node, PNG_OPTS)
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function copyImageBlobToClipboard(blob: Blob): Promise<void> {
  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'image/png'
  await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
}

/** Desktop “Share” often sends only the file to X and drops `text`; phones usually keep both. */
export function preferNativeShareForX(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android|iPhone|iPad|iPod/i.test(ua) || navigator.userAgentData?.mobile === true
}

export async function copyCollageImageToClipboard(node: HTMLElement): Promise<void> {
  await copyImageBlobToClipboard(await collageToPngBlob(node))
}

export function twitterIntentTweetUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}

/**
 * Open X compose in a new tab. Returns false if the browser blocked the popup.
 * (Cannot use noopener here — it makes `window.open` return null even when a tab opens.)
 */
export function tryOpenTweetIntent(text: string): boolean {
  const w = window.open(twitterIntentTweetUrl(text), '_blank', 'noreferrer')
  return w != null && !w.closed
}

/**
 * Call synchronously in the click handler (before any await). Browsers only allow popups tied
 * to the click; we navigate this tab to the tweet intent after the collage is copied.
 */
export function openXIntentPlaceholderTab(): Window | null {
  const w = window.open('about:blank', '_blank')
  if (!w) return null
  try {
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Post to X</title></head>' +
        '<body style="margin:0;font:15px system-ui,sans-serif;line-height:1.5;color:#334155;' +
        'display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc">' +
        '<p>Finishing up…</p></body></html>',
    )
    w.document.close()
  } catch {
    /* ignore */
  }
  return w
}

export type PreparePostOnXResult =
  | { kind: 'shared' }
  | { kind: 'intent'; xUrl: string; openedTab: boolean }

export type PreparePostOnXOptions = {
  /** Tab from openXIntentPlaceholderTab(); navigated to X after copy (avoids popup block). */
  placeholderTab?: Window | null
}

/**
 * Prefer Web Share (image + caption) on phones.
 * On desktop: copy image, then navigate placeholderTab to tweet intent (or open a new tab if none).
 */
export async function preparePostOnX(
  node: HTMLElement,
  caption: string,
  options: PreparePostOnXOptions = {},
): Promise<PreparePostOnXResult> {
  const { placeholderTab = null } = options
  const blob = await collageToPngBlob(node)
  const mime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'image/png'
  const file = new File([blob], 'gimboz-collage.png', { type: mime })

  const sharePayload = { files: [file], text: caption }
  if (
    preferNativeShareForX() &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.(sharePayload)
  ) {
    try {
      await navigator.share(sharePayload)
      return { kind: 'shared' }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }

  if (!navigator.clipboard?.write) {
    throw new Error('Clipboard not available')
  }

  await copyImageBlobToClipboard(blob)
  await new Promise((r) => setTimeout(r, 100))

  const xUrl = twitterIntentTweetUrl(caption)
  if (placeholderTab && !placeholderTab.closed) {
    placeholderTab.location.href = xUrl
    return { kind: 'intent', xUrl, openedTab: true }
  }
  const openedTab = tryOpenTweetIntent(caption)
  return { kind: 'intent', xUrl, openedTab }
}

export const X_COLLAGE_CAPTION = `CHURCH! 🐸

Just made my Gimboz collage on https://gimbo-collage.vercel.app/

@apechurch`
