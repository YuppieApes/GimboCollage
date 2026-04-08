import { useState, type RefObject } from 'react'
import { toPng } from 'html-to-image'

interface Props {
  targetRef: RefObject<HTMLDivElement | null>
  filename?: string
}

export default function ExportButton({ targetRef, filename = 'gimboz-collage' }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!targetRef.current) return
    setExporting(true)

    try {
      const dataUrl = await toPng(targetRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
      })

      const link = document.createElement('a')
      link.download = `${filename}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Try again or use fewer NFTs.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="px-6 py-3 rounded-xl bg-[#6FC50E] hover:bg-[#8EFD09] disabled:opacity-50
                 text-[#11171A] font-bold transition-colors flex items-center gap-2"
    >
      {exporting ? (
        <>
          <div className="w-4 h-4 border-2 border-[#11171A] border-t-transparent rounded-full animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PNG
        </>
      )}
    </button>
  )
}
