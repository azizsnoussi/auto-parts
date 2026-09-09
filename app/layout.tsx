import type { Metadata } from 'next'
import './globals.css'
import '../styles/globals.css'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Suspense } from 'react'
import React from 'react'

// Dynamically import LoadingSpinner with Suspense
const LoadingSpinner = React.lazy(() => import('@/components/loadingSpinner'))
export const metadata: Metadata = {
  title: 'Bouslama Auto App',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className="flex flex-col min-h-screen">
        {/* Header visible on all pages */}
        <SiteHeader />
        
        {/* Suspense wrapper for loading spinner */}
        <Suspense fallback={<div>Loading...</div>}>
          {/* Main content with loading spinner */}
          <main className="flex-1 container mx-auto p-6">
            <React.Suspense fallback={<LoadingSpinner />}>
              {children}
            </React.Suspense>
          </main>
        </Suspense>
        
        {/* Footer visible on all pages */}
        <SiteFooter />
      </body>
    </html>
  )
}
