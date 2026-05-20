import { useFeatured, useSeriesList } from '@/hooks/useHome'
import HeroBanner from '@/components/HeroBanner'
import TrendingCard from '@/components/TrendingCard'
import SeriesCard from '@/components/SeriesCard'
import type { Series } from '@/services/content'

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 style={{
      fontSize: 16,
      fontWeight: 800,
      color: 'var(--text)',
      letterSpacing: '-0.01em',
      marginBottom: 12,
    }}>
      {title}
    </h2>
  )
}

function HeroSkeleton() {
  return (
    <div style={{
      width: '100%',
      aspectRatio: '9/13',
      maxHeight: 520,
      background: 'linear-gradient(135deg, #111114 0%, #18181C 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <span style={{ color: 'var(--accent)', fontSize: 32 }}>◈</span>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div style={{
      aspectRatio: '2/3',
      borderRadius: 8,
      background: '#111114',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

export default function Home() {
  const { data: featuredData, isLoading: heroLoading } = useFeatured()
  const { data: seriesData, isLoading: seriesLoading } = useSeriesList({ limit: 48 })

  const featured = featuredData?.featured ?? []
  const trending = featuredData?.trending ?? []
  const allSeries = seriesData?.series ?? []

  const hero = featured[0] ?? trending[0] ?? allSeries[0] ?? null
  const trendCards: Series[] = (trending.length ? trending : allSeries).slice(0, 3)

  // Group remaining series by genre
  const byGenre = allSeries.reduce<Record<string, Series[]>>((acc, s) => {
    const g = s.genre || 'Other'
    if (!acc[g]) acc[g] = []
    acc[g].push(s)
    return acc
  }, {})

  return (
    <div style={{ paddingBottom: 16 }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Hero */}
      {heroLoading ? (
        <HeroSkeleton />
      ) : hero ? (
        <HeroBanner series={hero} />
      ) : null}

      {/* Most Trending */}
      {(heroLoading || trendCards.length > 0) && (
        <div style={{ padding: '20px 16px 0' }}>
          <SectionHeader title="Most Trending" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}>
            {heroLoading
              ? Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
              : trendCards.map((s, i) => (
                  <TrendingCard key={s.id} series={s} rank={i + 1} />
                ))
            }
          </div>
        </div>
      )}

      {/* Genre rows */}
      {seriesLoading ? (
        <div style={{ padding: '24px 16px 0' }}>
          <div style={{ height: 20, width: 120, background: '#111114', borderRadius: 4, marginBottom: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      ) : (
        Object.entries(byGenre).map(([genre, list]) => (
          <div key={genre} style={{ padding: '24px 16px 0' }}>
            <SectionHeader title={genre} />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {list.map(s => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Empty state */}
      {!seriesLoading && allSeries.length === 0 && (
        <div style={{
          padding: '60px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 14,
        }}>
          No series published yet.
        </div>
      )}
    </div>
  )
}
