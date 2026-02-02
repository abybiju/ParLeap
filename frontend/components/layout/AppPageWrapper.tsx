import { cn } from '@/lib/utils'

interface AppPageWrapperProps {
  children: React.ReactNode
  className?: string
}

/**
 * AppPageWrapper Component
 * 
 * Provides consistent spacing for application pages to account for the fixed header.
 * Adds pt-24 (6rem) padding-top to prevent content from being hidden behind the header.
 * 
 * Usage:
 * ```tsx
 * <AppPageWrapper>
 *   <main>Your page content</main>
 * </AppPageWrapper>
 * ```
 */
export function AppPageWrapper({ children, className }: AppPageWrapperProps) {
  return (
    <div className={cn("min-h-screen pt-24", className)}>
      {children}
    </div>
  )
}
