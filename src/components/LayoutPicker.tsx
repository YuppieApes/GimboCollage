export type LayoutType =
  | 'grid-2x2'
  | 'grid-3x3'
  | 'grid-4x4'
  | 'grid-auto'

interface Props {
  value: LayoutType
  onChange: (layout: LayoutType) => void
  count: number
}

const LAYOUTS: { id: LayoutType; label: string; icon: string }[] = [
  { id: 'grid-2x2', label: '2x2', icon: '⊞' },
  { id: 'grid-3x3', label: '3x3', icon: '▦' },
  { id: 'grid-4x4', label: '4x4', icon: '▩' },
  { id: 'grid-auto', label: 'Auto Grid', icon: '▤' },
]

export default function LayoutPicker({ value, onChange, count }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {LAYOUTS.map(layout => {
        const disabled = layout.id === 'grid-2x2' && count > 4
          || layout.id === 'grid-3x3' && count > 9
          || layout.id === 'grid-4x4' && count > 16

        return (
          <button
            key={layout.id}
            onClick={() => onChange(layout.id)}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
              ${value === layout.id
                ? 'bg-[#6FC50E] text-[#11171A] shadow-lg'
                : disabled
                  ? 'bg-[#252B2E] text-[#495151] cursor-not-allowed'
                  : 'bg-[#252B2E] text-[#C9D0C0] hover:bg-[#31392C]'
              }`}
          >
            <span className="text-lg">{layout.icon}</span>
            {layout.label}
          </button>
        )
      })}
    </div>
  )
}

export function getGridConfig(layout: LayoutType, count: number) {
  switch (layout) {
    case 'grid-2x2': return { cols: 2, rows: 2 }
    case 'grid-3x3': return { cols: 3, rows: 3 }
    case 'grid-4x4': return { cols: 4, rows: 4 }
    case 'grid-auto': {
      const cols = Math.ceil(Math.sqrt(count))
      const rows = Math.ceil(count / cols)
      return { cols, rows }
    }
  }
}

/** Width / height ratio for lightbox `aspect-ratio` (uniform cell grids). */
export function getPreviewAspect(layout: LayoutType, count: number): { w: number; h: number } {
  if (count < 1) return { w: 1, h: 1 }
  const { cols, rows } = getGridConfig(layout, count)
  return { w: cols, h: rows }
}
