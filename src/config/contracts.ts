export const GIMBOZ_NFT_ADDRESS = '0x81C9ce55E8214Fd0f5181FD3D38f52fD8c33Ec38' as const
export const STAKING_WALLET = '0x64bf43d2412ec6385c7675b6dfefeb1f933dc29a' as const
export const EXCLUDE_WALLET = '0xb5c3a66741e21cd80ebdda25479b10a98ea80c52' as const

export const TOTAL_SUPPLY = 4444

export const APECHAIN_ID = 33139
export const APECHAIN_RPC = 'https://rpc.apechain.com/http'

export const ERC721_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
