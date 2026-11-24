'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Minus, ShoppingCart, X, Check, Loader2, Heart, HelpCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { routes } from '@/config/routes'
import { fetchGuestMenu, createGuestSession, placeGuestOrder, requestBill, type GuestMenuResponse, type GuestSessionResponse, type CreateOrderInput } from '@/features/menu/services/guest.api'
import { formatCurrency } from '@/lib/utils'

interface CartItem {
  menuItemId: string
  name: string
  price: number
  imageUrl: string | null
  quantity: number
  options: Array<{ optionId: string; name: string; priceDelta: number; quantity: number }>
}

export function GuestMenuPageClient({ initialMenu, qrToken }: { initialMenu: GuestMenuResponse; qrToken: string }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState(initialMenu.categories[0]?.id ?? '')
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize session
  const { data: session, isLoading: sessionLoading } = useQuery<GuestSessionResponse>({
    queryKey: ['guest', 'session', qrToken],
    queryFn: () => createGuestSession(qrToken),
    staleTime: Infinity,
  })

  // Refetch menu for real-time updates
  const { data: menuData } = useQuery({
    queryKey: ['guest', 'menu', qrToken],
    queryFn: () => fetchGuestMenu(qrToken),
    initialData: initialMenu,
    refetchInterval: 30000,
  })

  const menu = menuData ?? initialMenu

  const placeOrderMutation = useMutation({
    mutationFn: (data: CreateOrderInput) => placeGuestOrder(data),
    onSuccess: () => {
      setCart([])
      setOrderSuccess(true)
      setIsPlacingOrder(false)
      queryClient.invalidateQueries({ queryKey: ['guest', 'session', qrToken] })
      setTimeout(() => setOrderSuccess(false), 3000)
    },
    onError: (err: Error) => {
      setError(err.message)
      setIsPlacingOrder(false)
    },
  })

  const requestBillMutation = useMutation({
    mutationFn: () => requestBill(),
    onSuccess: () => {
      setError(null)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const cartTotal = cart.reduce((sum, item) => {
    const optionsTotal = item.options.reduce((s, o) => s + o.priceDelta * o.quantity, 0)
    return sum + (item.price + optionsTotal) * item.quantity
  }, 0)

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const addToCart = (item: typeof menu.categories[0]['items'][0], selectedOptions: Array<{ optionId: string; name: string; priceDelta: number; quantity: number }> = []) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItemId === item.id && 
        i.options.length === selectedOptions.length &&
        i.options.every(o => selectedOptions.some(s => s.optionId === o.optionId && s.quantity === o.quantity))
      )
      if (existing) {
        return prev.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl,
        quantity: 1,
        options: selectedOptions.map(o => ({ optionId: o.optionId, name: o.name, priceDelta: o.priceDelta, quantity: o.quantity }))
      }]
    })
  }

  const updateQuantity = (menuItemId: string, options: CartItem['options'], delta: number) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.menuItemId === menuItemId && 
        i.options.length === options.length &&
        i.options.every((o, i) => o.optionId === options[i]?.optionId && o.quantity === options[i]?.quantity)
      )
      if (idx === -1) return prev
      const newQty = prev[idx].quantity + delta
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== idx)
      }
      return prev.map((item, i) => i === idx ? { ...item, quantity: newQty } : item)
    })
  }

  const removeFromCart = (menuItemId: string, options: CartItem['options']) => {
    setCart(prev => prev.filter((item, i) => {
      const match = item.menuItemId === menuItemId && 
        item.options.length === options.length &&
        item.options.every((o, i) => o.optionId === options[i]?.optionId && o.quantity === options[i]?.quantity)
      return !match
    }))
  }

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return
    setIsPlacingOrder(true)
    setError(null)

    const items: CreateOrderInput['items'] = cart.map(item => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      options: item.options.map(o => ({ optionId: o.optionId, quantity: o.quantity }))
    }))

    await placeOrderMutation.mutateAsync({ items })
  }

  const activeCategory = menu.categories.find(c => c.id === activeTab) ?? menu.categories[0]

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold">{menu.outlet.name}</h1>
              <p className="text-xs text-muted-foreground">Table {menu.table.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cartCount > 0 && (
              <Button variant="secondary" size="sm" className="relative" onClick={() => setCartOpen(true)}>
                <ShoppingCart className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setCartOpen(true)}>
              <ShoppingCart className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Category Tabs */}
        <div className="border-b border-border bg-background sticky top-14 z-30">
          <div className="container mx-auto px-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full gap-0 bg-transparent p-0" role="tablist">
                {menu.categories.map(category => (
                  <TabsTrigger 
                    key={category.id} 
                    value={category.id} 
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2 text-sm font-medium"
                  >
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      {/* Menu Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="container mx-auto px-4 py-6">
          {activeCategory?.items.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No items in this category</h3>
              <p className="text-muted-foreground">Check back later or try another category.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {activeCategory?.items.map(item => {
                  const itemOptions = item.options.map(o => ({ optionId: o.id, name: o.name, priceDelta: o.priceDelta, quantity: 1 }));
                  const inCart = cart.some(c => c.menuItemId === item.id && 
                    c.options.length === itemOptions.length &&
                    c.options.every((o, i) => o.optionId === itemOptions[i]?.optionId && o.quantity === itemOptions[i]?.quantity)
                  );
                  const quantity = cart.find(c => c.menuItemId === item.id && 
                    c.options.length === itemOptions.length &&
                    c.options.every((o, i) => o.optionId === itemOptions[i]?.optionId && o.quantity === itemOptions[i]?.quantity)
                  )?.quantity ?? 0;
                  return (
                    <MenuItemCard 
                      key={item.id} 
                      item={item} 
                      onAddToCart={addToCart}
                      inCart={inCart}
                      quantity={quantity}
                    />
                  );
                })}
            </div>
          )}
        </div>
      </main>

      {/* Cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Your Order</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-4 py-4">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Your cart is empty</p>
                  <p className="text-sm text-muted-foreground mt-1">Add items from the menu</p>
                </div>
              ) : (
                <>
                  {cart.map((item, idx) => (
                    <CartItemCard 
                      key={`${item.menuItemId}-${idx}`}
                      item={item}
                      onQuantityChange={updateQuantity}
                      onRemove={removeFromCart}
                    />
                  ))}
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    {session?.outlet.taxPercent && session.outlet.taxPercent > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Tax ({session.outlet.taxPercent}%)</span>
                        <span>{formatCurrency(cartTotal * session.outlet.taxPercent / 100)}</span>
                      </div>
                    )}
                    {session?.outlet.serviceChargePercent && session.outlet.serviceChargePercent > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Service Charge ({session.outlet.serviceChargePercent}%)</span>
                        <span>{formatCurrency(cartTotal * session.outlet.serviceChargePercent / 100)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium border-t pt-2">
                      <span>Total</span>
                      <span>{formatCurrency(
                        cartTotal + 
                        (cartTotal * (session?.outlet.taxPercent ?? 0) / 100) + 
                        (cartTotal * (session?.outlet.serviceChargePercent ?? 0) / 100)
                      )}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          <SheetFooter className="border-t p-4">
            {orderSuccess ? (
              <div className="text-center text-green-600">
                <Check className="h-6 w-6 mx-auto mb-2" />
                <p className="font-medium">Order placed successfully!</p>
                <p className="text-sm text-muted-foreground">Your order is being prepared.</p>
              </div>
            ) : cart.length > 0 ? (
              <Button 
                className="w-full" 
                size="lg" 
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder}
              >
                {isPlacingOrder ? (
                  <> <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing Order... </>
                ) : (
                  <> Place Order <ShoppingCart className="h-4 w-4 ml-2" /> </>
                )}
              </Button>
            ) : null}
            {session && (
              <Button 
                variant="outline" 
                className="w-full mt-2" 
                onClick={() => requestBillMutation.mutate()}
                disabled={requestBillMutation.isPending}
              >
                {requestBillMutation.isPending ? (
                  <> <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Requesting Bill... </>
                ) : (
                  <> Request Bill <Heart className="h-4 w-4 ml-2" /> </>
                )}
              </Button>
            )}
            {error && (
              <Alert variant="destructive" className="mt-4 w-full">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Order Success Toast */}
      {orderSuccess && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <Alert className="bg-green-50 border-green-200 text-green-800">
            <Check className="h-4 w-4" />
            <AlertDescription>Order placed successfully!</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}

function MenuItemCard({ 
  item, 
  onAddToCart, 
  inCart, 
  quantity 
}: { 
  item: GuestMenuResponse['categories'][0]['items'][0]
  onAddToCart: (item: GuestMenuResponse['categories'][0]['items'][0], options: Array<{ optionId: string; name: string; priceDelta: number; quantity: number }>) => void
  inCart: boolean
  quantity: number
}) {
  const [showOptions, setShowOptions] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Array<{ optionId: string; name: string; priceDelta: number; quantity: number }>>([])

  const variantOptions = item.options.filter(o => o.kind === 'variant' && o.isActive) as Array<{ id: string; name: string; kind: 'variant' | 'addon'; priceDelta: number; isActive: boolean; displayOrder: number; quantity?: number }>
  const addonOptions = item.options.filter(o => o.kind === 'addon' && o.isActive) as Array<{ id: string; name: string; kind: 'variant' | 'addon'; priceDelta: number; isActive: boolean; displayOrder: number; quantity?: number }>

  if (variantOptions.length > 0 || addonOptions.length > 0) {
    if (inCart && quantity > 0) {
      return (
        <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
          <div className="flex-1">
            <h3 className="font-medium">{item.name}</h3>
            {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
            <p className="font-mono text-primary">{formatCurrency(item.price)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowOptions(true)}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center font-medium">{quantity}</span>
            <Button variant="outline" size="sm" onClick={() => setShowOptions(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )
    }
    return (
      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="flex gap-4">
          {item.imageUrl && (
            <div>
              <img 
                src={item.imageUrl} 
                alt={item.name} 
                className="w-24 h-24 object-cover rounded-lg bg-muted"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium">{item.name}</h3>
                {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}
                <p className="font-mono text-primary mt-1">{formatCurrency(item.price)}</p>
                {item.isVegetarian && (
                  <Badge variant="secondary" className="mt-1 bg-green-100 text-green-800">
                    <Heart className="h-3 w-3 mr-1" /> Veg
                  </Badge>
                )}
              </div>
            </div>
            <Button 
              variant={inCart ? 'outline' : 'default'} 
              className="h-10 w-10 rounded-full flex-shrink-0"
              onClick={() => {
                if (item.options.length > 0) {
                  setShowOptions(true)
                } else {
                  onAddToCart(item, [])
                }
              }}
            >
              {inCart ? (
                <Check className="h-5 w-5 text-primary" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Options Dialog */}
        <Dialog open={showOptions} onOpenChange={setShowOptions}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Customize {item.name}</DialogTitle>
              <DialogDescription>Select variants and add-ons</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {variantOptions.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Variants (select one)</h4>
                  {variantOptions.map(variant => (
                    <label key={variant.id} className="flex items-center justify-between p-3 border border-border rounded-lg cursor-pointer hover:bg-accent">
                      <div>
                        <p className="font-medium">{variant.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {variant.priceDelta >= 0 ? '+' : ''}{formatCurrency(variant.priceDelta)}
                        </p>
                      </div>
                      <input 
                        type="radio" 
                        name={`variant-${item.id}`}
                        checked={selectedOptions.some(o => o.optionId === variant.id)}
                        onChange={() => setSelectedOptions(prev => 
                          prev.filter(o => o.optionId !== variant.id).concat({
                            optionId: variant.id,
                            name: variant.name,
                            priceDelta: variant.priceDelta,
                            quantity: 1
                          })
                        )}
                        className="h-4 w-4 text-primary"
                      />
                    </label>
                  ))}
                </div>
              )}
              {addonOptions.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Add-ons</h4>
                  {addonOptions.map(addon => (
                    <label key={addon.id} className="flex items-center justify-between p-3 border border-border rounded-lg cursor-pointer hover:bg-accent">
                      <div>
                        <p className="font-medium">{addon.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {addon.priceDelta >= 0 ? '+' : ''}{formatCurrency(addon.priceDelta)}
                        </p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={selectedOptions.some(o => o.optionId === addon.id)}
                        onChange={(e) => setSelectedOptions(prev => 
                          e.target.checked 
                            ? [...prev, { optionId: addon.id, name: addon.name, priceDelta: addon.priceDelta, quantity: 1 }]
                            : prev.filter(o => o.optionId !== addon.id)
                        )}
                        className="h-4 w-4 text-primary"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowOptions(false); setSelectedOptions([]) }}>
                Cancel
              </Button>
              <Button onClick={() => { onAddToCart(item, selectedOptions); setShowOptions(false); setSelectedOptions([]) }}>
                {inCart ? 'Update' : 'Add to Cart'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
}

function CartItemCard({ 
  item, 
  onQuantityChange, 
  onRemove 
}: { 
  item: CartItem
  onQuantityChange: (menuItemId: string, options: CartItem['options'], delta: number) => void
  onRemove: (menuItemId: string, options: CartItem['options']) => void
}) {
  const optionsTotal = item.options.reduce((sum, o) => sum + o.priceDelta * o.quantity, 0)
  const itemTotal = (item.price + optionsTotal) * item.quantity

  return (
    <div className="flex gap-3 p-3 bg-card border border-border rounded-lg">
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-lg bg-muted" />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate">{item.name}</h4>
        <p className="text-sm text-muted-foreground truncate">
          {item.options.map(o => `${o.name} (${o.quantity})`).join(', ') || 'No options'}
        </p>
        <p className="font-mono text-sm text-primary">{formatCurrency(itemTotal)}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 border border-border rounded">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onQuantityChange(item.menuItemId, item.options, -1)}>
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center font-medium">{item.quantity}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onQuantityChange(item.menuItemId, item.options, 1)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onRemove(item.menuItemId, item.options)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}