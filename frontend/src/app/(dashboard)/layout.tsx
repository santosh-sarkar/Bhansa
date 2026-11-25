'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup } from '@/components/ui/dropdown-menu'
import { Bell, Menu, X, LogOut, User as UserIcon, Settings, ChevronRight, Building2, Utensils, Users, BarChart3, CreditCard, Package, ClipboardList, LayoutDashboard, Shield, ChefHat, AlertCircle, PanelLeft, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import type { User as AuthUser } from '@/store/authStore'
import { routes } from '@/config/routes'
import { OutletSwitcher } from '@/features/outlet/components/outlet-switcher'
import { NotificationDropdown } from '@/features/notification/components/notification-dropdown'
import { useNotificationSocket } from '@/features/notification/hooks/useNotificationSocket'
import { SkipLink } from '@/components/ui/skip-link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSocketConnectionState } from '@/lib/socket'

const navigation = [
  { name: 'Dashboard', href: routes.dashboard, icon: LayoutDashboard, permission: null },
  { name: 'Menu', href: routes.menu, icon: Utensils, permission: 'menu.edit' },
  { name: 'Tables', href: routes.tables, icon: Building2, permission: 'tables.manage' },
  { name: 'Staff', href: routes.staff, icon: Users, permission: 'staff.manage' },
  { name: 'Orders', href: routes.orders, icon: ClipboardList, permission: 'order.manage' },
  { name: 'Kitchen', href: routes.kitchen, icon: ChefHat, permission: 'order.update_status' },
  { name: 'Inventory', href: routes.inventory, icon: Package, permission: 'inventory.manage' },
  { name: 'Billing', href: routes.billing, icon: CreditCard, permission: 'payment.record' },
  { name: 'Analytics', href: routes.analytics, icon: BarChart3, permission: 'analytics.view' },
  { name: 'Consolidated', href: routes.analyticsConsolidated, icon: BarChart3, permission: null, role: 'owner' },
  { name: 'Subscription', href: routes.subscription, icon: CreditCard, permission: 'billing.manage' },
  { name: 'Super Admin', href: routes.superAdmin, icon: Shield, permission: null, role: 'super_admin' },
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

function OutletRequiredGuard({ children, user, hasPermission, currentOutletId, pathname }: {
  children: React.ReactNode
  user: AuthUser | null
  hasPermission: (permission: string) => boolean
  currentOutletId: string | null
  pathname: string
}) {
  const router = useRouter()
  const canManageOutlets = hasPermission('outlets.manage')
  const hasAssignments = user?.assignments.some((a) => a.isActive && a.outletId) ?? false

  // Redirect to outlet selection if no outlet selected and user can't manage outlets
  useEffect(() => {
    if (!currentOutletId && !canManageOutlets && hasAssignments && pathname !== '/dashboard/select-outlet') {
      router.push('/dashboard/select-outlet')
    }
  }, [currentOutletId, canManageOutlets, hasAssignments, pathname, router])

  // Show outlet selection prompt if no outlet and user has assignments but can't manage
  if (!currentOutletId && !canManageOutlets && hasAssignments) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Alert variant="default" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <div>
              <p className="font-medium">No outlet selected</p>
              <p className="text-sm text-muted-foreground">
                Please select an outlet from the header to access the dashboard.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/dashboard/select-outlet')}
            >
              Select Outlet
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Show setup prompt if no assignments at all
  if (!currentOutletId && !hasAssignments) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Alert variant="default" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <div>
              <p className="font-medium">No outlet assigned</p>
              <p className="text-sm text-muted-foreground">
                You don't have access to any outlets yet. Contact your administrator.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/login')}
            >
              Sign Out
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}

function SidebarHeaderBrand() {
  return (
    <SidebarHeader className="px-4 py-4 border-b">
      <Link href={routes.dashboard} className="font-heading text-xl font-bold text-primary flex items-center gap-2">
        Bansa
      </Link>
    </SidebarHeader>
  )
}

function SidebarFooterVersion() {
  return (
    <SidebarFooter className="border-t p-4">
      <p className="text-xs text-muted-foreground text-center">
        v1.0.0
      </p>
    </SidebarFooter>
  )
}

function SidebarNavigation({ filteredNavigation, pathname }: { filteredNavigation: typeof navigation; pathname: string }) {
  return (
    <nav className="flex-1 overflow-y-auto p-4">
      <SidebarMenu>
        {filteredNavigation.map((item) => (
          <SidebarNavItem key={item.name} item={item} pathname={pathname} />
        ))}
      </SidebarMenu>
    </nav>
  )
}

function SidebarAdminSection({ user, pathname }: { user: AuthUser | null; pathname: string }) {
  const isOwnerOrManager = user?.assignments.some(a => (a.role === 'owner' || a.role === 'manager') && a.isActive)
  
  if (!isOwnerOrManager) return null

  return (
    <>
      <SidebarSeparator className="my-4 mx-4" />
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
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname === routes.outlet}
            render={<Link href={routes.outlet} />}
          >
            <Building2 className="h-5 w-5" aria-hidden="true" />
            <span>Outlets</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}

// Connection status indicator component
function ConnectionStatusIndicator() {
  const connectionState = useSocketConnectionState()
  
  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connected':
        return { icon: Wifi, color: 'text-green-500', label: 'Connected', className: '' }
      case 'connecting':
        return { icon: Loader2, color: 'text-yellow-500 animate-spin', label: 'Connecting...', className: '' }
      case 'reconnecting':
        return { icon: Loader2, color: 'text-yellow-500 animate-spin', label: 'Reconnecting...', className: '' }
      case 'failed':
        return { icon: WifiOff, color: 'text-red-500', label: 'Connection failed', className: '' }
      default:
        return { icon: WifiOff, color: 'text-muted-foreground', label: 'Disconnected', className: '' }
    }
  }

  const { icon: Icon, color, label } = getStatusConfig()

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors" title={label}>
      <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
      <span className="text-xs font-medium text-muted-foreground hidden sm:inline">{label}</span>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, hasPermission, hasRole, logout, getCurrentOutletId } = useAuthStore()
  const currentOutletId = getCurrentOutletId()

  // Initialize notification socket for real-time updates
  useNotificationSocket()

  const filteredNavigation = navigation.filter((item) => {
    if (item.role && !hasRole(item.role)) return false
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  return (
    <SidebarProvider>
      <SkipLink />
      <Sidebar>
        <SidebarContent className="flex flex-col h-full">
          {/* Sidebar header with brand */}
          <SidebarHeaderBrand />
          
          {/* Navigation */}
          <SidebarNavigation filteredNavigation={filteredNavigation} pathname={pathname} />
          
          {/* Admin section for owners/managers */}
          <SidebarAdminSection user={user} pathname={pathname} />
          
          {/* Footer */}
          <SidebarFooterVersion />
        </SidebarContent>

        {/* Main content area */}
        <SidebarInset>
          {/* Top header */}
          <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 lg:px-6">
            {/* Mobile menu trigger */}
            <SidebarTrigger className="lg:hidden" aria-label="Toggle menu" />
            
            <div className="flex-1" />

            {/* Connection status indicator */}
            <ConnectionStatusIndicator />

            {/* Outlet switcher */}
            <OutletSwitcher />

            {/* Notification bell */}
            <NotificationDropdown />

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
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="font-medium">{user?.fullName}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => window.location.href = routes.settings} className="flex items-center gap-2 cursor-pointer">
                  <UserIcon className="h-4 w-4" aria-hidden="true" />
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
          <main id="main-content" className="flex-1 p-4 lg:p-6" tabIndex={-1}>
            <OutletRequiredGuard 
              user={user} 
              hasPermission={hasPermission} 
              currentOutletId={currentOutletId}
              pathname={pathname}
            >
              {children}
            </OutletRequiredGuard>
          </main>
        </SidebarInset>
      </Sidebar>
    </SidebarProvider>
  )
}