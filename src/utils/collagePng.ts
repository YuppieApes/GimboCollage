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

export async function copyCollageImageToClipboard(node: HTMLElement): Promise<void> {
  const blob = await collageToPngBlob(node)
  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'image/png'
  await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
}

/** Opens X compose with text; user pastes the collage (copied to clipboard first). */
export function openXIntentWithText(text: string): void {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export const X_COLLAGE_CAPTION = `CHURCH! 🐸

Just made my Gimboz collage on https://gimbo-collage.vercel.app/ 
@apechurch`
