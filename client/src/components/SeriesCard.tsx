import { useNavigate } from 'react-router-dom'
import type { Series } from '@/services/content'

const FALLBACK = '/assets/posters/image-11.jpg'

export default function SeriesCard({ series }: { series: Series }) {
  const navigate = useNavigate()
  const poster = series.poster_url || FALLBACK

  return (
    <div style={s.card} onClick={() => navigate(`/series/${series.id}`)}>
      <div style={s.thumb}>
        <img src={poster} alt={series.title} style={s.img} />
        {series.is_featured && <span style={s.featBadge}>Featured</span>}
      </div>
      <p style={s.title}>{series.title}</p>
      {series.genre && <p style={s.genre}>{series.genre}</p>}
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
    transition: 'transform 0.2s',
  },
  featBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    background: 'var(--accent)',
    color: '#fff',
    padding: '3px 7px',
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
  },
}
