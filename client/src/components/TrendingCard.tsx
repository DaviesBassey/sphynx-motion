import { useNavigate } from 'react-router-dom'
import type { Series } from '@/services/content'

const FALLBACK = '/assets/posters/image-11.jpg'

function fmtViews(v: number) {
  return v > 999 ? `${(v / 1000).toFixed(1)}K` : String(v)
}

export default function TrendingCard({ series, rank }: { series: Series; rank: number }) {
  const navigate = useNavigate()
  const poster = series.poster_url || FALLBACK

  return (
    <div style={s.card} onClick={() => navigate(`/series/${series.id}`)}>
      <div style={s.thumb}>
        <img src={poster} alt={series.title} style={s.img} />
        <span style={s.rank}>{rank}</span>
        {series.views ? (
          <span style={s.fire}>🔥 {fmtViews(series.views)}</span>
        ) : null}
      </div>
      <p style={s.title}>{series.title}</p>
      <p style={s.genre}>
        {series.genre}
        {series.age_rating && (
          <span style={s.ageBadge}>{series.age_rating}</span>
        )}
      </p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  thumb: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    aspectRatio: '2/3',
    background: '#111',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  rank: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    fontSize: 32,
    fontWeight: 900,
    fontFamily: "'Fraunces', serif",
    color: '#fff',
    lineHeight: 1,
    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
  },
  fire: {
    position: 'absolute',
    top: 6,
    right: 6,
    fontSize: 10,
    fontWeight: 700,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    color: '#fff',
    padding: '3px 6px',
    borderRadius: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  genre: {
    fontSize: 11,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  ageBadge: {
    fontSize: 9,
    fontWeight: 800,
    border: '1px solid var(--text-muted)',
    padding: '1px 4px',
    borderRadius: 3,
    letterSpacing: '0.04em',
  },
}
