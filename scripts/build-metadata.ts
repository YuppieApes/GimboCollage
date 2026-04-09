/**
 * Build public/gimboz-metadata.json from on-chain tokenURI + JSON metadata.
 * Run after updating public/ownership.json (e.g. npm run index) so all holder tokens are included.
 *
 * Usage: npm run build-metadata
 */
import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const GIMBOZ_NFT = '0x81C9ce55E8214Fd0f5181FD3D38f52fD8c33Ec38' as const

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

const erc721Abi = [
  {
    type: 'function' as const,
    name: 'tokenURI' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'tokenId' as const, type: 'uint256' as const }],
    outputs: [{ name: '' as const, type: 'string' as const }],
  },
] as const

type RawAttr = { trait_type?: string; value?: string | number }
type StoredAttr = { trait_type: string; value: string }

function toHttpUri(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
  }
  return uri
}

function parseDataJsonUri(uri: string): unknown | null {
  const m = uri.match(/^data:application\/json;(?:charset=[^;]+;)?base64,(.+)$/i)
  if (!m) return null
  try {
    const json = Buffer.from(m[1], 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

async function fetchMetadataJson(tokenUri: string): Promise<unknown | null> {
  if (tokenUri.startsWith('data:')) {
    return parseDataJsonUri(tokenUri)
  }
  const url = toHttpUri(tokenUri)
  const res = await fetch(url)
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

function normalizeAttributes(raw: unknown): StoredAttr[] {
  if (!raw || typeof raw !== 'object') return []
  const attrs = (raw as { attributes?: RawAttr[] }).attributes
  if (!Array.isArray(attrs)) return []
  const out: StoredAttr[] = []
  for (const a of attrs) {
    const traitType = a.trait_type != null ? String(a.trait_type).trim() : ''
    const valueRaw = a.value
    const value =
      valueRaw === null || valueRaw === undefined ? '' : String(valueRaw).trim()
    if (!traitType || !value) continue
    out.push({ trait_type: traitType, value })
  }
  return out
}

function isCountedTrait(attr: StoredAttr): boolean {
  const v = attr.value.toLowerCase()
  if (v === '' || v === 'none' || v === 'n/a' || v === 'na') return false
  return true
}

function traitKey(attr: StoredAttr): string {
  return `${attr.trait_type}\0${attr.value}`
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function main() {
  const publicDir = join(__dirname, '..', 'public')
  const ownershipPath = join(publicDir, 'ownership.json')

  let ownership: Record<string, number[]>
  try {
    ownership = JSON.parse(readFileSync(ownershipPath, 'utf8')) as Record<string, number[]>
  } catch {
    console.error('Missing or invalid public/ownership.json — run npm run index first.')
    process.exit(1)
  }

  const idSet = new Set<number>()
  for (const list of Object.values(ownership)) {
    for (const id of list) {
      idSet.add(Number(id))
    }
  }
  const tokenIds = Array.from(idSet).sort((a, b) => a - b)
  console.log(`Unique token IDs from ownership: ${tokenIds.length}`)

  const perTokenAttrs = await mapPool(tokenIds, 16, async (id) => {
    try {
      const tokenUri = (await client.readContract({
        address: GIMBOZ_NFT,
        abi: erc721Abi,
        functionName: 'tokenURI',
        args: [BigInt(id)],
      })) as string

      const json = await fetchMetadataJson(tokenUri)
      const attrs = normalizeAttributes(json)
      return { id, attrs, ok: true as const }
    } catch (e) {
      console.warn(`  token ${id}: ${e instanceof Error ? e.message : e}`)
      return { id, attrs: [] as StoredAttr[], ok: false as const }
    }
  })

  const freq = new Map<string, number>()
  for (const row of perTokenAttrs) {
    for (const a of row.attrs) {
      freq.set(traitKey(a), (freq.get(traitKey(a)) || 0) + 1)
    }
  }

  const byId: Record<
    string,
    { attrs: StoredAttr[]; traitCount: number; rarity: number }
  > = {}

  for (const row of perTokenAttrs) {
    const counted = row.attrs.filter(isCountedTrait)
    let rarity = 0
    for (const a of row.attrs) {
      const c = freq.get(traitKey(a)) || 1
      rarity += 1 / c
    }
    byId[String(row.id)] = {
      attrs: row.attrs,
      traitCount: counted.length,
      rarity: Math.round(rarity * 1e6) / 1e6,
    }
  }

  mkdirSync(publicDir, { recursive: true })
  const out = {
    byId,
    builtAt: new Date().toISOString(),
  }
  writeFileSync(join(publicDir, 'gimboz-metadata.json'), JSON.stringify(out))
  console.log(`Wrote gimboz-metadata.json (${Object.keys(byId).length} tokens)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
