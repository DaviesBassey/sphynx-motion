import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Hls from 'hls.js'
import { ChevronLeft, Play, Pause, Maximize, SkipForward, SkipBack } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { contentService } from '@/services/content'
import type { Episode } from '@/services/content'

type PlayState = 'loading' | 'playing' | 'error-auth' | 'error-soul' | 'error-generic'

function fmtTime(s: number) {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function Player() {
  const { episodeId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const seriesId = searchParams.get('series') ?? undefined
  const navigate = useNavigate()

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef   = useRef<Hls | null>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [state, setState]           = useState<PlayState>('loading')
  const [soulCost, setSoulCost]     = useState<number>(0)
  const [errorMsg, setErrorMsg]     = useState<string>('')
  const [playing, setPlaying]       = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]     = useState(0)
  const [showControls, setShowControls] = useState(true)

  // Series playlist for prev/next navigation
  const [playlist, setPlaylist]     = useState<Episode[]>([])
  const [epIndex, setEpIndex]       = useState(-1)
  const [epLabel, setEpLabel]       = useState('')

  // Load playlist once for navigation
  useEffect(() => {
    if (!seriesId) return
    contentService.getSeriesById(seriesId).then(({ series }) => {
      setPlaylist(series.episodes ?? [])
      const idx = series.episodes?.findIndex(e => e.id === episodeId) ?? -1
      setEpIndex(idx)
    }).catch(() => {})
  }, [seriesId, episodeId])

  const loadVideo = useCallback(async (epId: string) => {
    const video = videoRef.current
    if (!video) return

    setState('loading')
    setPlaying(false)

    // Destroy previous HLS instance
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`/api/content/episodes/${epId}/play`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json() as {
        url?: string; type?: string; error?: string; code?: string; cost?: number
      }

      if (res.status === 401) { setState('error-auth'); return }
      if (res.status === 403) {
        setSoulCost(data.cost ?? 0)
        setState('error-soul')
        return
      }
      if (!res.ok || !data.url) {
        setErrorMsg(data.error ?? 'Could not load video')
        setState('error-generic')
        return
      }

      const { url, type } = data
      const isHls = type === 'hls' || url.includes('.m3u8')
      const nativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== ''

      if (isHls && Hls.isSupported() && !nativeHls) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          abrEwmaDefaultEstimate: 2_000_000,
          startLevel: -1,
        })
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (d.fatal) { setErrorMsg('Stream error'); setState('error-generic') }
        })
        hls.loadSource(url)
        hls.attachMedia(video)
        hlsRef.current = hls
      } else {
        video.src = url
      }

      video.play().catch(() => {})
      setState('playing')
    } catch {
      setErrorMsg('Network error')
      setState('error-generic')
    }
  }, [])

  useEffect(() => {
    if (!episodeId) return
    loadVideo(episodeId)
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    }
  }, [episodeId, loadVideo])

  // Update episode label from playlist
  useEffect(() => {
    if (epIndex >= 0 && playlist[epIndex]) {
      const ep = playlist[epIndex]
      setEpLabel(`E${ep.episode_number}${ep.title ? ` — ${ep.title}` : ''}`)
    }
  }, [epIndex, playlist])

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlay  = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime  = () => setCurrentTime(video.currentTime)
    const onMeta  = () => setDuration(video.duration)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onMeta)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onMeta)
    }
  }, [])

  // Auto-hide controls
  function bumpControls() {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 4000)
  }

  useEffect(() => {
    bumpControls()
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play().catch(() => {}) : v.pause()
    bumpControls()
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Number(e.target.value)
    bumpControls()
  }

  function enterFullscreen() {
    const el = wrapRef.current as HTMLDivElement & { webkitRequestFullscreen?: () => void }
    if (el.requestFullscreen) el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  }

  function gotoEp(idx: number) {
    if (idx < 0 || idx >= playlist.length) return
    setEpIndex(idx)
    const ep = playlist[idx]
    navigate(`/player/${ep.id}${seriesId ? `?series=${seriesId}` : ''}`, { replace: true })
  }

  const hasPrev = epIndex > 0
  const hasNext = epIndex >= 0 && epIndex < playlist.length - 1

  // ── Error states ──
  if (state === 'error-auth') {
    return <ErrorScreen title="Sign in required" sub="Sign in to watch this episode." onBack={() => navigate(-1)} />
  }
  if (state === 'error-soul') {
    return (
      <ErrorScreen
        title="Not enough Soul Tokens"
        sub={`This episode costs ${soulCost} ◈ Soul Tokens. Top up in your Wallet.`}
        onBack={() => navigate(-1)}
        action={{ label: 'Go to Wallet', onPress: () => navigate('/wallet') }}
      />
    )
  }
  if (state === 'error-generic') {
    return <ErrorScreen title="Playback error" sub={errorMsg} onBack={() => navigate(-1)} />
  }

  return (
    <div
      ref={wrapRef}
      onClick={bumpControls}
      style={{ position: 'relative', background: '#000', height: '100dvh', overflow: 'hidden' }}
    >
      {/* Video */}
      <video
        ref={videoRef}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />

      {/* Loading spinner */}
      {state === 'loading' && (
        <div style={overlay}>
          <span style={{ fontSize: 36, color: 'var(--accent)', animation: 'spin 1s linear infinite' }}>◈</span>
        </div>
      )}

      {/* Controls layer */}
      <div style={{
        ...overlay,
        background: showControls
          ? 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.7) 100%)'
          : 'transparent',
        transition: 'opacity 0.25s',
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
      }}>
        {/* Top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={iconBtn}>
            <ChevronLeft size={22} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {epLabel}
            </p>
          </div>
        </div>

        {/* Centre play/pause + prev/next */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
          <button
            onClick={e => { e.stopPropagation(); gotoEp(epIndex - 1) }}
            disabled={!hasPrev}
            style={{ ...iconBtn, opacity: hasPrev ? 1 : 0.3 }}
          >
            <SkipBack size={26} fill="#fff" />
          </button>

          <button onClick={e => { e.stopPropagation(); togglePlay() }} style={{ ...iconBtn, width: 60, height: 60 }}>
            {playing
              ? <Pause size={30} fill="#fff" />
              : <Play  size={30} fill="#fff" />
            }
          </button>

          <button
            onClick={e => { e.stopPropagation(); gotoEp(epIndex + 1) }}
            disabled={!hasNext}
            style={{ ...iconBtn, opacity: hasNext ? 1 : 0.3 }}
          >
            <SkipForward size={26} fill="#fff" />
          </button>
        </div>

        {/* Bottom bar — seekbar + time + fullscreen */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', flexShrink: 0, minWidth: 36 }}>
              {fmtTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={seek}
              onClick={e => e.stopPropagation()}
              style={{ flex: 1, accentColor: 'var(--accent)', height: 3, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', flexShrink: 0, minWidth: 36, textAlign: 'right' }}>
              {fmtTime(duration)}
            </span>
            <button onClick={e => { e.stopPropagation(); enterFullscreen() }} style={iconBtn}>
              <Maximize size={18} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const iconBtn: React.CSSProperties = {
  background: 'rgba(0,0,0,0.35)',
  backdropFilter: 'blur(6px)',
  border: 'none',
  borderRadius: '50%',
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  cursor: 'pointer',
  flexShrink: 0,
}

function ErrorScreen({
  title, sub, onBack, action,
}: {
  title: string
  sub: string
  onBack: () => void
  action?: { label: string; onPress: () => void }
}) {
  return (
    <div style={{ background: '#000', height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <button onClick={onBack} style={{ ...iconBtn, position: 'absolute', top: 20, left: 16 }}>
        <ChevronLeft size={22} />
      </button>
      <span style={{ fontSize: 40, color: 'var(--accent)' }}>◈</span>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', textAlign: 'center' }}>{title}</h2>
      <p  style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.6 }}>{sub}</p>
      {action && (
        <button
          onClick={action.onPress}
          style={{ marginTop: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
