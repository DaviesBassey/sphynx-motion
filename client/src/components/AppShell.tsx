import type { ReactNode } from 'react'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <main style={{ flex: 1, paddingBottom: 72, overflowY: 'auto' }}>
        {children}
      </main>
      <BottomNav />
    </>
  )
}
