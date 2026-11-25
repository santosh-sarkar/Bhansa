'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Check, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { routes } from '@/config/routes'
import { fetchOutlets, setActiveOutlet, type Outlet } from '@/features/outlet/services/outlet.api'
import { formatCurrency } from '@/lib/utils'

export default function SelectOutletPage() {
  const router = useRouter()
  const { user, hasPermission, getCurrentOutletId, getAccessibleOutletIds } = useAuthStore()
  const currentOutletId = getCurrentOutletId()
  const accessibleOutletIds = getAccessibleOutletIds()
  const canManageOutlets = hasPermission('outlets.manage')
  const isOwner = user?.assignments.some(a => a.role === 'owner' && a.isActive)

  const { data: outletsData, isLoading, refetch } = useQuery({
    queryKey: ['outlets', 'list'],
    queryFn: () => fetchOutlets({ limit: 100 }),
    enabled: isOwner || canManageOutlets,
  })

  const handleSelectOutlet = async (outletId: string) => {
    try {
      await setActiveOutlet(outletId)
      router.push(routes.dashboard)
      router.refresh()
    } catch (error) {
      console.error('Failed to select outlet:', error)
    }
  }

  // If user already has an outlet selected, redirect to dashboard
  useEffect(() => {
    if (currentOutletId) {
      router.push(routes.dashboard)
    }
  }, [currentOutletId, router])

  const outlets = outletsData?.data ?? []
  const assignedOutlets = outlets.filter(o => 
    accessibleOutletIds.includes(o.id) || (isOwner && canManageOutlets)
  )

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse space-y-4 max-w-md w-full mx-auto px-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (assignedOutlets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">No Outlets Available</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          You don't have access to any outlets yet. Please contact your administrator to get assigned to an outlet.
        </p>
        <Button variant="outline" onClick={() => router.push('/login')}>
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Select Your Outlet</h1>
          <p className="text-muted-foreground">
            Choose which outlet you'd like to manage. You can switch outlets anytime from the header.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {assignedOutlets.map((outlet) => (
            <Card
              key={outlet.id}
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
              onClick={() => handleSelectOutlet(outlet.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{outlet.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{outlet.address}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{outlet.phone}</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary font-medium">
                    <span>Select</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
                {!outlet.isActive && (
                  <div className="mt-2 px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded border border-yellow-200">
                    This outlet is currently inactive
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {canManageOutlets && (
            <Card className="border-dashed border-2 border-border hover:border-primary/50 transition-colors">
              <CardContent className="flex h-40 items-center justify-center">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full"
                  onClick={() => router.push(routes.outlet)}
                >
                  <Building2 className="h-5 w-5 mr-2" />
                  Manage Outlets
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}