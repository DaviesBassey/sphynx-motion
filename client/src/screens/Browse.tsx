import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { contentService } from '@/services/content'
import SeriesCard from '@/components/SeriesCard'

function useDebounce(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export default function Browse() {
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounced = useDebounce(query)

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: contentService.getCategories,
    staleTime: Infinity,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['browse', debounced, genre],
    queryFn: () => contentService.getSeries({
      limit: 48,
      ...(debounced ? { search: debounced } : {}),
      ...(genre ? { genre } : {}),
    } as Parameters<typeof contentService.getSeries>[0]),
    staleTime: 1000 * 60 * 2,
  })

  const categories = catData?.categories ?? []
  const series = data?.series ?? []

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Search bar */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search series…"
            style={{
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              fontSize: 15,
              padding: '11px 36px 11px 36px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              style={{
                position: 'absolute',
                right: 10,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: 2,
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Genre chips */}
      {categories.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '12px 16px',
          scrollbarWidth: 'none',
        }}>
          <button
            onClick={() => setGenre(null)}
            style={chipStyle(genre === null)}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setGenre(g => g === c.name ? null : c.name)}
              style={chipStyle(genre === c.name)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div style={{ padding: '8px 16px 0' }}>
        {isLoading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{
                aspectRatio: '2/3',
                borderRadius: 8,
                background: '#111114',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.05}s`,
              }} />
            ))}
          </div>
        ) : series.length > 0 ? (
          <>
            {debounced || genre ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                {data?.total ?? series.length} result{(data?.total ?? series.length) !== 1 ? 's' : ''}
              </p>
            ) : null}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {series.map(s => <SeriesCard key={s.id} series={s} />)}
            </div>
          </>
        ) : (
          <div style={{
            paddingTop: 60,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}>
            {debounced ? `No results for "${debounced}"` : 'No series found.'}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input[type=search]::-webkit-search-cancel-button { display: none; }
      `}</style>
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: active ? 'none' : '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  }
}
