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
import { Plus, Edit, Trash2, MoreHorizontal, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MenuItemOption, MenuItem } from '@/features/menu/services/menu.api'

interface OptionsTableProps {
  options: MenuItemOption[]
  isLoading: boolean
  menuItem: MenuItem
  canManage: boolean
  onEdit: (option: MenuItemOption, menuItemId: string) => void
  onDelete: (id: string) => void
  onCreate: (menuItemId: string) => void
}

export function OptionsTable({ 
  options, 
  isLoading, 
  menuItem,
  canManage,
  onEdit,
  onDelete,
  onCreate,
}: OptionsTableProps) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Price Delta</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(3)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Options for {menuItem.name}</h3>
        {canManage && (
          <Button onClick={() => onCreate(menuItem.id)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        )}
      </div>

      {options.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          No options yet. Add variants or addons.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Price Delta</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.map((opt) => (
              <TableRow key={opt.id}>
                <TableCell className="font-medium">{opt.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={opt.kind === 'variant' 
                    ? 'bg-[var(--role-manager-bg)] text-[var(--role-manager)]' 
                    : 'bg-[var(--role-owner-bg)] text-[var(--role-owner)]'
                  }>
                    {opt.kind.charAt(0).toUpperCase() + opt.kind.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {opt.priceDelta >= 0 ? '+' : ''}Rs {opt.priceDelta.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={opt.isActive 
                    ? 'bg-[var(--status-ready-bg)] text-[var(--status-ready)]' 
                    : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]'
                  }>
                    {opt.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Open actions menu" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(opt, menuItem.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => {
                            if (confirm(`Delete option "${opt.name}"?`)) {
                              onDelete(opt.id)
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
      )}
    </div>
  )
}