import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { Canvas } from '@react-three/fiber'
import { Center, OrbitControls, useGLTF } from '@react-three/drei'
import { useCollectionMetadata } from '../hooks/useCollectionMetadata'
import type { GimbozMetadataById } from '../utils/tokenOrdering'

/** Public GLB base path (matches on-chain metadata URLs). */
const FALLBACK_GLB_BASE =
  'https://storage.googleapis.com/gimboz-public/AjhoiwlksdnERUB/3d/glb'

const GIMBOZ_SUPPLY = 4444

function inferGlbBaseFromById(byId: GimbozMetadataById | null): string {
  if (!byId) return FALLBACK_GLB_BASE
  for (const rec of Object.values(byId)) {
    const u = rec?.glb
    if (u) {
      const m = u.match(/^(.*)\/\d+\.glb$/i)
      if (m?.[1]) return m[1]
    }
  }
  return FALLBACK_GLB_BASE
}

function glbUrlForToken(base: string, tokenId: number) {
  return `${base}/${tokenId}.glb`
}

function revokeModelUrl(url: string | null) {
  if (url) useGLTF.clear(url)
}

class GlbErrorBoundary extends Component<
  { children: ReactNode; onError: (msg: string) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info)
    this.props.onError(error.message || 'Failed to load model')
  }

  override render() {
    if (this.state.error) {
      return null
    }
    return this.props.children
  }
}

function GimbozModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return (
    <Center>
      <primitive object={scene.clone(true)} />
    </Center>
  )
}

interface Gimboz3DViewerProps {
  walletTokenIds?: number[]
  getImageUrl?: (tokenId: number) => string
}

export default function Gimboz3DViewer({
  walletTokenIds = [],
  getImageUrl,
}: Gimboz3DViewerProps) {
  const { byId, error: metaError } = useCollectionMetadata()
  const glbBase = useMemo(() => inferGlbBaseFromById(byId), [byId])

  const [idDraft, setIdDraft] = useState('')
  const [glbUrl, setGlbUrl] = useState<string | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [sceneKey, setSceneKey] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      revokeModelUrl(glbUrl)
    }
  }, [glbUrl])

  const loadTokenId = useCallback(
    (n: number) => {
      setActionError(null)
      setModelError(null)
      if (!Number.isFinite(n) || n < 1 || n > GIMBOZ_SUPPLY) {
        setActionError(`Enter a Gimboz ID between 1 and ${GIMBOZ_SUPPLY}.`)
        return false
      }
      const url = glbUrlForToken(glbBase, n)
      setIdDraft(String(n))
      setGlbUrl(prev => {
        if (prev) revokeModelUrl(prev)
        return url
      })
      setLoadedId(String(n))
      setSceneKey(k => k + 1)
      return true
    },
    [glbBase],
  )

  const loadById = useCallback(() => {
    const n = Number.parseInt(idDraft.trim(), 10)
    if (!Number.isFinite(n) || n < 1 || n > GIMBOZ_SUPPLY) {
      setActionError(`Enter a Gimboz ID between 1 and ${GIMBOZ_SUPPLY}.`)
      setModelError(null)
      return
    }
    loadTokenId(n)
  }, [idDraft, loadTokenId])

  const loadRandom = useCallback(() => {
    const pick = 1 + Math.floor(Math.random() * GIMBOZ_SUPPLY)
    loadTokenId(pick)
  }, [loadTokenId])

  const showWalletStrip = walletTokenIds.length > 0 && getImageUrl

  return (
    <div className="space-y-4">
      {showWalletStrip && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5c6568] mb-2">
            Your Gimboz
          </p>
          <div
            className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] -mx-1 px-1"
            role="list"
            aria-label="Gimboz in wallet"
          >
            {walletTokenIds.map(id => {
              const active = loadedId === String(id)
              return (
                <button
                  key={id}
                  type="button"
                  role="listitem"
                  onClick={() => loadTokenId(id)}
                  aria-label={`View Gimboz ${id} in 3D`}
                  aria-pressed={active}
                  className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden ring-2 transition-all
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8EFD09]
                    ${active
                      ? 'ring-[#8EFD09] ring-offset-2 ring-offset-[#161C1F]'
                      : 'ring-[#2a3236] hover:ring-[#6FC50E]/60'
                    }`}
                >
                  <img
                    src={getImageUrl!(id)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[#70736E]">
          <span className="font-semibold uppercase tracking-wider text-[#5c6568]">Gimboz ID</span>
          <input
            type="text"
            inputMode="numeric"
            value={idDraft}
            onChange={e => setIdDraft(e.target.value)}
            placeholder="e.g. 2737"
            className="w-36 rounded-lg border border-[#495151] bg-[#252B2E] px-3 py-2 text-sm text-[#C9D0C0] placeholder-[#70736E] focus:border-[#8EFD09] focus:outline-none focus:ring-1 focus:ring-[#8EFD09]"
          />
        </label>
        <button
          type="button"
          onClick={() => loadById()}
          className="rounded-xl bg-[#6FC50E] px-4 py-2 text-sm font-bold text-[#11171A] hover:bg-[#8EFD09]"
        >
          Load
        </button>
        <button
          type="button"
          onClick={() => loadRandom()}
          className="rounded-xl border border-[#495151] bg-[#252B2E] px-4 py-2 text-sm font-semibold text-[#C9D0C0] hover:border-[#6FC50E]/50"
        >
          Random
        </button>
      </div>

      {metaError && (
        <p className="text-xs text-amber-400/90" role="status">
          Trait sort metadata failed to load (viewer still works): {metaError}
        </p>
      )}
      {actionError && (
        <p className="text-xs text-red-400" role="alert">
          {actionError}
        </p>
      )}
      {modelError && (
        <p className="text-xs text-red-400" role="alert">
          {modelError}
        </p>
      )}

      {loadedId && glbUrl && !modelError && (
        <p className="text-xs text-[#70736E]">
          Showing <span className="font-mono text-[#999A92]">#{loadedId}</span>. Drag to rotate, scroll to zoom.
        </p>
      )}

      <div className="h-[min(420px,55dvh)] w-full min-h-[280px] rounded-xl border border-[#31392C] bg-[#0d1214] overflow-hidden">
        {glbUrl ? (
          <Canvas
            camera={{ position: [0, 0.35, 2.2], fov: 45, near: 0.01, far: 100 }}
            gl={{ alpha: false, antialias: true }}
            dpr={[1, 2]}
          >
            <color attach="background" args={['#0d1214']} />
            <ambientLight intensity={0.65} />
            <directionalLight position={[5, 8, 4]} intensity={1.1} />
            <directionalLight position={[-4, 2, -3]} intensity={0.35} />
            <Suspense
              fallback={
                <mesh>
                  <boxGeometry args={[0.15, 0.15, 0.15]} />
                  <meshStandardMaterial color="#6FC50E" wireframe />
                </mesh>
              }
            >
              <GlbErrorBoundary
                key={sceneKey}
                onError={msg => {
                  setModelError(msg)
                }}
              >
                <GimbozModel url={glbUrl} />
              </GlbErrorBoundary>
            </Suspense>
            <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.4} maxDistance={12} />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[#70736E] px-4 text-center">
            Enter an ID (1–{GIMBOZ_SUPPLY}) and Load, or use Random.
          </div>
        )}
      </div>
    </div>
  )
}
