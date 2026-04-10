import { useState } from 'react'

interface Props {
  onLookup: (address: string) => void
  loading?: boolean
}

export default function WalletInput({ onLookup, loading }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setError('Enter a valid Ethereum address (0x...)')
      return
    }
    setError('')
    onLookup(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto">
      <label className="block text-sm font-medium text-[#999A92] mb-2">
        Wallet address
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          placeholder="0x..."
          className="flex-1 px-4 py-3 rounded-xl bg-[#252B2E] border border-[#495151]
                     text-[#C9D0C0] placeholder-[#70736E] focus:outline-none focus:border-[#8EFD09]
                     focus:ring-1 focus:ring-[#8EFD09] transition-colors text-sm font-mono"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="px-6 py-3 rounded-xl bg-[#6FC50E] hover:bg-[#8EFD09] disabled:opacity-40
                     disabled:cursor-not-allowed text-[#11171A] font-semibold transition-colors
                     whitespace-nowrap text-sm"
        >
          {loading ? 'Loading...' : 'Look Up'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </form>
  )
}
