export type StickerLayer = {
  id: string
  tokenId: number
  /** Current image (original HTTPS URL or blob: after edits). */
  imageUrl: string
  /** Original PFP URL; used as input for Remove background. */
  sourceImageUrl: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scaleX: number
  scaleY: number
}
