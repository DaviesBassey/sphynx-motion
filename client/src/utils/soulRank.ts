const RANKS = [
  { min: 5000, label: '✦ Soul Master',  next: null,  nextMin: null },
  { min: 2000, label: '✦ Deep Watcher', next: '✦ Soul Master',  nextMin: 5000 },
  { min: 500,  label: '✦ Echo Seeker',  next: '✦ Deep Watcher', nextMin: 2000 },
  { min: 0,    label: '✦ New Soul',      next: '✦ Echo Seeker',  nextMin: 500 },
] as const

export function soulRank(soul: number): string {
  return (RANKS.find(r => soul >= r.min) ?? RANKS[RANKS.length - 1]).label
}

export function soulRankProgress(soul: number): {
  current: string
  next: string | null
  progress: number  // 0-1
  needed: number | null
} {
  const rank = RANKS.find(r => soul >= r.min) ?? RANKS[RANKS.length - 1]
  if (!rank.next || rank.nextMin === null) {
    return { current: rank.label, next: null, progress: 1, needed: null }
  }
  const floor = rank.min
  const ceil  = rank.nextMin
  const progress = Math.min(1, (soul - floor) / (ceil - floor))
  return { current: rank.label, next: rank.next, progress, needed: ceil - soul }
}
