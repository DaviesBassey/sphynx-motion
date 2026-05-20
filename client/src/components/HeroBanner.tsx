import { useNavigate } from 'react-router-dom'
import type { Series } from '@/services/content'

const FALLBACK = '/assets/posters/image-11.jpg'

function badge(s: Series) {
  if (s.is_featured) return '▶ Featured Series'
  if (s.is_trending) return '▶ Trending Now'
  return '▶ New Release'
}

function episodeCount(s: Series): number | null {
  const ep = s.episodes?.[0]
  if (!ep) return null
  if ('count' in ep) return ep.count ?? null
  return s.episodes?.length ?? null
}

export default function HeroBanner({ series }: { series: Series }) {
  const navigate = useNavigate()
  const poster = series.poster_url || FALLBACK
  const count = episodeCount(series)
  const meta = [
    count ? `${count} Episode${count !== 1 ? 's' : ''}` : null,
    series.genre,
    series.age_rating,
  ].filter(Boolean).join(' · ')

  return (
    <div style={s.hero} onClick={() => navigate(`/series/${series.id}`)}>
      <img src={poster} alt={series.title} style={s.img} />
      <div style={s.grad} />
      <div style={s.content}>
        <span style={s.badge}>{badge(series)}</span>
        <h1 style={s.title}>{series.title}</h1>
        {series.description && (
          <p style={s.desc}>{series.description}</p>
        )}
        {meta && <p style={s.meta}>{meta}</p>}
        <div style={s.actions}>
          <button
            style={s.playBtn}
            onClick={e => { e.stopPropagation(); navigate(`/series/${series.id}`) }}
          >
            <svg width={11} height={11} viewBox="0 0 24 24" fill="#fff">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            Watch Now
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  hero: {
    position: 'relative',
    width: '100%',
    aspectRatio: '9/13',
    maxHeight: 520,
    overflow: 'hidden',
    cursor: 'pointer',
    background: '#111',
  },
  img: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  grad: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, rgba(8,8,10,0) 30%, rgba(8,8,10,0.85) 70%, #08080A 100%)',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0 16px 24px',
  },
  badge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    marginBottom: 8,
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.15,
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: 'rgba(240,240,242,0.75)',
    lineHeight: 1.5,
    marginBottom: 6,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  meta: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginBottom: 16,
  },
  actions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  playBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 700,
    padding: '10px 20px',
    letterSpacing: '0.02em',
  },
}
