import type { WorkspaceNavTab } from '../types/workspace'

const TAB_CLASS =
  'shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors'

interface Props {
  active: WorkspaceNavTab | null
  onChange: (tab: WorkspaceNavTab) => void
}

export default function WorkspaceTabBar({ active, onChange }: Props) {
  const item = (id: WorkspaceNavTab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={active === id}
      onClick={() => onChange(id)}
      className={`${TAB_CLASS} ${
        active === id
          ? 'bg-[#6FC50E] text-[#11171A]'
          : 'text-[#999A92] hover:text-[#C9D0C0]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div
      className="flex flex-nowrap items-stretch gap-1.5 sm:gap-2 mb-6 p-1 rounded-xl bg-[#192124] border border-[#31392C] w-full overflow-x-auto [scrollbar-width:thin]"
      role="tablist"
      aria-label="Tools"
    >
      {item('collection', 'Collection')}
      {item('viewer3d', '3DViewer')}
      {item('studio', 'Cut out')}
      {item('social', 'Banner')}
      {item('wallpaper', 'Wallpaper')}
    </div>
  )
}
