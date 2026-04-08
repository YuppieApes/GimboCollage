import { useState } from 'react'

interface Props {
  tokenId: number
  imageUrl: string
  selected: boolean
  onToggle: (tokenId: number) => void
}

export default function NftCard({ tokenId, imageUrl, selected, onToggle }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  return (
    <button
      onClick={() => onToggle(tokenId)}
      className={`nft-card relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all
        ${selected
          ? 'border-[#8EFD09] shadow-[0_0_16px_rgba(142,253,9,0.4)] scale-[1.02]'
          : 'border-transparent hover:border-[#495151]'
        }`}
    >
      <div className="aspect-square bg-[#192124] relative">
        {!imgError ? (
          <img
            src={imageUrl}
            alt={`Gimboz #${tokenId}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-opacity duration-300
              ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#70736E] text-xs">
            #{tokenId}
          </div>
        )}
        {!loaded && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#8EFD09] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 bg-[#192124] text-center">
        <span className="text-xs font-medium text-[#999A92]">#{tokenId}</span>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#6FC50E]
                        flex items-center justify-center shadow-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#11171A" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  )
}
