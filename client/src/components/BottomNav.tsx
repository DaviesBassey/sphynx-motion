import { NavLink } from 'react-router-dom'
import { Home, Search, Coins, User } from 'lucide-react'

const tabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/browse', icon: Search, label: 'Browse' },
  { to: '/wallet', icon: Coins, label: 'Wallet' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function BottomNav() {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      background: 'rgba(8,8,10,0.92)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '12px 0',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'color 0.15s',
          })}
        >
          <Icon size={22} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
