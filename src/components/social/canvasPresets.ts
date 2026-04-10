export type CanvasPreset = {
  id: string
  label: string
  width: number
  height: number
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'x-header', label: 'X / Twitter header', width: 1500, height: 500 },
]

export function getPresetById(id: string): CanvasPreset | undefined {
  return CANVAS_PRESETS.find(p => p.id === id)
}
