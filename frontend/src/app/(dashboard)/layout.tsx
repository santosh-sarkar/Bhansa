'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Bell, Menu, X, LogOut, User, Settings, ChevronRight, Building2, Utensils, Users, BarChart3, CreditCard, Package, ClipboardList, LayoutDashboard, Shield } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { routes } from '@/config/routes'

const navigation = [
  { name: 'Dashboard', href: routes.dashboard, icon: LayoutDashboard, permission: null },
  { name: 'Menu', href: routes.menu, icon: Utensils, permission: 'menu.edit' },
  { name: 'Tables', href: routes.tables, icon: Building2, permission: 'tables.manage' },
  { name: 'Staff', href: routes.staff, icon: Users, permission: 'staff.manage' },
  { name: 'Orders', href: routes.orders, icon: ClipboardList, permission: 'order.manage' },
  { name: 'Kitchen', href: routes.kitchen, icon: Utensils, permission: 'kitchen.manage' },
  { name: 'Inventory', href: routes.inventory, icon: Package, permission: 'inventory.manage' },
  { name: 'Billing', href: routes.billing, icon: CreditCard, permission: 'billing.manage' },
  { name: 'Analytics', href: routes.analytics, icon: BarChart3, permission: 'analytics.view' },
]

function SidebarNavItem({ item, pathname }: { item: typeof navigation[0]; pathname: string }) {
  const isActive = pathname === item.href || (item.href !== routes.dashboard && pathname.startsWith(item.href))
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={<Link href={item.href} />}
      >
        <item.icon className="h-5 w-5" aria-hidden="true" />
        <span>{item.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, hasPermission, logout, getCurrentOutletId } = useAuthStore()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const filteredNavigation = navigation.filter((item) => {
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  const currentOutletId = getCurrentOutletId()

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
        {/* Mobile sidebar toggle */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetTrigger>
            <Button variant="ghost" size="icon" className="lg:hidden fixed top-4 left-4 z-50">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center justify-between px-4 border-b">
                <span className="font-heading text-xl font-bold text-primary">Bansa</span>
                <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(false)}>
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4">
                <SidebarMenu>
                  {filteredNavigation.map((item) => (
                    <SidebarNavItem key={item.name} item={item} pathname={pathname} />
                  ))}
                </SidebarMenu>
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:w-64 flex-col border-r bg-background">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <Link href={routes.dashboard} className="font-heading text-xl font-bold text-primary">
              Bansa
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <SidebarMenu>
              {filteredNavigation.map((item) => (
                <SidebarNavItem key={item.name} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>

            {user?.assignments.some(a => a.role === 'owner' || a.role === 'manager') && (
              <>
                <SidebarSeparator className="my-4" />
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === routes.subscription}
                      render={<Link href={routes.subscription} />}
                    >
                      <Shield className="h-5 w-5" aria-hidden="true" />
                      <span>Subscription</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === routes.settings}
                      render={<Link href={routes.settings} />}
                    >
                      <Settings className="h-5 w-5" aria-hidden="true" />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </>
            )}
          </nav>

          <div className="border-t p-4">
            <p className="text-xs text-muted-foreground text-center">
              v1.0.0
            </p>
          </div>
        </div>
      </SidebarContent>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>

          <div className="flex-1" />

          {/* Outlet switcher */}
          {currentOutletId && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  <span>Outlet {currentOutletId.slice(0, 8)}</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Switch Outlet</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-sm text-muted-foreground">
                  Current: {currentOutletId.slice(0, 8)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Notification bell */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium">
                  3
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm text-muted-foreground">
                No new notifications
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => window.location.href = routes.notifications} className="text-center text-primary cursor-pointer">
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                <Avatar>
                  <AvatarImage src={user?.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}` : ''} alt={user?.fullName ?? 'User'} />
                  <AvatarFallback>{user?.fullName?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="font-medium">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => window.location.href = routes.settings} className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" aria-hidden="true" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.location.href = routes.settings} className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => logout()}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </Sidebar>
      </SidebarProvider>
  )
}