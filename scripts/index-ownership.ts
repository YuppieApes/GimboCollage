import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const GIMBOZ_NFT = '0x81C9ce55E8214Fd0f5181FD3D38f52fD8c33Ec38' as const
const STAKING_WALLET = '0x64bf43d2412ec6385c7675b6dfefeb1f933dc29a'.toLowerCase()
const EXCLUDE_WALLET = '0xb5c3a66741e21cd80ebdda25479b10a98ea80c52'.toLowerCase()
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const apeChain = {
  id: 33139,
  name: 'ApeChain',
  nativeCurrency: { name: 'APE', symbol: 'APE', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.apechain.com/http'] } },
} as const

const client = createPublicClient({
  chain: apeChain,
  transport: http('https://rpc.apechain.com/http'),
})

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
)

const erc721Abi = [
  {
    type: 'function' as const,
    name: 'tokenURI' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'tokenId' as const, type: 'uint256' as const }],
    outputs: [{ name: '' as const, type: 'string' as const }],
  },
]

async function findDeployBlock(): Promise<bigint> {
  const latest = await client.getBlockNumber()
  // Contract was deployed ~1 week ago. Search last ~600k blocks (ApeChain has fast blocks).
  // Start conservatively far back to ensure we catch everything.
  const startGuess = latest - 700000n
  return startGuess > 0n ? startGuess : 0n
}

async function fetchAllTransfers(fromBlock: bigint, toBlock: bigint) {
  console.log(`Fetching Transfer events from block ${fromBlock} to ${toBlock}...`)
  const allLogs: Array<{ from: string; to: string; tokenId: bigint; blockNumber: bigint }> = []

  const CHUNK = 50000n
  let start = fromBlock
  while (start <= toBlock) {
    const end = start + CHUNK - 1n > toBlock ? toBlock : start + CHUNK - 1n
    process.stdout.write(`  blocks ${start}-${end}...`)
    try {
      const logs = await client.getLogs({
        address: GIMBOZ_NFT,
        event: transferEvent,
        fromBlock: start,
        toBlock: end,
      })
      for (const log of logs) {
        allLogs.push({
          from: (log.args.from as string).toLowerCase(),
          to: (log.args.to as string).toLowerCase(),
          tokenId: log.args.tokenId as bigint,
          blockNumber: log.blockNumber,
        })
      }
      console.log(` ${logs.length} events`)
    } catch (err: any) {
      // If chunk too large, halve it
      if (CHUNK > 5000n) {
        console.log(` retrying with smaller chunks...`)
        const mid = start + (end - start) / 2n
        const first = await fetchRange(start, mid)
        const second = await fetchRange(mid + 1n, end)
        allLogs.push(...first, ...second)
      } else {
        throw err
      }
    }
    start = end + 1n
  }

  return allLogs
}

async function fetchRange(from: bigint, to: bigint) {
  const logs = await client.getLogs({
    address: GIMBOZ_NFT,
    event: transferEvent,
    fromBlock: from,
    toBlock: to,
  })
  return logs.map(log => ({
    from: (log.args.from as string).toLowerCase(),
    to: (log.args.to as string).toLowerCase(),
    tokenId: log.args.tokenId as bigint,
    blockNumber: log.blockNumber,
  }))
}

function resolveOwnership(
  transfers: Array<{ from: string; to: string; tokenId: bigint; blockNumber: bigint }>
) {
  // Sort by block number to process chronologically
  transfers.sort((a, b) => Number(a.blockNumber - b.blockNumber))

  // Track current on-chain holder per tokenId
  const currentHolder = new Map<string, string>()
  // Track the last address that sent each token TO the staking wallet
  const lastSenderToStaking = new Map<string, string>()

  for (const t of transfers) {
    const tokenStr = t.tokenId.toString()
    currentHolder.set(tokenStr, t.to)

    if (t.to === STAKING_WALLET && t.from !== ZERO_ADDRESS) {
      lastSenderToStaking.set(tokenStr, t.from)
    }
  }

  // Build final owner map: ownerAddress -> [tokenIds]
  const ownerToTokens = new Map<string, number[]>()

  for (const [tokenStr, holder] of currentHolder) {
    const tokenId = parseInt(tokenStr)
    let realOwner: string

    if (holder === EXCLUDE_WALLET) {
      continue // skip excluded wallet
    } else if (holder === STAKING_WALLET) {
      const staker = lastSenderToStaking.get(tokenStr)
      if (!staker || staker === EXCLUDE_WALLET) continue
      realOwner = staker
    } else {
      realOwner = holder
    }

    const existing = ownerToTokens.get(realOwner) || []
    existing.push(tokenId)
    ownerToTokens.set(realOwner, existing)
  }

  // Sort token IDs within each owner
  for (const tokens of ownerToTokens.values()) {
    tokens.sort((a, b) => a - b)
  }

  return ownerToTokens
}

async function discoverImageBaseUrl(): Promise<string> {
  console.log('Discovering image base URL from tokenURI...')
  try {
    const tokenUri = await client.readContract({
      address: GIMBOZ_NFT,
      abi: erc721Abi,
      functionName: 'tokenURI',
      args: [1n],
    }) as string
    console.log(`  tokenURI(1) = ${tokenUri}`)

    // Fetch metadata to get image pattern
    const httpUri = tokenUri.startsWith('ipfs://')
      ? tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
      : tokenUri

    const resp = await fetch(httpUri)
    const metadata = await resp.json()
    console.log(`  metadata.image = ${metadata.image}`)

    // Extract base pattern from image URL
    const imageUrl: string = metadata.image || ''
    // Try to extract the base by removing the token-specific part
    const lastSlash = imageUrl.lastIndexOf('/')
    if (lastSlash > 0) {
      const base = imageUrl.substring(0, lastSlash + 1)
      // Check if the filename after slash is just "1" or "1.png" etc
      const filename = imageUrl.substring(lastSlash + 1)
      const ext = filename.includes('.') ? filename.substring(filename.indexOf('.')) : ''
      return JSON.stringify({ base, ext })
    }
    return JSON.stringify({ base: imageUrl, ext: '' })
  } catch (err) {
    console.error('  Failed to discover image URL, will use tokenURI pattern:', err)
    return JSON.stringify({ base: '', ext: '' })
  }
}

async function main() {
  console.log('=== Gimboz Ownership Indexer ===\n')

  const latestBlock = await client.getBlockNumber()
  console.log(`Latest block: ${latestBlock}`)

  const fromBlock = await findDeployBlock()
  console.log(`Scanning from block: ${fromBlock}\n`)

  const transfers = await fetchAllTransfers(fromBlock, latestBlock)
  console.log(`\nTotal transfer events: ${transfers.length}`)

  const ownerMap = resolveOwnership(transfers)
  console.log(`Unique owners (resolved): ${ownerMap.size}`)

  let totalTokens = 0
  for (const tokens of ownerMap.values()) {
    totalTokens += tokens.length
  }
  console.log(`Total tokens indexed: ${totalTokens}`)

  // Convert to plain object for JSON
  const ownership: Record<string, number[]> = {}
  for (const [addr, tokens] of ownerMap) {
    ownership[addr] = tokens
  }

  // Discover image URL pattern
  const imageInfo = await discoverImageBaseUrl()
  const { base: imageBase, ext: imageExt } = JSON.parse(imageInfo)

  // Build images map: tokenId -> full image URL
  const images: Record<string, string> = {}
  if (imageBase) {
    for (let i = 1; i <= 4444; i++) {
      const url = imageBase.startsWith('ipfs://')
        ? imageBase.replace('ipfs://', 'https://ipfs.io/ipfs/') + i + imageExt
        : imageBase + i + imageExt
      images[i.toString()] = url
    }
  }

  // Write outputs
  const publicDir = join(__dirname, '..', 'public')
  mkdirSync(publicDir, { recursive: true })

  writeFileSync(join(publicDir, 'ownership.json'), JSON.stringify(ownership))
  console.log(`\nWrote ownership.json (${Object.keys(ownership).length} owners)`)

  writeFileSync(join(publicDir, 'images.json'), JSON.stringify(images))
  console.log(`Wrote images.json (${Object.keys(images).length} entries)`)

  console.log('\nDone!')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
