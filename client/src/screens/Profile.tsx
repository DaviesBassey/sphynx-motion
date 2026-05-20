import { useNavigate } from 'react-router-dom'
import { LogOut, ChevronRight, Star, Crown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { soulRank } from '@/utils/soulRank'

function Avatar({ name, url, size = 72 }: { name?: string; url?: string; size?: number }) {
  const initials = (name ?? '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--accent), #7c1114)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: 800,
      color: '#fff',
      letterSpacing: '-0.02em',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 8px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}

function MenuItem({ icon, label, sub, onClick }: {
  icon: React.ReactNode
  label: string
  sub?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '15px 0',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</span>}
      </span>
      {onClick && <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </button>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile()

  const soul = profile?.soul_balance ?? 0
  const rank = soulRank(soul)
  const isSubscribed = profile?.is_subscribed ?? false

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <span style={{ color: 'var(--accent)', fontSize: 32 }}>◈</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px', paddingBottom: 40 }}>
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Avatar name={profile?.display_name ?? user?.email} url={profile?.avatar_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: 20,
            fontWeight: 800,
            color: 'var(--text)',
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {profile?.display_name ?? 'Watcher'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </p>
          <span style={{
            display: 'inline-block',
            marginTop: 6,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: 'var(--token-gold)',
            textTransform: 'uppercase',
          }}>
            {rank}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <StatPill label="Soul Tokens" value={soul.toLocaleString()} />
        <StatPill label="Status" value={isSubscribed ? 'Subscribed' : 'Free'} />
      </div>

      {/* Menu */}
      <div>
        <MenuItem
          icon={<Star size={18} />}
          label="Soul Tokens"
          sub={`${soul.toLocaleString()} ◈ · ${rank}`}
          onClick={() => navigate('/wallet')}
        />
        <MenuItem
          icon={<Crown size={18} />}
          label="Subscription"
          sub={isSubscribed ? 'Active' : 'Upgrade for unlimited access'}
          onClick={() => navigate('/wallet')}
        />
        <MenuItem
          icon={<LogOut size={18} />}
          label="Sign out"
          onClick={handleSignOut}
        />
      </div>
    </div>
  )
}
