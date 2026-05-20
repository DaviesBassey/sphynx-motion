import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { soulRankProgress } from '@/utils/soulRank'
import { contentService } from '@/services/content'

// iOS detection — Stripe checkout must never run inside the native shell
const isIOS = typeof window !== 'undefined' &&
  (window as unknown as { Capacitor?: { getPlatform?: () => string } })
    .Capacitor?.getPlatform?.() === 'ios'

interface Transaction {
  id: string
  type: 'earn' | 'spend' | 'purchase' | 'deduct'
  amount: number
  reason?: string
  created_at: string
}

interface SoulPackage {
  id: string
  amount: number
  price_zar: number
  sort_order: number
}

function fmt(n: number) {
  return n.toLocaleString()
}

function txLabel(tx: Transaction) {
  if (tx.reason) return tx.reason
  switch (tx.type) {
    case 'earn':     return 'Earned'
    case 'spend':    return 'Spent'
    case 'purchase': return 'Purchased'
    case 'deduct':   return 'Deducted'
    default:         return tx.type
  }
}

function txSign(tx: Transaction) {
  return tx.type === 'earn' || tx.type === 'purchase' ? '+' : '−'
}

function txColor(tx: Transaction) {
  return tx.type === 'earn' || tx.type === 'purchase'
    ? 'var(--token-gold)'
    : 'var(--text-muted)'
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Wallet() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  const soul = profile?.soul_balance ?? 0
  const { current, next, progress, needed } = soulRankProgress(soul)

  const { data: pkgData } = useQuery({
    queryKey: ['soul-packages'],
    queryFn: contentService.getSoulPackages,
    staleTime: Infinity,
  })

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('soul_token_transactions')
        .select('id, type, amount, reason, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) return []
      return (data ?? []) as Transaction[]
    },
  })

  const packages: SoulPackage[] = pkgData?.packages ?? []
  const transactions: Transaction[] = txData ?? []

  async function handleTopUp(pkg: SoulPackage) {
    if (isIOS) return
    setPurchaseError(null)
    setPurchasing(pkg.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'soul_tokens', package_id: pkg.id }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Checkout failed')
      window.location.href = json.url
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : 'Something went wrong')
      setPurchasing(null)
    }
  }

  return (
    <div style={{ padding: '24px 16px', paddingBottom: 40 }}>
      {/* Balance hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a0b, #0f0f12)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 20px',
        textAlign: 'center',
        marginBottom: 24,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
          Soul Balance
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 44, fontWeight: 900, color: 'var(--token-gold)', lineHeight: 1 }}>
            {fmt(soul)}
          </span>
          <span style={{ fontSize: 22, color: 'var(--token-gold)', opacity: 0.7 }}>◈</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--token-gold)', fontWeight: 700, marginBottom: 16 }}>
          {current}
        </p>

        {/* Rank progress bar */}
        {next ? (
          <div>
            <div style={{
              height: 4,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 6,
            }}>
              <div style={{
                height: '100%',
                width: `${progress * 100}%`,
                background: 'var(--token-gold)',
                borderRadius: 2,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {fmt(needed!)} ◈ until {next}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--token-gold)', opacity: 0.6 }}>Maximum rank achieved</p>
        )}
      </div>

      {/* Top-up packages */}
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
        Top Up Soul Tokens
      </h2>

      {isIOS ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          textAlign: 'center',
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            To top up Soul Tokens, visit{' '}
            <strong style={{ color: 'var(--text)' }}>sphynxplay.com</strong>{' '}
            in a browser and sign in to your account.
          </p>
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginBottom: 8,
          }}>
            {packages.map(pkg => (
              <button
                key={pkg.id}
                onClick={() => handleTopUp(pkg)}
                disabled={purchasing !== null}
                style={{
                  background: purchasing === pkg.id ? 'var(--bg-surface)' : 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '16px 12px',
                  cursor: purchasing ? 'not-allowed' : 'pointer',
                  opacity: purchasing && purchasing !== pkg.id ? 0.5 : 1,
                  textAlign: 'center',
                  transition: 'opacity 0.15s',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--token-gold)', marginBottom: 2 }}>
                  {fmt(pkg.amount)} ◈
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  {purchasing === pkg.id ? 'Redirecting…' : `R${pkg.price_zar.toFixed(2)}`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  ≈ R{(pkg.price_zar / pkg.amount * 1000).toFixed(2)} / 1k tokens
                </div>
              </button>
            ))}
          </div>
          {purchaseError && (
            <p style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 16, textAlign: 'center' }}>
              {purchaseError}
            </p>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
            Secure checkout · Prices in ZAR
          </p>
        </>
      )}

      {/* Transaction history */}
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
        Recent Activity
      </h2>

      {txLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              height: 52,
              background: '#111114',
              borderRadius: 6,
              marginBottom: 1,
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.07}s`,
            }} />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 20 }}>
          No transactions yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {transactions.map(tx => (
            <div key={tx.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}>
                {tx.type === 'earn' ? '⭐' : tx.type === 'purchase' ? '◈' : tx.type === 'spend' ? '▶' : '−'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 2,
                }}>
                  {txLabel(tx)}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {timeAgo(tx.created_at)}
                </p>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: txColor(tx), flexShrink: 0 }}>
                {txSign(tx)}{fmt(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
