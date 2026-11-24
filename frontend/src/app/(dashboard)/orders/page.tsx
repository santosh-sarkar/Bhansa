'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Plus,
  Check,
  X,
  Truck,
  Package,
  Clock,
  RotateCcw,
  CheckCircle,
  Eye,
  Table as TableIcon,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import {
  fetchTables,
  type Table as TableType,
} from '@/features/table/services/table.api'
import {
  fetchOrders,
  confirmOrder,
  rejectOrder,
  updateOrderStatus,
  createStaffOrder,
  fetchOrder,
  type OrderListItem,
  type OrderDetail,
  type OrderStatus,
  type CreateStaffOrderInput,
} from '@/features/order/services/order.api'
import { useOrderSocket } from '@/features/order/hooks/useOrderSocket'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatCurrency } from '@/lib/utils'

const orderStatusColors: Record<OrderStatus, string> = {
  pending_confirmation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  placed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  served: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const tableStatusColors: Record<string, string> = {
  free: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  occupied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  needs_bill: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
}

const orderStatusLabels: Record<OrderStatus, string> = {
  pending_confirmation: 'Pending',
  placed: 'Placed',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const orderStatusIcons: Record<OrderStatus, React.ReactNode> = {
  pending_confirmation: <Clock className="h-4 w-4" />,
  placed: <Package className="h-4 w-4" />,
  preparing: <RotateCcw className="h-4 w-4 animate-spin" />,
  ready: <CheckCircle className="h-4 w-4" />,
  served: <Truck className="h-4 w-4" />,
  completed: <Check className="h-4 w-4" />,
  cancelled: <X className="h-4 w-4" />,
}

// ===== Schemas =====

const createStaffOrderSchema = z.object({
  tableId: z.string().uuid('Invalid table ID'),
  items: z.array(z.object({
    menuItemId: z.string().uuid('Invalid menu item ID'),
    quantity: z.number().int().positive('Quantity must be positive'),
    options: z.array(z.object({
      optionId: z.string().uuid('Invalid option ID'),
      quantity: z.number().int().positive(),
    })).optional(),
    notes: z.string().max(500).optional(),
  })).min(1, 'At least one item is required'),
  notes: z.string().max(500).optional(),
})

type CreateStaffOrderForm = z.infer<typeof createStaffOrderSchema>

// ===== Helper Components =====

function TablesGrid({ tables, selectedTableId, onSelectTable }: { tables: TableType[]; selectedTableId: string | null; onSelectTable: (id: string | null) => void }) {
  if (tables.length === 0) {
    return (
      <div className="text-center py-12">
        <TableIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No tables yet</h3>
        <p className="text-muted-foreground mb-4">Create tables in the Tables page to start accepting orders.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {tables.map((table) => (
        <Button
          key={table.id}
          variant={selectedTableId === table.id ? 'default' : 'outline'}
          className="h-24 flex flex-col gap-2 p-4"
          onClick={() => onSelectTable(selectedTableId === table.id ? null : table.id)}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{table.label}</span>
            <Badge variant="secondary" className={cn(tableStatusColors[table.status] ?? 'bg-gray-100 text-gray-800')}>
              {table.seats} seats
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className={cn(tableStatusColors[table.status] ?? 'bg-gray-100 text-gray-800')}>
              {table.status.charAt(0).toUpperCase() + table.status.slice(1).replace('_', ' ')}
            </Badge>
            {table.status === 'occupied' && (
              <span className="text-xs text-muted-foreground">Occupied</span>
            )}
          </div>
        </Button>
      ))}
    </div>
  )
}

function PendingConfirmations({ orders, onConfirm, onReject, onViewDetails }: { orders: OrderListItem[]; onConfirm: (id: string) => void; onReject: (id: string) => void; onViewDetails: (id: string) => void }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No pending orders</h3>
        <p className="text-muted-foreground">Guest orders requiring confirmation will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <Card key={order.id} className="border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">Order #{order.orderNumber}</span>
                  <Badge variant="secondary" className={orderStatusColors[order.status]}>
                    {orderStatusIcons[order.status]}
                    {orderStatusLabels[order.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Table: {order.tableLabel ?? 'N/A'} • {formatCurrency(Number(order.totalAmount))}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString()}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => onViewDetails(order.id)}>
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onReject(order.id)}>
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button size="sm" onClick={() => onConfirm(order.id)}>
                  <Check className="h-4 w-4 mr-1" />
                  Confirm
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ActiveOrdersList({ orders, onUpdateStatus, onViewDetails }: { orders: OrderListItem[]; onUpdateStatus: (id: string, status: OrderStatus) => void; onViewDetails: (id: string) => void }) {
  const activeOrders = orders.filter(o => 
    ['placed', 'preparing', 'ready', 'served'].includes(o.status)
  )

  if (activeOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No active orders</h3>
        <p className="text-muted-foreground">Confirmed orders in progress will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activeOrders.map((order) => (
        <Card key={order.id} className="border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">Order #{order.orderNumber}</span>
                  <Badge variant="secondary" className={orderStatusColors[order.status]}>
                    {orderStatusIcons[order.status]}
                    {orderStatusLabels[order.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Table: {order.tableLabel ?? 'N/A'} • {formatCurrency(Number(order.totalAmount))}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString()}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => onViewDetails(order.id)}>
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                {order.status === 'ready' && (
                  <Button size="sm" onClick={() => onUpdateStatus(order.id, 'served')}>
                    <Truck className="h-4 w-4 mr-1" />
                    Serve
                  </Button>
                )}
                {order.status === 'served' && (
                  <Button variant="outline" size="sm" onClick={() => onUpdateStatus(order.id, 'completed')}>
                    <Check className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function OrderDetailDialog({ order, onClose, onConfirm, onReject, onUpdateStatus }: { 
  order: OrderDetail | null
  onClose: () => void
  onConfirm: (id: string) => void
  onReject: (id: string, reason: string) => void
  onUpdateStatus: (id: string, status: OrderStatus) => void
}) {
  const [rejectReason, setRejectReason] = useState('')

  if (!order) return null

  const canConfirm = order.status === 'pending_confirmation'
  const canReject = order.status === 'pending_confirmation'
  const canServe = order.status === 'ready'
  const canComplete = order.status === 'served'

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order #{order.orderNumber}</DialogTitle>
          <DialogDescription>
            Status: <Badge variant="secondary" className={cn(orderStatusColors[order.status], 'ml-2')}>
              {orderStatusIcons[order.status]}
              {orderStatusLabels[order.status]}
            </Badge>
            {order.tableLabel && <span className="ml-4 text-sm text-muted-foreground">Table: {order.tableLabel}</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Order Type</Label>
              <p className="capitalize">{order.orderType.replace('_', ' ')}</p>
            </div>
            <div>
              <Label>Created</Label>
              <p>{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            {order.confirmedAt && (
              <div>
                <Label>Confirmed</Label>
                <p>{new Date(order.confirmedAt).toLocaleString()}</p>
              </div>
            )}
            {order.notes && (
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Items</h4>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.menuItemName}</p>
                  {item.options.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {item.options.map(o => `${o.name} (${o.kind === 'variant' ? '' : '+'})`).join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-muted-foreground italic">{item.notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Status: <Badge variant="secondary" className={cn(orderStatusColors[item.status], 'ml-1')}>
                      {orderStatusLabels[item.status]}
                    </Badge>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono">{formatCurrency(Number(item.lineTotal))}</p>
                  <p className="text-sm text-muted-foreground">x{item.quantity}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t pt-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(Number(order.subtotal))}</p>
              <p className="text-sm text-muted-foreground">Tax: {formatCurrency(Number(order.taxAmount))}</p>
              {Number(order.discountAmount) > 0 && (
                <p className="text-sm text-muted-foreground">Discount: -{formatCurrency(Number(order.discountAmount))}</p>
              )}
              <p className="text-lg font-bold">Total: {formatCurrency(Number(order.totalAmount))}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canConfirm && (
            <Button onClick={() => onConfirm(order.id)} disabled={canConfirm}>
              <Check className="h-4 w-4 mr-1" />
              Confirm Order
            </Button>
          )}
          {canReject && (
            <Button variant="destructive" onClick={() => onReject(order.id, rejectReason)} disabled={!rejectReason}>
              <X className="h-4 w-4 mr-1" />
              Reject Order
            </Button>
          )}
          {canServe && (
            <Button onClick={() => onUpdateStatus(order.id, 'served')}>
              <Truck className="h-4 w-4 mr-1" />
              Serve
            </Button>
          )}
          {canComplete && (
            <Button variant="outline" onClick={() => onUpdateStatus(order.id, 'completed')}>
              <Check className="h-4 w-4 mr-1" />
              Complete
            </Button>
          )}
        </DialogFooter>
        {canReject && (
          <div className="border-t pt-4">
            <Label htmlFor="reject-reason">Rejection Reason</Label>
            <textarea
              id="reject-reason"
              className="mt-1 w-full min-h-[80px] p-2 border border-border rounded-md"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PlaceOrderDialog({ 
  table, 
  onClose, 
  onSubmit 
}: { 
  table: TableType | null
  onClose: () => void
  onSubmit: (data: CreateStaffOrderForm) => void
}) {
  const [menuItems, setMenuItems] = useState<Array<{
    id: string
    name: string
    price: number
    options: Array<{ id: string; name: string; kind: 'variant' | 'addon'; priceDelta: number }>
  }>>([])
  const [isLoadingMenu, setIsLoadingMenu] = useState(false)

  const outletId = useAuthStore.getState().getCurrentOutletId()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateStaffOrderForm>({
    resolver: zodResolver(createStaffOrderSchema),
    defaultValues: {
      tableId: table?.id ?? '',
      items: [],
      notes: '',
    },
  })

  const items = watch('items')

  useEffect(() => {
    if (!outletId) return
    setIsLoadingMenu(true)
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/menu/effective`, {
      credentials: 'include',
      headers: { 'X-Outlet-Id': outletId },
    })
      .then(res => res.json())
      .then((data: { success: boolean; data?: { categories: Array<{ items: Array<{ id: string; name: string; price: number; isActive: boolean; options: Array<{ id: string; name: string; kind: 'variant' | 'addon'; priceDelta: number; isActive: boolean }> }> }> } }) => {
        if (data.success && data.data) {
          const menuItemsData: Array<{ id: string; name: string; price: number; options: Array<{ id: string; name: string; kind: 'variant' | 'addon'; priceDelta: number }> }> = []
          data.data.categories.forEach((cat) => {
            cat.items.forEach((item) => {
              if (item.isActive) {
                menuItemsData.push({
                  id: item.id,
                  name: item.name,
                  price: item.price,
                  options: item.options.filter((o) => o.isActive).map((o) => ({
                    id: o.id,
                    name: o.name,
                    kind: o.kind,
                    priceDelta: o.priceDelta,
                  })),
                })
              }
            })
          })
          setMenuItems(menuItemsData)
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingMenu(false))
  }, [outletId])

  const addItem = (menuItem: typeof menuItems[0]) => {
    const existingIndex = items.findIndex(i => i.menuItemId === menuItem.id)
    if (existingIndex >= 0) {
      const newItems = [...items]
      newItems[existingIndex] = { ...newItems[existingIndex], quantity: newItems[existingIndex].quantity + 1 }
      setValue('items', newItems)
    } else {
      setValue('items', [...items, { menuItemId: menuItem.id, quantity: 1, options: [] }])
    }
  }

  const removeItem = (index: number) => {
    setValue('items', items.filter((_, i) => i !== index))
  }

  const updateItemQuantity = (index: number, delta: number) => {
    const newItems = [...items]
    const newQty = newItems[index].quantity + delta
    if (newQty <= 0) {
      removeItem(index)
    } else {
      newItems[index] = { ...newItems[index], quantity: newQty }
      setValue('items', newItems)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Place Order for Table {table?.label}</DialogTitle>
          <DialogDescription>Select items from the menu</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <Input 
            {...register('notes')} 
            placeholder="Order notes (optional)" 
            className="mb-4"
          />
          
          <div className="grid gap-4 md:grid-cols-3">
            {/* Menu Items */}
            <div className="md:col-span-2 space-y-4 max-h-[50vh] overflow-y-auto">
              {isLoadingMenu ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : menuItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No menu items available</p>
              ) : (
                <div className="space-y-3">
                  {menuItems.map((item) => (
                    <Card key={item.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm font-mono text-primary">{formatCurrency(item.price)}</p>
                          {item.options.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.options.map(o => `${o.name} (+${formatCurrency(o.priceDelta)})`).join(', ')}
                            </p>
                          )}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => addItem(item)}
                          disabled={isLoadingMenu}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Current Order */}
            <div className="border border-border rounded-lg p-4 max-h-[50vh] overflow-y-auto">
              <h4 className="font-medium mb-3">Current Order</h4>
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No items added</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const menuItem = menuItems.find(m => m.id === item.menuItemId)
                    const itemPrice = menuItem?.price ?? 0
                    const optionsTotal = item.options?.reduce((sum, o) => {
                      const opt = menuItems.flatMap(m => m.options).find(opt => opt.id === o.optionId)
                      return sum + (opt?.priceDelta ?? 0) * o.quantity
                    }, 0) ?? 0
                    const lineTotal = (itemPrice + optionsTotal) * item.quantity
                    return (
                      <div key={`${item.menuItemId}-${index}`} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{menuItem?.name ?? 'Unknown'}</p>
                          {item.options?.length && (
                            <p className="text-xs text-muted-foreground">
                              {item.options.map(o => {
                                const opt = menuItems.flatMap(m => m.options).find(opt => opt.id === o.optionId)
                                return `${opt?.name ?? 'Option'} (${o.quantity})`
                              }).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity(index, -1)}>
                            <X className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity(index, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(index)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="font-mono text-sm whitespace-nowrap">{formatCurrency(lineTotal)}</p>
                      </div>
                    )
                  })}
                  <div className="border-t pt-3">
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatCurrency(
                        items.reduce((sum, item) => {
                          const menuItem = menuItems.find(m => m.id === item.menuItemId)
                          const itemPrice = menuItem?.price ?? 0
                          const optionsTotal = item.options?.reduce((s, o) => {
                            const opt = menuItems.flatMap(m => m.options).find(opt => opt.id === o.optionId)
                            return s + (opt?.priceDelta ?? 0) * o.quantity
                          }, 0) ?? 0
                          return sum + (itemPrice + optionsTotal) * item.quantity
                        }, 0)
                      )}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {errors.items && (
            <Alert variant="destructive" className="text-sm">
              <AlertDescription>{errors.items.message}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={undefined} disabled={items.length === 0} onClick={() => {}}>
            <Plus className="h-4 w-4 mr-1" />
            Place Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Main Page Component =====

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const { hasPermission, getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [showPlaceOrderDialog, setShowPlaceOrderDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')

  // Real-time socket connection
  useOrderSocket(outletId ?? undefined)

  // Fetch tables
  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ['tables', outletId],
    queryFn: () => fetchTables(outletId!, { isActive: true }),
    enabled: !!outletId,
  })

  // Fetch orders
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', outletId, statusFilter],
    queryFn: () => fetchOrders({ 
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 100 
    }),
    enabled: !!outletId,
    refetchInterval: 30000,
  })

  const tables = tablesData?.data ?? []
  const orders = ordersData?.data ?? []

  const pendingOrders = orders.filter(o => o.status === 'pending_confirmation')
  const activeOrders = orders.filter(o => ['placed', 'preparing', 'ready', 'served'].includes(o.status))
  const completedOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status))

  // Mutations
  const confirmMutation = useMutation({
    mutationFn: (orderId: string) => confirmOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelectedOrder(null)
    },
    onError: (err: Error) => alert(err.message),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => rejectOrder(orderId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelectedOrder(null)
      setRejectReason('')
    },
    onError: (err: Error) => alert(err.message),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) => updateOrderStatus(orderId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelectedOrder(null)
    },
    onError: (err: Error) => alert(err.message),
  })

  const placeOrderMutation = useMutation({
    mutationFn: (data: CreateStaffOrderInput) => createStaffOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      setShowPlaceOrderDialog(false)
    },
    onError: (err: Error) => alert(err.message),
  })

  const handleConfirm = useCallback((orderId: string) => {
    confirmMutation.mutate(orderId)
  }, [confirmMutation])

  const handleReject = useCallback((orderId: string) => {
    if (!rejectReason) {
      alert('Please enter a rejection reason')
      return
    }
    rejectMutation.mutate({ orderId, reason: rejectReason })
  }, [rejectMutation, rejectReason])

  const handleUpdateStatus = useCallback((orderId: string, status: OrderStatus) => {
    updateStatusMutation.mutate({ orderId, status })
  }, [updateStatusMutation])

  const handleViewOrder = useCallback(async (orderId: string) => {
    try {
      const order = await fetchOrder(orderId)
      setSelectedOrder(order)
    } catch (err) {
      alert('Failed to load order details')
    }
  }, [])

  const handlePlaceOrder = useCallback((data: CreateStaffOrderForm) => {
    placeOrderMutation.mutate(data)
  }, [placeOrderMutation])

  const selectedTable = tables.find(t => t.id === selectedTableId) ?? null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage orders and tables</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetchOrders()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {hasPermission('order.create') && selectedTable && (
            <Button onClick={() => setShowPlaceOrderDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Place Order
            </Button>
          )}
        </div>
      </div>

      {/* Tables Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TableIcon className="h-5 w-5" />
              Tables Overview
            </span>
            {outletId && (
              <Badge variant="secondary" className={cn(
                tables.some(t => t.status === 'occupied') ? 'bg-red-100 text-red-800' :
                tables.some(t => t.status === 'needs_bill') ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              )}>
                {tables.filter(t => t.status === 'occupied').length} Occupied
                {tables.filter(t => t.status === 'needs_bill').length > 0 && (
                  <> • {tables.filter(t => t.status === 'needs_bill').length} Needs Bill</>
                )}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tablesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <TablesGrid 
              tables={tables} 
              selectedTableId={selectedTableId} 
              onSelectTable={setSelectedTableId} 
            />
          )}
        </CardContent>
      </Card>

      {/* Orders Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            <Truck className="h-4 w-4 mr-2" />
            Active ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle className="h-4 w-4 mr-2" />
            Completed ({completedOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingConfirmations
            orders={pendingOrders}
            onConfirm={handleConfirm}
            onReject={(id) => { setRejectReason(''); handleViewOrder(id); }}
            onViewDetails={handleViewOrder}
          />
        </TabsContent>

        <TabsContent value="active">
          <ActiveOrdersList
            orders={activeOrders}
            onUpdateStatus={handleUpdateStatus}
            onViewDetails={handleViewOrder}
          />
        </TabsContent>

        <TabsContent value="completed">
          {completedOrders.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No completed orders</h3>
              <p className="text-muted-foreground">Completed and cancelled orders will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedOrders.map((order) => (
                <Card key={order.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Order #{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          Table: {order.tableLabel ?? 'N/A'} • {formatCurrency(Number(order.totalAmount))}
                        </p>
                      </div>
                      <Badge variant="secondary" className={orderStatusColors[order.status]}>
                        {orderStatusLabels[order.status]}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {hasPermission('order.create') && selectedTable && (
        <PlaceOrderDialog
          table={selectedTable}
          onClose={() => setShowPlaceOrderDialog(false)}
          onSubmit={handlePlaceOrder}
        />
      )}

      <OrderDetailDialog
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onConfirm={handleConfirm}
        onReject={(id, reason) => handleReject(id)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  )
}