import { Metadata } from 'next'
import { brandConfig } from '@/config/brand'
import { routes } from '@/config/routes'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckIcon, ChefHat, CreditCard, Smartphone, Users, Truck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Restaurant OS - Orders, Inventory & Payments',
  description: 'Streamline your restaurant operations with Bansa. QR ordering, real-time kitchen display, inventory management, and integrated payments.',
}

const features = [
  {
    icon: Smartphone,
    title: 'QR Code Ordering',
    description: 'Guests scan, browse menu, and order from their phones. No app download required.',
  },
  {
    icon: ChefHat,
    title: 'Kitchen Display System',
    description: 'Real-time order tickets with timers, status updates, and priority management.',
  },
  {
    icon: Users,
    title: 'Staff Management',
    description: 'Role-based access for waiters, kitchen, managers, and owners across multiple outlets.',
  },
  {
    icon: CreditCard,
    title: 'Integrated Payments',
    description: 'Cash and eSewa payments with automatic bill generation and receipt printing.',
  },
  {
    icon: Truck,
    title: 'Inventory & Recipes',
    description: 'Auto-deduction on order confirmation, low-stock alerts, wastage tracking, and recipe costing.',
  },
  {
    icon: CheckIcon,
    title: 'Analytics Dashboard',
    description: 'Revenue, top items, peak hours, and multi-outlet consolidated reports.',
  },
]

const stats = [
  { value: '14', label: 'Day Free Trial' },
  { value: '0', label: 'Setup Fees' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '24/7', label: 'Support' },
]

export default function LandingPage() {
  return (
    <div className="flex-1">
      {/* Hero Section */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Now accepting early access restaurants
            </span>
            <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-6">
              Restaurant OS that{' '}
              <span className="text-primary">just works</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              {brandConfig.description} QR ordering, kitchen display, inventory, payments — all in one platform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href={routes.register}>
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  Start Free Trial
                  <ChefHat className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href={routes.pricing}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  View Pricing
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                No credit card required
              </span>
              <span className="flex items-center gap-1">
                <CheckIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                14-day full access trial
              </span>
              <span className="flex items-center gap-1">
                <CheckIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-heading text-4xl md:text-5xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24" aria-labelledby="features-heading">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 id="features-heading" className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to run your restaurant
            </h2>
            <p className="text-muted-foreground text-lg">
              From the front of house to the kitchen, Bansa covers every workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="h-full border-border/50 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                    <feature.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-muted/30" aria-labelledby="how-it-works-heading">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 id="how-it-works-heading" className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              Get running in minutes, not weeks
            </h2>
            <p className="text-muted-foreground text-lg">
              No hardware to install. No complex setup. Just sign up and start serving.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="relative">
              <div className="absolute left-1/2 top-0 -translate-x-1/2 w-1 h-full bg-border hidden md:block" />
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mb-4">
                  1
                </div>
                <h3 className="font-heading text-xl font-bold mb-2">Create Account</h3>
                <p className="text-muted-foreground">Sign up, verify email, and your organization with a default outlet is ready.</p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute left-1/2 top-0 -translate-x-1/2 w-1 h-full bg-border hidden md:block" />
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mb-4">
                  2
                </div>
                <h3 className="font-heading text-xl font-bold mb-2">Set Up Menu</h3>
                <p className="text-muted-foreground">Add categories, items, variants, and prices. Upload photos. Set per-outlet overrides.</p>
              </div>
            </div>
            <div className="relative">
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mb-4">
                  3
                </div>
                <h3 className="font-heading text-xl font-bold mb-2">Print QR Codes</h3>
                <p className="text-muted-foreground">Generate table QR codes, print tent cards, and start taking orders immediately.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24" aria-labelledby="cta-heading">
        <div className="container mx-auto px-4 text-center">
          <h2 id="cta-heading" className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to modernize your restaurant?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Join restaurants already using Bansa to streamline operations, reduce errors, and increase revenue.
          </p>
          <Link href={routes.register}>
            <Button size="lg" className="gap-2">
              Start Your Free Trial
              <ChefHat className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required · 14-day full access · Cancel anytime
          </p>
        </div>
      </section>
    </div>
  )
}