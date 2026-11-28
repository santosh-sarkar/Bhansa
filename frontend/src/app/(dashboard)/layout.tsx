'use client'

import { useEffect, useMemo } from 'react'
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
  SidebarTrigger,
  SidebarInset,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup } from '@/components/ui/dropdown-menu'
import { LogOut, User as UserIcon, Settings, Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import type { User as AuthUser } from '@/store/authStore'
import { useAuth } from '@/features/auth/controllers/useAuth'
import { routes } from '@/config/routes'
import { OutletSwitcher } from '@/features/outlet/components/outlet-switcher'
import { NotificationDropdown } from '@/features/notification/components/notification-dropdown'
import { SkipLink } from '@/components/ui/skip-link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useNotificationSocket } from '@/features/notification/hooks/useNotificationSocket'
import { useSocketConnectionState } from '@/lib/socket'
import { getRoleFromPathname, getRoleConfig, ROLE_LAYOUTS, type NavItem } from '@/config/roleLayout'
import { getPrimaryRole, ROLE_CONFIGS } from '@/lib/roleUtils'
import { cn } from '@/lib/utils'

const ROLE_ROUTE_PREFIXES = Object.values(ROLE_LAYOUTS).map(r => r.prefix)

function isRoleRoute(pathname: string): boolean {
  return ROLE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isSelectOutletRoute(pathname: string): boolean {
  return pathname === routes.selectOutlet
}

function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Pick the single best-matching nav item for the current path.
 * Longest href wins so a root route (e.g. `/super-admin`) does not stay
 * highlighted on its children, and nested items (e.g. analytics/consolidated)
 * outrank their parent section.
 */
function getActiveNavHref(nav: NavItem[], pathname: string): string | null {
  let active: string | null = null
  for (const item of nav) {
    if (!isNavItemActive(item.href, pathname)) continue
    if (!active || item.href.length > active.length) active = item.href
  }
  return active
}

function SidebarNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
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

function ConnectionStatusIndicator({ theme }: { theme: 'light' | 'kds' }) {
  const connectionState = useSocketConnectionState()
  
  const getStatusConfig = () => {
    const isKds = theme === 'kds'
    const baseColors = isKds 
      ? { connected: 'text-green-400', connecting: 'text-yellow-400', reconnecting: 'text-yellow-400', failed: 'text-red-400', default: 'text-kds-muted' }
      : { connected: 'text-green-500', connecting: 'text-yellow-500', reconnecting: 'text-yellow-500', failed: 'text-red-500', default: 'text-muted-foreground' }
    
    switch (connectionState) {
      case 'connected':
        return { icon: Wifi, color: baseColors.connected, label: 'Connected' }
      case 'connecting':
        return { icon: Loader2, color: baseColors.connecting, label: 'Connecting...', animate: true }
      case 'reconnecting':
        return { icon: Loader2, color: baseColors.reconnecting, label: 'Reconnecting...', animate: true }
      case 'failed':
        return { icon: WifiOff, color: baseColors.failed, label: 'Connection failed' }
      default:
        return { icon: WifiOff, color: baseColors.default, label: 'Disconnected' }
    }
  }

  const { icon: Icon, color, label, animate } = getStatusConfig()
  const bgClass = theme === 'kds' ? 'bg-kds-surface border-kds-border' : 'bg-muted/50 hover:bg-muted'

  return (
    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md', bgClass, 'transition-colors')} title={label}>
      <Icon className={cn('h-4 w-4', color, animate && 'animate-spin')} aria-hidden="true" />
      <span className={cn('text-xs font-medium', theme === 'kds' ? 'text-kds-foreground' : 'text-muted-foreground', 'hidden sm:inline')}>{label}</span>
    </div>
  )
}

function SidebarHeaderBrand({ brand, theme }: { brand: { label: string; icon: React.ComponentType<{ className?: string }>; href: string }; theme: 'light' | 'kds' }) {
  const Icon = brand.icon
  const textColor = theme === 'kds' ? 'text-kds-foreground' : 'text-primary'
  const borderColor = theme === 'kds' ? 'border-kds-border' : 'border-b'

  return (
    <SidebarHeader className={cn('px-4 py-4', borderColor)}>
      <Link href={brand.href} className={cn('font-heading text-xl font-bold flex items-center gap-2', textColor)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
        {brand.label}
      </Link>
    </SidebarHeader>
  )
}

function SidebarFooterVersion({ theme }: { theme: 'light' | 'kds' }) {
  const textColor = theme === 'kds' ? 'text-kds-muted' : 'text-muted-foreground'
  const borderColor = theme === 'kds' ? 'border-kds-border' : 'border-t'

  return (
    <SidebarFooter className={cn('p-4', borderColor)}>
      <p className={cn('text-xs text-center', textColor)}>
        {theme === 'kds' ? 'KDS v1.0.0' : 'v1.0.0'}
      </p>
    </SidebarFooter>
  )
}

function SidebarNavigation({ filteredNavigation, pathname }: { filteredNavigation: NavItem[]; pathname: string }) {
  const activeHref = getActiveNavHref(filteredNavigation, pathname)
  return (
    <nav className="flex-1 overflow-y-auto p-4">
      <SidebarMenu>
        {filteredNavigation.map((item) => (
          <SidebarNavItem key={item.name} item={item} isActive={item.href === activeHref} />
        ))}
      </SidebarMenu>
    </nav>
  )
}

function OutletRequiredGuard({ children, user, hasPermission, hasRole, currentOutletId, pathname, theme }: {
  children: React.ReactNode
  user: AuthUser | null
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  currentOutletId: string | null
  pathname: string
  theme: 'light' | 'kds'
}) {
  const router = useRouter()
  const isSuperAdmin = hasRole('super_admin')
  const canManageOutlets = hasPermission('outlets.manage')
  const hasAssignments = user?.assignments.some((a) => a.isActive && a.outletId) ?? false
  const textColor = theme === 'kds' ? 'text-kds-foreground' : 'text-foreground'
  const mutedColor = theme === 'kds' ? 'text-kds-muted' : 'text-muted-foreground'

  // Super admins don't need outlet assignment on their routes
  if (isSuperAdmin) {
    return <>{children}</>
  }

  // Redirect to outlet selection if no outlet selected and user can't manage outlets
  useEffect(() => {
    if (!currentOutletId && !canManageOutlets && hasAssignments && !isSelectOutletRoute(pathname)) {
      router.push(routes.selectOutlet)
    }
  }, [currentOutletId, canManageOutlets, hasAssignments, pathname, router])

  // Show outlet selection prompt if no outlet and user has assignments but can't manage
  if (!currentOutletId && !canManageOutlets && hasAssignments && !isSelectOutletRoute(pathname)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Alert variant="default" className={cn('max-w-md', theme === 'kds' ? 'bg-kds-surface border-kds-border' : '')}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className={cn('flex flex-col gap-2', mutedColor)}>
            <div>
              <p className={cn('font-medium', textColor)}>No Outlet Selected</p>
              <p className="text-sm">
                Please select an outlet from the header to access the dashboard.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(routes.selectOutlet)}
            >
              Select Outlet
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Show setup prompt if no assignments at all
  if (!currentOutletId && !hasAssignments && !isSelectOutletRoute(pathname)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Alert variant="default" className={cn('max-w-md', theme === 'kds' ? 'bg-kds-surface border-kds-border' : '')}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className={cn('flex flex-col gap-2', mutedColor)}>
            <div>
              <p className={cn('font-medium', textColor)}>No Outlet Assigned</p>
              <p className="text-sm">
                You don&apos;t have access to any outlets yet. Contact your administrator.
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

function RoleLayout({ user, hasPermission, hasRole, logout, getCurrentOutletId, pathname, roleConfig, children }: {
  user: AuthUser | null
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  logout: () => void
  getCurrentOutletId: () => string | null
  pathname: string
  roleConfig: ReturnType<typeof getRoleConfig>
  children: React.ReactNode
}) {
  const router = useRouter()
  const currentOutletId = getCurrentOutletId()
  const { guard, nav, brand, header, userMenu } = roleConfig
  const isKds = header.theme === 'kds'

  // Verify user has required role (at top level, not conditional)
  useEffect(() => {
    if (!guard(user)) {
      const role = getPrimaryRole(user)
      window.location.href = ROLE_CONFIGS[role].dashboardRoute
    }
  }, [user, guard])

  const filteredNavigation = nav.filter((item) => {
    if (item.role && !hasRole(item.role)) return false
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  const sidebarBg = isKds ? 'bg-kds-background' : 'bg-background'
  const sidebarBorder = isKds ? 'border-kds-border' : 'border-r'
  const insetBg = isKds ? 'bg-kds-background min-h-screen' : 'bg-background'
  const headerBg = isKds ? 'bg-kds-surface/80 backdrop-blur-sm border-kds-border' : 'bg-background/80 backdrop-blur-sm'
  const headerBorder = isKds ? 'border-kds-border' : 'border-b'
  const textColor = isKds ? 'text-kds-foreground' : 'text-foreground'
  const mutedColor = isKds ? 'text-kds-muted' : 'text-muted-foreground'
  const dropdownBg = isKds ? 'bg-kds-surface border-kds-border' : ''
  const dropdownText = isKds ? 'text-kds-foreground' : ''

  return (
    <SidebarProvider>
      <SkipLink />
      <Sidebar className={cn(sidebarBorder, sidebarBg)}>
        <SidebarContent className={cn('flex flex-col h-full', sidebarBg)}>
          {/* Sidebar header with brand */}
          <SidebarHeaderBrand brand={brand} theme={header.theme} />
          
          {/* Navigation */}
          <SidebarNavigation 
            filteredNavigation={filteredNavigation} 
            pathname={pathname} 
          />
          
          {/* Footer */}
          <SidebarFooterVersion theme={header.theme} />
        </SidebarContent>
      </Sidebar>

      {/* Main content area */}
      <SidebarInset className={cn(insetBg, sidebarBorder, 'min-w-0')}>
          {/* Top header */}
          <header className={cn('sticky top-0 z-40 flex h-16 items-center gap-4', headerBg, headerBorder, 'px-4 lg:px-6')}>
            {/* Mobile menu trigger */}
            <SidebarTrigger className="lg:hidden" aria-label="Toggle menu" />
            
            <div className="flex-1" />

            {/* Connection status indicator */}
            {header.showConnectionIndicator && <ConnectionStatusIndicator theme={header.theme} />}

            {/* Outlet switcher */}
            {header.showOutletSwitcher && <OutletSwitcher />}

            {/* Notification bell */}
            <NotificationDropdown />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('relative h-9 w-9 rounded-full', isKds ? 'bg-kds-surface border border-kds-border' : '')}
                    aria-label="Open user menu"
                  />
                }
              >
                <Avatar>
                  <AvatarImage 
                    src={user?.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}` : ''} 
                    alt={user?.fullName ?? 'User'} 
                  />
                  <AvatarFallback className={cn(isKds ? 'bg-kds-muted' : '')}>
                    {user?.fullName?.[0]?.toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={cn('w-56', dropdownBg)}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className={cn('font-medium', textColor)}>{user?.fullName}</p>
                      <p className={cn('text-xs', mutedColor)}>{user?.email}</p>
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', userMenu.roleColor)}>
                        <userMenu.roleIcon className="h-3 w-3" aria-hidden="true" />
                        {userMenu.roleLabel}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className={cn(isKds ? 'border-kds-border' : '')} />
                <DropdownMenuItem onSelect={() => router.push(userMenu.settingsHref)} className={cn('flex items-center gap-2 cursor-pointer', dropdownText)}>
                  <UserIcon className="h-4 w-4" aria-hidden="true" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push(userMenu.settingsHref)} className={cn('flex items-center gap-2 cursor-pointer', dropdownText)}>
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className={cn(isKds ? 'border-kds-border' : '')} />
                <DropdownMenuItem
                  className={cn('text-destructive focus:text-destructive', dropdownText)}
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
              hasRole={hasRole}
              currentOutletId={currentOutletId}
              pathname={pathname}
              theme={header.theme}
            >
              {children}
            </OutletRequiredGuard>
          </main>
        </SidebarInset>
      </SidebarProvider>
    )
  }

function DashboardAuthFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Loading session...</span>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, hasPermission, hasRole, logout, getCurrentOutletId } = useAuthStore()
  const { isAuthenticated, isLoading } = useAuth()

  // Initialize notification socket for this session
  useNotificationSocket()

  // Client-side auth guard (the server middleware can't see the Bearer token)
  useEffect(() => {
    if (isLoading || isAuthenticated) return

    const redirect =
      pathname && pathname !== '/dashboard'
        ? `?redirect=${encodeURIComponent(pathname)}`
        : ''
    router.replace(`/login${redirect}`)
  }, [isLoading, isAuthenticated, pathname, router])

  // Detect role from pathname
  const detectedRole = useMemo(() => getRoleFromPathname(pathname), [pathname])
  const roleConfig = detectedRole ? getRoleConfig(detectedRole) : null

  if (isLoading || !isAuthenticated) {
    return <DashboardAuthFallback />
  }

  // Role routes: render dynamic sidebar + header
  if (isRoleRoute(pathname) && roleConfig) {
    return (
      <RoleLayout
        user={user}
        hasPermission={hasPermission}
        hasRole={hasRole}
        logout={logout}
        getCurrentOutletId={getCurrentOutletId}
        pathname={pathname}
        roleConfig={roleConfig}
      >
        {children}
      </RoleLayout>
    )
  }

  // For select-outlet route, just render children (no sidebar needed)
  if (isSelectOutletRoute(pathname)) {
    return (
      <OutletRequiredGuard
        user={user}
        hasPermission={hasPermission}
        hasRole={hasRole}
        currentOutletId={getCurrentOutletId()}
        pathname={pathname}
        theme="light"
      >
        {children}
      </OutletRequiredGuard>
    )
  }

  // Fallback - shouldn't reach here with current route structure
  return <>{children}</>
}