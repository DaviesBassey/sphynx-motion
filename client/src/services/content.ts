export interface Episode {
  id: string
  title: string
  episode_number: number
  is_free: boolean
  soul_cost: number
  mux_playback_id?: string
  duration?: number
  status?: string
}

export interface Series {
  id: string
  title: string
  slug: string
  genre: string
  age_rating?: string
  poster_url?: string
  trailer_url?: string
  description?: string
  episodes?: Array<{ count?: number }>
  views?: number
  language?: string
  is_featured?: boolean
  is_trending?: boolean
}

export interface SeriesDetail extends Omit<Series, 'episodes'> {
  episodes: Episode[]
}

export interface FeaturedResponse {
  featured: Series[]
  trending: Series[]
}

export interface SeriesListResponse {
  series: Series[]
  total: number
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export const contentService = {
  getFeatured: () => apiFetch<FeaturedResponse>('/api/content/featured'),
  getSeries: (params?: { limit?: number; genre?: string; sort?: string }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.genre) qs.set('genre', params.genre)
    if (params?.sort) qs.set('sort', params.sort)
    const q = qs.toString()
    return apiFetch<SeriesListResponse>(`/api/content/series${q ? `?${q}` : ''}`)
  },
  getSeriesById: (idOrSlug: string) =>
    apiFetch<{ series: SeriesDetail }>(`/api/content/series/${idOrSlug}`),
  getCategories: () =>
    apiFetch<{ categories: Array<{ id: string; name: string; slug: string }> }>('/api/content/categories'),
  getSoulPackages: () =>
    apiFetch<{ packages: Array<{ id: string; amount: number; price_zar: number; sort_order: number }> }>('/api/content/soul-packages'),
}
