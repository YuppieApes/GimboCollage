import { toPng } from 'html-to-image'

const DEFAULT_PNG_OPTS = {
  quality: 1,
  pixelRatio: 2,
  cacheBust: true,
} as const

export type CollagePngOptions = {
  /** Default 2 for on-screen collage preview export; use 1 when the node is already full output pixels. */
  pixelRatio?: number
  /** Optional override passed to html-to-image when you want explicit output dimensions. */
  width?: number
  height?: number
  /** PNG with alpha; html-to-image clears the root background. */
  transparentBackground?: boolean
}

export async function collageToPngBlob(
  node: HTMLElement,
  options?: CollagePngOptions,
): Promise<Blob> {
  const {
    pixelRatio = DEFAULT_PNG_OPTS.pixelRatio,
    width,
    height,
    transparentBackground,
  } = options ?? {}
  const dataUrl = await toPng(node, {
    ...DEFAULT_PNG_OPTS,
    pixelRatio,
    ...(width != null && height != null ? { width, height } : {}),
    ...(transparentBackground
      ? { backgroundColor: 'rgba(0,0,0,0)' as const }
      : {}),
  })
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
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  return /Android|iPhone|iPad|iPod/i.test(ua) || uaData?.mobile === true
}

export async function copyCollageImageToClipboard(
  node: HTMLElement,
  pngOptions?: CollagePngOptions,
): Promise<void> {
  await copyImageBlobToClipboard(await collageToPngBlob(node, pngOptions))
}

/** iOS and many mobile browsers ignore or break `<a download>` on blob URLs; opening the image works for long-press → Save. */
export function openBlobPngInNewTab(blob: Blob): boolean {
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (!w) {
    URL.revokeObjectURL(url)
    return false
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
  return true
}

export type SaveCollagePngResult =
  | { ok: true; via: 'download' | 'new_tab' | 'share_sheet' }
  | { ok: false }

/**
 * Desktop: trigger file download. Mobile: open image in a new tab (Save Image) or Web Share with file when popups are blocked.
 */
export async function saveCollagePngFromNode(
  node: HTMLElement,
  filename: string,
  pngOptions?: CollagePngOptions,
): Promise<SaveCollagePngResult> {
  const blob = await collageToPngBlob(node, pngOptions)
  const base = filename.replace(/\.png$/i, '')
  const file = new File([blob], `${base}.png`, {
    type: blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'image/png',
  })

  const mobile = preferNativeShareForX()

  if (mobile) {
    if (openBlobPngInNewTab(blob)) {
      return { ok: true, via: 'new_tab' }
    }
    const shareFiles = { files: [file] }
    if (
      typeof navigator.share === 'function' &&
      navigator.canShare?.(shareFiles)
    ) {
      try {
        await navigator.share(shareFiles)
        return { ok: true, via: 'share_sheet' }
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e
      }
    }
  }

  try {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${base}.png`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
    return { ok: true, via: 'download' }
  } catch {
    if (openBlobPngInNewTab(blob)) return { ok: true, via: 'new_tab' }
    return { ok: false }
  }
}

/** Save an existing PNG blob (e.g. Konva stage export) with the same mobile/desktop behavior as {@link saveCollagePngFromNode}. */
export async function savePngBlob(
  blob: Blob,
  filename: string,
): Promise<SaveCollagePngResult> {
  const base = filename.replace(/\.png$/i, '')
  const file = new File([blob], `${base}.png`, {
    type: blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'image/png',
  })

  const mobile = preferNativeShareForX()

  if (mobile) {
    if (openBlobPngInNewTab(blob)) {
      return { ok: true, via: 'new_tab' }
    }
    const shareFiles = { files: [file] }
    if (
      typeof navigator.share === 'function' &&
      navigator.canShare?.(shareFiles)
    ) {
      try {
        await navigator.share(shareFiles)
        return { ok: true, via: 'share_sheet' }
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e
      }
    }
  }

  try {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${base}.png`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
    return { ok: true, via: 'download' }
  } catch {
    if (openBlobPngInNewTab(blob)) return { ok: true, via: 'new_tab' }
    return { ok: false }
  }
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
  | { kind: 'shared_caption_only' }
  | {
      kind: 'intent'
      xUrl: string
      openedTab: boolean
      imageHint: 'paste' | 'save_from_tab' | 'caption_only'
    }

export type PreparePostOnXOptions = {
  /** Tab from openXIntentPlaceholderTab(); navigated after export (avoids popup block). */
  placeholderTab?: Window | null
  pngOptions?: CollagePngOptions
}

function safeCloseTab(w: Window | null | undefined): void {
  if (!w || w.closed) return
  try {
    w.close()
  } catch {
    /* ignore */
  }
}

/**
 * Prefer Web Share (image + caption) on phones.
 * Fallbacks: share file only, share caption only, clipboard + X tab, or image-in-tab + in-app X link.
 */
export async function preparePostOnX(
  node: HTMLElement,
  caption: string,
  options: PreparePostOnXOptions = {},
): Promise<PreparePostOnXResult> {
  const { placeholderTab = null, pngOptions } = options
  const blob = await collageToPngBlob(node, pngOptions)
  const mime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'image/png'
  const file = new File([blob], 'gimboz-collage.png', { type: mime })
  const xUrl = twitterIntentTweetUrl(caption)

  const sharePayload = { files: [file], text: caption }
  if (
    preferNativeShareForX() &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.(sharePayload)
  ) {
    try {
      await navigator.share(sharePayload)
      safeCloseTab(placeholderTab)
      return { kind: 'shared' }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }

  const filesOnly = { files: [file] }
  if (
    preferNativeShareForX() &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.(filesOnly)
  ) {
    try {
      await navigator.share(filesOnly)
      safeCloseTab(placeholderTab)
      return { kind: 'shared' }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }

  const textOnly = { text: caption }
  if (
    preferNativeShareForX() &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.(textOnly)
  ) {
    try {
      await navigator.share(textOnly)
      safeCloseTab(placeholderTab)
      return { kind: 'shared_caption_only' }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }

  let clipboardOk = false
  if (navigator.clipboard?.write) {
    try {
      await copyImageBlobToClipboard(blob)
      clipboardOk = true
    } catch {
      clipboardOk = false
    }
  }

  await new Promise((r) => setTimeout(r, 100))

  if (clipboardOk) {
    if (placeholderTab && !placeholderTab.closed) {
      placeholderTab.location.href = xUrl
      return { kind: 'intent', xUrl, openedTab: true, imageHint: 'paste' }
    }
    const openedTab = tryOpenTweetIntent(caption)
    return { kind: 'intent', xUrl, openedTab, imageHint: 'paste' }
  }

  const imageUrl = URL.createObjectURL(blob)
  if (placeholderTab && !placeholderTab.closed) {
    placeholderTab.location.href = imageUrl
    window.setTimeout(() => URL.revokeObjectURL(imageUrl), 120_000)
    return { kind: 'intent', xUrl, openedTab: true, imageHint: 'save_from_tab' }
  }

  URL.revokeObjectURL(imageUrl)
  if (openBlobPngInNewTab(blob)) {
    return { kind: 'intent', xUrl, openedTab: true, imageHint: 'save_from_tab' }
  }

  const openedTab = tryOpenTweetIntent(caption)
  return { kind: 'intent', xUrl, openedTab, imageHint: 'caption_only' }
}

export const X_COLLAGE_CAPTION = `CHURCH! 🐸

Just made my Gimboz collage on https://gimbo-collage.vercel.app/

@apechurch`
