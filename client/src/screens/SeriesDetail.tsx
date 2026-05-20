import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { contentService } from '@/services/content'
import { ChevronLeft } from 'lucide-react'

export default function SeriesDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['series', id],
    queryFn: () => contentService.getSeriesById(id),
    enabled: !!id,
  })

  const series = data?.series

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <span style={{ color: 'var(--accent)', fontSize: 32 }}>◈</span>
      </div>
    )
  }

  if (!series) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>
        Series not found.
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ position: 'relative' }}>
        <img
          src={series.poster_url || '/assets/posters/image-11.jpg'}
          alt={series.title}
          style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
        />
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute',
            top: 16,
            left: 12,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            border: 'none',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6, fontFamily: "'Fraunces', serif" }}>
          {series.title}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          {[series.genre, series.age_rating].filter(Boolean).join(' · ')}
        </p>
        {series.description && (
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 20 }}>
            {series.description}
          </p>
        )}

        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Episodes
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {series.episodes?.map(ep => (
            <div
              key={ep.id}
              onClick={() => navigate(`/player/${ep.id}?series=${series.id}`)}
              style={{
                padding: '14px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
            >
              <span style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}>
                {ep.episode_number}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>{ep.title}</span>
              {ep.is_free ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80' }}>FREE</span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--token-gold)' }}>
                  ◈ {ep.soul_cost}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
