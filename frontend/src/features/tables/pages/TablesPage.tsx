'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, QrCode, Printer, Edit, Trash2, MoreHorizontal, Download, Loader2, Eye, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import {
  fetchTables,
  createTable,
  updateTable,
  deactivateTable,
  fetchQrImage,
  type Table as TableType,
} from '@/features/table/services/table.api'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const tableStatusColors: Record<string, string> = {
  free: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  occupied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  needs_bill: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
}

const createTableSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  seats: z.number().min(1, 'At least 1 seat').max(50, 'Maximum 50 seats'),
})

type CreateTableForm = z.infer<typeof createTableSchema>

const updateTableSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  seats: z.number().min(1, 'At least 1 seat').max(50, 'Maximum 50 seats'),
  isActive: z.boolean(),
})

type UpdateTableForm = z.infer<typeof updateTableSchema>

// ===== Helper Components =====

function TablesTable({ tables, isLoading }: { tables: TableType[]; isLoading: boolean }) {
  const queryClient = useQueryClient()

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateTable(queryClient.getQueryData(['outletId']) as string, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
  })

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Seats</TableHead>
            <TableHead>QR Token</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (tables.length === 0) {
    return (
      <div className="text-center py-12">
        <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No tables yet</h3>
        <p className="text-muted-foreground mb-4">Create your first table to start accepting orders.</p>
        <Button onClick={() => document.getElementById('create-table-dialog')?.click()}>
          <Plus className="h-4 w-4 mr-2" />
          Create Table
        </Button>
      </div>
    )
  }

  const outletId = queryClient.getQueryData(['outletId']) as string

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Seats</TableHead>
          <TableHead>QR Token</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Active</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tables.map((table) => (
          <TableRow key={table.id}>
            <TableCell className="font-medium">{table.label}</TableCell>
            <TableCell>{table.seats}</TableCell>
            <TableCell className="font-mono text-sm max-w-[200px] truncate">{table.qrToken}</TableCell>
            <TableCell>
              <Badge variant="secondary" className={cn(tableStatusColors[table.status] ?? 'bg-gray-100 text-gray-800')}>
                {table.status.charAt(0).toUpperCase() + table.status.slice(1).replace('_', ' ')}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={table.isActive ? 'default' : 'secondary'}>
                {table.isActive ? 'Yes' : 'No'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('view-qr', { detail: table.id }))}>
                    <Eye className="h-4 w-4 mr-2" />
                    View QR Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('print-qr', { detail: table.id }))}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print QR Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('download-qr', { detail: table.id }))}>
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Image
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('edit-table', { detail: table }))}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('regenerate-qr', { detail: table.id }))}>
                    <QrCode className="h-4 w-4 mr-2" />
                    Regenerate QR
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      if (confirm(`Deactivate table "${table.label}"?`)) {
                        deactivateMutation.mutate(table.id)
                      }
                    }}
                    disabled={deactivateMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deactivate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CreateTableDialog({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const outletId = queryClient.getQueryData(['outletId']) as string

  const mutation = useMutation({
    mutationFn: (data: CreateTableForm) => createTable(outletId, data),
    onSuccess: () => {
      setIsOpen(false)
      setError(null)
      onSuccess()
    },
    onError: (err: Error) => setError(err.message),
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateTableForm>({
    resolver: zodResolver(createTableSchema),
    defaultValues: { label: '', seats: 4 },
  })

  useEffect(() => {
    if (!isOpen) {
      reset({ label: '', seats: 4 })
    }
  }, [isOpen, reset])

  const onSubmit = (data: CreateTableForm) => {
    mutation.mutate(data)
  }

  const handleOpenDialog = () => {
    setError(null)
    setIsOpen(true)
  }

  return (
    <>
      <Button id="create-table-dialog" onClick={handleOpenDialog}>
        <Plus className="h-4 w-4 mr-2" />
        Create Table
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Table</DialogTitle>
            <DialogDescription>Add a new table with QR code for ordering.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Table Label</Label>
                <Input
                  id="label"
                  {...register('label')}
                  placeholder="Table 1"
                  disabled={mutation.isPending}
                  aria-invalid={!!errors.label}
                />
                {errors.label && <p className="text-sm text-destructive" role="alert">{errors.label.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="seats">Number of Seats</Label>
                <Input
                  id="seats"
                  type="number"
                  min="1"
                  max="50"
                  {...register('seats', { valueAsNumber: true })}
                  disabled={mutation.isPending}
                  aria-invalid={!!errors.seats}
                />
                {errors.seats && <p className="text-sm text-destructive" role="alert">{errors.seats.message}</p>}
              </div>
              {error && (
                <Alert variant="destructive" className="gap-2">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsOpen(false); reset({ label: '', seats: 4 }) }} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Table'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EditTableDialog({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [table, setTable] = useState<TableType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const outletId = queryClient.getQueryData(['outletId']) as string

  const mutation = useMutation({
    mutationFn: (data: UpdateTableForm) => updateTable(outletId, table!.id, data),
    onSuccess: () => {
      setIsOpen(false)
      setTable(null)
      setError(null)
      onSuccess()
    },
    onError: (err: Error) => setError(err.message),
  })

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<UpdateTableForm>({
    resolver: zodResolver(updateTableSchema),
  })

  const formData = watch()

  useEffect(() => {
    if (table) {
      reset({
        label: table.label,
        seats: table.seats,
        isActive: table.isActive,
      })
      setError(null)
    } else {
      reset()
      setError(null)
    }
  }, [table, reset])

  const handleOpen = (e: CustomEvent<TableType>) => {
    setTable(e.detail)
    setIsOpen(true)
  }

  useEffect(() => {
    window.addEventListener('edit-table', handleOpen as unknown as EventListener)
    return () => window.removeEventListener('edit-table', handleOpen as unknown as EventListener)
  }, [])

  const onSubmit = (data: UpdateTableForm) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setTable(null); reset() } setIsOpen(open) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Table</DialogTitle>
          <DialogDescription>Update table details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Table Label</Label>
              <Input
                id="label"
                {...register('label')}
                disabled={mutation.isPending}
                aria-invalid={!!errors.label}
              />
              {errors.label && <p className="text-sm text-destructive" role="alert">{errors.label.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="seats">Number of Seats</Label>
              <Input
                id="seats"
                type="number"
                min="1"
                max="50"
                {...register('seats', { valueAsNumber: true })}
                disabled={mutation.isPending}
                aria-invalid={!!errors.seats}
              />
              {errors.seats && <p className="text-sm text-destructive" role="alert">{errors.seats.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="isActive">Active</Label>
              <Select
                value={formData.isActive ? 'true' : 'false'}
                onValueChange={(v) => setValue('isActive', v === 'true')}
                disabled={mutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <Alert variant="destructive" className="gap-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsOpen(false); setTable(null); reset() }} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function QRCodeDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [qrData, setQrData] = useState<{ table: TableType; blob: Blob } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const queryClient = useQueryClient()
  const outletId = queryClient.getQueryData(['outletId']) as string

  const handleOpen = async (e: CustomEvent<string>) => {
    const tableId = e.detail
    setIsLoading(true)
    setIsOpen(true)
    try {
      const tablesData = queryClient.getQueryData(['tables']) as { data: TableType[] } | undefined
      const table = tablesData?.data.find(t => t.id === tableId)
      if (!table) throw new Error('Table not found')

      const blob = await fetchQrImage(outletId, tableId)
      setQrData({ table, blob })
    } catch (err) {
      console.error(err)
      alert('Failed to load QR code')
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const handleView = (e: CustomEvent<string>) => handleOpen(e)
    const handlePrint = (e: CustomEvent<string>) => handleOpen(e)
    const handleDownload = (e: CustomEvent<string>) => handleOpen(e)

    window.addEventListener('view-qr', handleView as unknown as EventListener)
    window.addEventListener('print-qr', handlePrint as unknown as EventListener)
    window.addEventListener('download-qr', handleDownload as unknown as EventListener)

    return () => {
      window.removeEventListener('view-qr', handleView as unknown as EventListener)
      window.removeEventListener('print-qr', handlePrint as unknown as EventListener)
      window.removeEventListener('download-qr', handleDownload as unknown as EventListener)
    }
  }, [outletId])

  const handlePrint = () => {
    if (!qrData) return
    const url = URL.createObjectURL(qrData.blob)
    const printWindow = window.open(url, '_blank')
    printWindow?.addEventListener('load', () => {
      printWindow?.print()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }

  const handleDownload = () => {
    if (!qrData) return
    const url = URL.createObjectURL(qrData.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `table-${qrData.table.label}-qr.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleCopy = async () => {
    if (!qrData) return
    try {
      const url = URL.createObjectURL(qrData.blob)
      const blob = await fetch(url).then(r => r.blob())
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      URL.revokeObjectURL(url)
      alert('QR code copied to clipboard!')
    } catch {
      alert('Failed to copy QR code')
    }
  }

  if (!qrData) {
    return null
  }

  const url = URL.createObjectURL(qrData.blob)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code for {qrData.table.label}</DialogTitle>
          <DialogDescription>
            Scan to open the menu. Right-click to save or use the buttons below.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {isLoading ? (
            <div className="flex h-64 w-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <img
              src={url}
              alt={`QR code for ${qrData.table.label}`}
              className="h-64 w-64 rounded-lg border border-border"
            />
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Token: <code className="font-mono">{qrData.table.qrToken}</code>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===== Main Page Component =====

export default function TablesPage() {
  const queryClient = useQueryClient()
  const { getCurrentOutletId } = useAuthStore()
  const outletId = getCurrentOutletId()

  useEffect(() => {
    if (outletId) {
      queryClient.setQueryData(['outletId'], outletId)
    }
  }, [outletId, queryClient])

  const { data: tablesData, isLoading, error } = useQuery({
    queryKey: ['tables', outletId],
    queryFn: () => fetchTables(outletId!),
    enabled: !!outletId,
  })

  if (!outletId) {
    return (
      <div className="text-center py-12">
        <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">No outlet selected</h2>
        <p className="text-muted-foreground">Please select an outlet from the header to manage tables.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tables</h1>
          <p className="text-muted-foreground">Manage tables and QR codes for ordering.</p>
        </div>
        <CreateTableDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tables'] })} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tables</CardTitle>
        </CardHeader>
        <CardContent>
          <TablesTable tables={tablesData?.data ?? []} isLoading={isLoading} />
        </CardContent>
      </Card>

      <EditTableDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tables'] })} />
      <QRCodeDialog />
    </div>
  )
}