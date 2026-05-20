import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile } from '@/types'

export function useProfile() {
  const { user } = useAuth()

  return useQuery<Profile | null>({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) return null
      return data as Profile
    },
  })
}
