import Konva from 'konva'

/**
 * Rasterize the first layer of the stage at 1:1 pixels (stage width/height).
 * Hides optional nodes (e.g. Transformer) only for the duration of export.
 */
export async function exportStageToPngBlob(
  stage: Konva.Stage,
  options?: { hideWhileExporting?: Konva.Node[] },
): Promise<Blob | null> {
  const hide = options?.hideWhileExporting ?? []
  for (const n of hide) n.visible(false)
  stage.batchDraw()

  const layer = stage.getLayers()[0]
  if (!layer) {
    for (const n of hide) n.visible(true)
    stage.batchDraw()
    return null
  }

  const canvas = layer.getNativeCanvasElement()
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })

  for (const n of hide) n.visible(true)
  stage.batchDraw()

  return blob
}
