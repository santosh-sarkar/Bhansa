import { Metadata } from 'next'
import { brandConfig } from '@/config/brand'
import { routes } from '@/config/routes'
import Link from 'next/link'

export const metadata: Metadata = {
  title: {
    default: 'Sign in',
    template: `%s | ${brandConfig.name}`,
  },
  description: 'Sign in to your Bansa account',
  robots: 'noindex, nofollow',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href={routes.landing} className="inline-flex items-center gap-2 mb-6">
            <span className="font-heading text-3xl font-bold text-primary">
              {brandConfig.name}
            </span>
          </Link>
        </div>
        <div className="bg-background border border-border rounded-xl p-8">
          {children}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">
          © 2025 {brandConfig.name}. All rights reserved.
        </p>
      </div>
    </div>
  )
}