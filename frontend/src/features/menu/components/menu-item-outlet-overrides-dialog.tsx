'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Building2, DollarSign, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchOutlets, type Outlet } from '@/features/outlet/services/outlet.api'
import { fetchOutletOverrides, updateOutletOverrides, type MenuItemOutletOverride, type OutletOverrideInput } from '@/features/menu/services/menu.api'

interface MenuItemOutletOverridesDialogProps {
  menuItemId: string
  menuItemName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function MenuItemOutletOverridesDialog({
  menuItemId,
  menuItemName,
  open,
  onOpenChange,
  onSuccess,
}: MenuItemOutletOverridesDialogProps) {
  const queryClient = useQueryClient()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [overrides, setOverrides] = useState<MenuItemOutletOverride[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load outlets and existing overrides
  useEffect(() => {
    if (!open) return

    setIsLoading(true)
    setError(null)

    Promise.all([
      fetchOutlets({ limit: 100, isActive: true }),
      fetchOutletOverrides(menuItemId),
    ])
      .then(([outletsRes, overridesRes]) => {
        setOutlets(outletsRes.data)
        setOverrides(overridesRes)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setIsLoading(false)
      })
  }, [open, menuItemId])

  // Prepare override data for submission
  const getOverrideForOutlet = (outletId: string) => {
    return overrides.find(o => o.outletId === outletId)
  }

  const createOverride = (outletId: string, partial: Partial<MenuItemOutletOverride>): MenuItemOutletOverride => ({
    id: `temp-${outletId}`,
    menuItemId,
    outletId,
    outletName: '',
    priceOverride: null,
    isAvailable: null,
    autoUnavailable: null,
    displayOrder: 0,
    ...partial,
  })

  const handlePriceChange = (outletId: string, value: string) => {
    setOverrides(prev => {
      const existing = prev.find(o => o.outletId === outletId)
      const numValue = value === '' ? null : parseFloat(value)
      if (existing) {
        return prev.map(o =>
          o.outletId === outletId ? { ...o, priceOverride: numValue } : o
        )
      }
      return [...prev, createOverride(outletId, { priceOverride: numValue, isAvailable: true, autoUnavailable: false })]
    })
  }

  const handleAvailabilityChange = (outletId: string, checked: boolean) => {
    setOverrides(prev => {
      const existing = prev.find(o => o.outletId === outletId)
      if (existing) {
        return prev.map(o =>
          o.outletId === outletId ? { ...o, isAvailable: checked } : o
        )
      }
      return [...prev, createOverride(outletId, { priceOverride: null, isAvailable: checked, autoUnavailable: false })]
    })
  }

  const handleAutoUnavailableChange = (outletId: string, checked: boolean) => {
    setOverrides(prev => {
      const existing = prev.find(o => o.outletId === outletId)
      if (existing) {
        return prev.map(o =>
          o.outletId === outletId ? { ...o, autoUnavailable: checked } : o
        )
      }
      return [...prev, createOverride(outletId, { priceOverride: null, isAvailable: true, autoUnavailable: checked })]
    })
  }

  const mutation = useMutation({
    mutationFn: (data: { overrides: OutletOverrideInput[] }) => updateOutletOverrides(menuItemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'item', menuItemId] })
      onSuccess()
      onOpenChange(false)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = () => {
    const overrideData: OutletOverrideInput[] = outlets.map(outlet => {
      const override = getOverrideForOutlet(outlet.id)
      return {
        outletId: outlet.id,
        priceOverride: override?.priceOverride ?? null,
        isAvailable: override?.isAvailable ?? true,
        autoUnavailable: override?.autoUnavailable ?? false,
      }
    })

    mutation.mutate({ overrides: overrideData })
  }

  const hasAnyOverrides = overrides.some(o =>
    o.priceOverride !== null || o.isAvailable === false || o.autoUnavailable === true
  )

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Outlet Overrides for {menuItemName}</DialogTitle>
          <DialogDescription>
            Set outlet-specific prices and availability. Leave price empty to use the base price.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : outlets.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No active outlets available.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Outlet</TableHead>
                    <TableHead className="w-[120px]">Price Override</TableHead>
                    <TableHead className="w-[100px]">Available</TableHead>
                    <TableHead className="w-[140px]">Auto Unavailable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outlets.map(outlet => {
                    const override = getOverrideForOutlet(outlet.id)
                    return (
                      <TableRow key={outlet.id}>
                        <TableCell>
                          <div>
                            <span className={cn('font-medium', !outlet.isActive && 'text-muted-foreground')}>
                              {outlet.name}
                            </span>
                            {!outlet.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Base price"
                              value={override?.priceOverride !== null && override?.priceOverride !== undefined
                                ? override.priceOverride.toString()
                                : ''}
                              onChange={e => handlePriceChange(outlet.id, e.target.value)}
                              className="pl-8 w-full"
                              disabled={mutation.isPending}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={override?.isAvailable ?? true}
                            onCheckedChange={checked => handleAvailabilityChange(outlet.id, checked)}
                            disabled={mutation.isPending || !outlet.isActive}
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={override?.autoUnavailable ?? false}
                            onCheckedChange={checked => handleAutoUnavailableChange(outlet.id, checked)}
                            disabled={mutation.isPending || !outlet.isActive}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              <strong>Price Override:</strong> Leave empty to use base menu price.{' '}
              <strong>Available:</strong> Toggle to hide/show item in this outlet.{' '}
              <strong>Auto Unavailable:</strong> Automatically hide when stock runs out.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Overrides'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}