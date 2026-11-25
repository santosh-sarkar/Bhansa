'use client'

import Link from 'next/link'
import {
  BarChart3,
  Building2,
  ChefHat,
  ClipboardList,
  CreditCard,
  Package,
  Users,
  Utensils,
} from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import { routes } from '@/config/routes'

const modules = [
  { name: 'Menu', href: routes.menu, icon: Utensils, permission: 'menu.edit', description: 'Categories, items and prices' },
  { name: 'Tables', href: routes.tables, icon: Building2, permission: 'tables.manage', description: 'Dining tables and QR codes' },
  { name: 'Staff', href: routes.staff, icon: Users, permission: 'staff.manage', description: 'Invitations, roles and outlets' },
  { name: 'Orders', href: routes.orders, icon: ClipboardList, permission: 'order.manage', description: 'Live orders and confirmations' },
  { name: 'Kitchen', href: routes.kitchen, icon: ChefHat, permission: 'order.update_status', description: 'Preparation board' },
  { name: 'Inventory', href: routes.inventory, icon: Package, permission: 'inventory.manage', description: 'Stock, recipes and wastage' },
  { name: 'Billing', href: routes.billing, icon: CreditCard, permission: 'payment.record', description: 'Bills, payments and eSewa' },
  { name: 'Analytics', href: routes.analytics, icon: BarChart3, permission: 'analytics.view', description: 'Revenue and menu performance' },
]

export default function DashboardPage() {
  const { user, hasPermission, getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()
  const outletName = user?.assignments.find((a) => a.outletId === outletId)?.outletName

  const visibleModules = modules.filter((item) => hasPermission(item.permission))
  const firstName = user?.fullName?.split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">
          {firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        </h1>
        <p className="text-muted-foreground">
          {outletName ? `Managing ${outletName}.` : 'Select an outlet from the header to get started.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleModules.map((item) => (
          <Link key={item.name} href={item.href} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <item.icon className="size-5 text-primary" aria-hidden="true" />
                <CardTitle>{item.name}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
