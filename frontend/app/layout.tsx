import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { ConditionalHeader } from '@/components/layout/ConditionalHeader'
import { CommandProvider } from '@/components/providers/CommandProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ParLeap - AI-Powered Presentation Platform',
  description: 'Real-time AI presentation orchestration platform for live events. AI-powered auto-follow for presentations with zero latency.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'ParLeap - AI-Powered Presentation Platform',
    description: 'Real-time AI presentation orchestration platform for live events',
    images: [
      {
        url: '/logo.png',
        width: 500,
        height: 500,
        alt: 'ParLeap Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ParLeap - AI-Powered Presentation Platform',
    description: 'AI-powered auto-follow for presentations',
    images: ['/logo.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF6B35" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <CommandProvider>
            <ConditionalHeader />
            {children}
            <Toaster richColors position="bottom-right" />
          </CommandProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}

