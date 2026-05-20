import { useQuery } from '@tanstack/react-query'
import { contentService } from '@/services/content'

export function useFeatured() {
  return useQuery({
    queryKey: ['featured'],
    queryFn: contentService.getFeatured,
    staleTime: 1000 * 60 * 5,
  })
}

export function useSeriesList(params?: { limit?: number; genre?: string; sort?: string }) {
  return useQuery({
    queryKey: ['series', params],
    queryFn: () => contentService.getSeries(params),
    staleTime: 1000 * 60 * 5,
  })
}
