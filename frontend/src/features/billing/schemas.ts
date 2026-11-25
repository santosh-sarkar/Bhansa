import { z } from 'zod'

export const billStatusColors: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export const billStatusLabels: Record<string, string> = {
  open: 'Open',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export const paymentMethodColors: Record<string, string> = {
  cash: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  card: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  online: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

export const paymentStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  succeeded: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
}

export const paymentStatusLabels: Record<string, string> = {
  pending: 'Pending',
  succeeded: 'Succeeded',
  failed: 'Failed',
  refunded: 'Refunded',
}

export const generateBillSchema = z.object({
  discountAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
    .optional()
    .or(z.literal('')),
})

export type GenerateBillForm = z.infer<typeof generateBillSchema>

export const cashPaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount'),
  idempotencyKey: z.string().max(64).optional(),
})

export type CashPaymentForm = z.infer<typeof cashPaymentSchema>

export const esewaSettingsSchema = z.object({
  productCode: z.string().min(1, 'Product code is required').max(64),
  secretKey: z.string().min(1, 'Secret key is required').max(128),
  isTestMode: z.boolean(),
  isEnabled: z.boolean(),
})

export type EsewaSettingsForm = z.infer<typeof esewaSettingsSchema>
