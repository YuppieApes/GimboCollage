/** Draw foreground PNG (with alpha) over a solid color and/or a cover-scaled background image. */
export async function composeCutoutOnBackground(
  cutoutBlob: Blob,
  fillColor: string,
  backgroundImageBlob: Blob | null,
): Promise<Blob> {
  const fgUrl = URL.createObjectURL(cutoutBlob)
  const fg = new Image()
  await new Promise<void>((resolve, reject) => {
    fg.onload = () => resolve()
    fg.onerror = () => reject(new Error('Could not load cutout'))
    fg.src = fgUrl
  })
  URL.revokeObjectURL(fgUrl)

  let bgImg: HTMLImageElement | null = null
  if (backgroundImageBlob) {
    const bgUrl = URL.createObjectURL(backgroundImageBlob)
    bgImg = new Image()
    await new Promise<void>((resolve, reject) => {
      bgImg!.onload = () => resolve()
      bgImg!.onerror = () => reject(new Error('Could not load background image'))
      bgImg!.src = bgUrl
    })
    URL.revokeObjectURL(bgUrl)
  }

  const w = fg.naturalWidth
  const h = fg.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  if (bgImg) {
    const scale = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight)
    const dw = bgImg.naturalWidth * scale
    const dh = bgImg.naturalHeight * scale
    const dx = (w - dw) / 2
    const dy = (h - dh) / 2
    ctx.drawImage(bgImg, dx, dy, dw, dh)
  } else {
    ctx.fillStyle = fillColor
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(fg, 0, 0)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png')
  })
}
