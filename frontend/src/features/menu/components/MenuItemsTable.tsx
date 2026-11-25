'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Edit, Trash2, MoreHorizontal, Loader2, GripVertical, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MenuItem } from '@/features/menu/services/menu.api'

interface MenuItemsTableProps {
  items: MenuItem[]
  isLoading: boolean
  canManage: boolean
  onEdit: (item: MenuItem) => void
  onDelete: (id: string) => void
  onManageOptions: (item: MenuItem) => void
  onManageOverrides: (item: MenuItem) => void
  onCreate: () => void
}

export function MenuItemsTable({ 
  items, 
  isLoading, 
  canManage,
  onEdit,
  onDelete,
  onManageOptions,
  onManageOverrides,
  onCreate,
}: MenuItemsTableProps) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Veg</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No menu items yet.</p>
        {canManage && (
          <Button className="mt-4" onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Menu Item
          </Button>
        )}
      </div>
    )
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Veg</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>{item.categoryName}</TableCell>
              <TableCell className="text-right font-mono">Rs {item.price.toFixed(2)}</TableCell>
              <TableCell>
                {item.isVegetarian && <Badge variant="secondary" className="bg-[var(--role-waiter-bg)] text-[var(--role-waiter)]">Veg</Badge>}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={item.isActive 
                  ? 'bg-[var(--status-ready-bg)] text-[var(--status-ready)]' 
                  : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]'
                }>
                  {item.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(item)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onManageOptions(item)}>
                        <GripVertical className="h-4 w-4 mr-2" />
                        Manage Options
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onManageOverrides(item)}>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Outlet Overrides
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => {
                          if (confirm(`Delete "${item.name}"?`)) {
                            onDelete(item.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}