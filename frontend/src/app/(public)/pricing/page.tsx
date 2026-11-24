import { Metadata } from 'next'
import { routes } from '@/config/routes'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckIcon, XIcon, ChefHat, Users, CreditCard, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for restaurants of all sizes. Start free, scale as you grow.',
}

const plans = [
  {
    name: 'Trial',
    description: 'Full access to explore all features',
    price: 'Rs 0',
    period: '/14 days',
    features: [
      { text: 'Up to 1 outlet', included: true },
      { text: 'Up to 10 staff', included: true },
      { text: 'Up to 100 menu items', included: true },
      { text: 'QR ordering & kitchen display', included: true },
      { text: 'Inventory & recipe management', included: true },
      { text: 'Cash payments', included: true },
      { text: 'eSewa payments', included: true },
      { text: 'Basic analytics', included: true },
      { text: 'Multi-outlet support', included: false },
      { text: 'Advanced analytics', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Start Free Trial',
    variant: 'outline' as const,
    popular: false,
  },
  {
    name: 'Single Outlet',
    description: 'Perfect for independent restaurants',
    price: 'Rs 2,999',
    period: '/month',
    features: [
      { text: '1 outlet included', included: true },
      { text: 'Up to 20 staff', included: true },
      { text: 'Up to 500 menu items', included: true },
      { text: 'QR ordering & kitchen display', included: true },
      { text: 'Inventory & recipe management', included: true },
      { text: 'Cash payments', included: true },
      { text: 'eSewa payments', included: true },
      { text: 'Full analytics dashboard', included: true },
      { text: 'Multi-outlet support', included: false },
      { text: 'Advanced analytics', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Get Started',
    variant: 'default' as const,
    popular: true,
  },
  {
    name: 'Multi-Outlet',
    description: 'For restaurant groups & chains',
    price: 'Custom',
    period: '',
    features: [
      { text: 'Unlimited outlets', included: true },
      { text: 'Unlimited staff', included: true },
      { text: 'Unlimited menu items', included: true },
      { text: 'QR ordering & kitchen display', included: true },
      { text: 'Inventory & recipe management', included: true },
      { text: 'Cash payments', included: true },
      { text: 'eSewa payments', included: true },
      { text: 'Full analytics dashboard', included: true },
      { text: 'Multi-outlet support', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Contact Sales',
    variant: 'outline' as const,
    popular: false,
  },
]

const faqs = [
  {
    question: 'What happens after the 14-day trial?',
    answer: 'You can upgrade to a paid plan. If you don\'t, your account enters a 7-day read-only grace period, then is suspended. Your data is preserved for 90 days.',
  },
  {
    question: 'Can I switch plans later?',
    answer: 'Yes, you can upgrade or downgrade at any time. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle.',
  },
  {
    question: 'Is there a setup fee?',
    answer: 'No. There are no setup fees, no hidden charges, and no long-term contracts. You pay month-to-month.',
  },
  {
    question: 'Do you offer discounts for annual billing?',
    answer: 'Yes, annual billing comes with a 20% discount. Contact sales for multi-outlet custom pricing.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept credit/debit cards, bank transfers, and eSewa for subscription payments.',
  },
  {
    question: 'Can I add more outlets to the Single Outlet plan?',
    answer: 'The Single Outlet plan is limited to 1 outlet. For multiple outlets, you\'ll need the Multi-Outlet plan. Contact sales for a custom quote.',
  },
]

export default function PricingPage() {
  return (
    <div className="flex-1">
      {/* Hero */}
      <section className="py-20 md:py-28 text-center">
        <div className="container mx-auto px-4 max-w-3xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            Transparent pricing, no surprises
          </span>
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
            Simple pricing for{' '}
            <span className="text-primary">every restaurant</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            Start with a 14-day free trial. No credit card required. Upgrade when you&apos;re ready.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16" aria-labelledby="plans-heading">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  'relative flex flex-col',
                  plan.popular && 'border-primary shadow-lg shadow-primary/10'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-muted-foreground text-sm mt-1">{plan.description}</p>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="font-heading text-4xl font-bold text-foreground">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3" role="list">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        {feature.included ? (
                          <CheckIcon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                        ) : (
                          <XIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                        )}
                        <span className={cn('text-sm', feature.included ? 'text-foreground' : 'text-muted-foreground line-through')}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-4">
                  <Link href={plan.name === 'Multi-Outlet' ? '#' : routes.register}>
                    <Button
                      className="w-full"
                      variant={plan.variant}
                      size="lg"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What's included in all plans */}
      <section className="py-16 bg-muted/30 border-y border-border" aria-labelledby="included-heading">
        <div className="container mx-auto px-4">
          <h2 id="included-heading" className="font-heading text-3xl font-bold text-center text-foreground mb-12">
            Included in every plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="text-center p-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <ChefHat className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-lg mb-2">QR Ordering</h3>
              <p className="text-sm text-muted-foreground">Mobile-first guest ordering with real-time menu sync</p>
            </div>
            <div className="text-center p-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <Users className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Staff Roles</h3>
              <p className="text-sm text-muted-foreground">Owner, Manager, Waiter, Kitchen — each with precise permissions</p>
            </div>
            <div className="text-center p-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <CreditCard className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Payments</h3>
              <p className="text-sm text-muted-foreground">Cash + eSewa with automatic bill generation</p>
            </div>
            <div className="text-center p-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <BarChart3 className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Analytics</h3>
              <p className="text-sm text-muted-foreground">Revenue, top items, peak hours, inventory reports</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20" aria-labelledby="faq-heading">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 id="faq-heading" className="font-heading text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
            Frequently asked questions
          </h2>
          <dl className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                <dt className="px-6 py-4 font-medium text-foreground bg-muted/30">
                  {faq.question}
                </dt>
                <dd className="px-6 py-4 text-muted-foreground">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground" aria-labelledby="cta-heading">
        <div className="container mx-auto px-4 text-center">
          <h2 id="cta-heading" className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Ready to get started?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl mx-auto">
            Start your 14-day free trial today. No credit card required. Full access to all features.
          </p>
          <Link href={routes.register}>
            <Button size="lg" variant="secondary" className="gap-2">
              Start Free Trial
              <ChefHat className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <p className="mt-4 text-sm text-primary-foreground/60">
            Questions? <Button variant="ghost" size="sm" className="text-primary-foreground/60 hover:text-primary-foreground p-0 h-auto">Contact sales</Button>
          </p>
        </div>
      </section>
    </div>
  )
}