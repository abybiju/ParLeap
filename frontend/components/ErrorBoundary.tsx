'use client'

import React from 'react'
import Link from 'next/link'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-[#0a0a0a] text-white">
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-gray-400 mb-6 max-w-md text-center">
            An unexpected error occurred. Please try again or return to the home page.
          </p>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-400 transition-colors"
            >
              Go home
            </Link>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
