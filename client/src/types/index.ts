export interface User {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  soul_balance: number
  is_subscribed: boolean
}

export interface Series {
  id: string
  title: string
  description: string
  thumbnail_url: string
  genre: string
  episodes: Episode[]
  is_premium: boolean
  rating?: number
}

export interface Episode {
  id: string
  series_id: string
  title: string
  episode_number: number
  duration_seconds: number
  mux_playback_id: string
  is_premium: boolean
}

export interface Profile {
  id: string
  display_name: string
  avatar_url?: string
  soul_balance: number
  soul_rank: string
  is_subscribed: boolean
  created_at: string
}
