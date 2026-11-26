'use client'

import Link from 'next/link'
import { Building2, Mail, Settings as SettingsIcon, User as UserIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { routes } from '@/config/routes'
import { getPrimaryRole, getRoleBadgeClass, ROLE_CONFIGS, type UserRole } from '@/lib/roleUtils'
import { useAuthStore } from '@/store/authStore'

/**
 * Shared settings view used by /owner/settings, /manager/settings and the
 * legacy /dashboard/settings route. Reads the live user from the auth store —
 * no placeholder data.
 */
export function SettingsView() {
  const user = useAuthStore((state) => state.user)
  const role = getPrimaryRole(user)
  const subscriptionHref = role === 'owner' ? routes.ownerSubscription : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <SettingsIcon className="h-8 w-8" aria-hidden="true" />
          Settings
        </h1>
        <p className="text-muted-foreground">Your account, organization and access details.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" aria-hidden="true" />
              Profile
            </CardTitle>
            <CardDescription>
              Signed in as {ROLE_CONFIGS[role].label.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Full name</span>
              <span className="font-medium">{user?.fullName ?? '—'}</span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="flex items-center gap-2 font-medium">
                <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {user?.email ?? '—'}
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant="secondary" className={getRoleBadgeClass(role)}>
                {ROLE_CONFIGS[role].label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" aria-hidden="true" />
                Organization
              </CardTitle>
              <CardDescription>Restaurant group this account belongs to</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="font-medium">{user?.organizationName ?? '—'}</span>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Slug</span>
                <span className="font-mono text-sm">{user?.organizationSlug ?? '—'}</span>
              </div>
              {subscriptionHref && (
                <>
                  <Separator />
                  <Button variant="outline" className="w-full" render={<Link href={subscriptionHref} />}>
                    Manage subscription
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access</CardTitle>
              <CardDescription>Active role assignments across outlets</CardDescription>
            </CardHeader>
            <CardContent>
              {user?.assignments.length ? (
                <ul className="space-y-3">
                  {user.assignments.map((assignment) => (
                    <li
                      key={`${assignment.role}-${assignment.outletId ?? 'organization'}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{assignment.outletName ?? 'All outlets'}</span>
                        <span className="text-xs text-muted-foreground">
                          {assignment.outletId ? 'Outlet access' : 'Organization-wide access'}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={getRoleBadgeClass(assignment.role as UserRole)}
                      >
                        {assignment.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No role assignments found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
