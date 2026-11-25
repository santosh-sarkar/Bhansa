'use client'

import { useState } from 'react'
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
import { Plus, Edit, Trash2, MoreHorizontal, Loader2, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Category } from '@/features/menu/services/menu.api'

interface CategoriesTableProps {
  categories: Category[]
  isLoading: boolean
  onReorder?: (id: string, direction: 'up' | 'down') => void
  canManage: boolean
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
  onCreate: () => void
}

export function CategoriesTable({ 
  categories, 
  isLoading, 
  onReorder, 
  canManage,
  onEdit,
  onDelete,
  onCreate,
}: CategoriesTableProps) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Order</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-48" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No categories yet.</p>
        {canManage && (
          <Button className="mt-4" onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Category
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
            <TableHead className="w-10">Order</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category, index) => (
            <TableRow key={category.id}>
              <TableCell className="font-mono text-sm">{category.displayOrder}</TableCell>
              <TableCell className="font-medium">{category.name}</TableCell>
              <TableCell className="text-muted-foreground max-w-[300px] truncate">{category.description ?? '—'}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={category.isActive 
                  ? 'bg-[var(--status-ready-bg)] text-[var(--status-ready)]' 
                  : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]'
                }>
                  {category.isActive ? 'Active' : 'Inactive'}
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
                      <DropdownMenuItem onSelect={() => onEdit(category)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {onReorder && (
                        <>
                          <DropdownMenuItem 
                            onSelect={() => onReorder(category.id, 'up')} 
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Move Up
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onSelect={() => onReorder(category.id, 'down')} 
                            disabled={index === categories.length - 1}
                          >
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Move Down
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => {
                          if (confirm(`Delete category "${category.name}"?`)) {
                            onDelete(category.id)
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