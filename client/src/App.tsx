import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { queryClient } from '@/lib/queryClient'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'
import Login from '@/screens/Login'
import Signup from '@/screens/Signup'
import Home from '@/screens/Home'
import Browse from '@/screens/Browse'
import Wallet from '@/screens/Wallet'
import Profile from '@/screens/Profile'
import SeriesDetail from '@/screens/SeriesDetail'

// Lazy — loads hls.js only when a user navigates to the player
const Player = lazy(() => import('@/screens/Player'))

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell><Home /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/browse"
              element={
                <ProtectedRoute>
                  <AppShell><Browse /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <AppShell><Wallet /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AppShell><Profile /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/series/:id"
              element={
                <ProtectedRoute>
                  <AppShell><SeriesDetail /></AppShell>
                </ProtectedRoute>
              }
            />

            {/* Player — full screen, no shell, lazy-loaded */}
            <Route
              path="/player/:episodeId"
              element={
                <ProtectedRoute>
                  <Suspense fallback={
                    <div style={{ background: '#000', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#E61E24', fontSize: 36 }}>◈</span>
                    </div>
                  }>
                    <Player />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
