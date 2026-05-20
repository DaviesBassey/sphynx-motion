import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div style={styles.page}>
      <div style={styles.logo}>◈</div>
      <h1 style={styles.title}>Create account</h1>
      <p style={styles.sub}>Start your journey.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Display name
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoComplete="name"
            style={styles.input}
            placeholder="Your name"
          />
        </label>

        <label style={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={styles.input}
            placeholder="you@example.com"
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
            style={styles.input}
            placeholder="Min. 8 characters"
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" disabled={loading} style={styles.btn}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p style={styles.footer}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--accent)' }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    padding: '0 24px',
    gap: 8,
  },
  logo: {
    fontSize: 48,
    color: 'var(--accent)',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  sub: {
    color: 'var(--text-muted)',
    fontSize: 14,
    marginBottom: 24,
  },
  form: {
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  input: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: 15,
    padding: '12px 14px',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
  },
  error: {
    color: 'var(--accent)',
    fontSize: 13,
    textAlign: 'center',
  },
  btn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 15,
    fontWeight: 700,
    padding: '14px',
    marginTop: 4,
    transition: 'opacity 0.15s',
  },
  footer: {
    marginTop: 16,
    fontSize: 14,
    color: 'var(--text-muted)',
  },
}
