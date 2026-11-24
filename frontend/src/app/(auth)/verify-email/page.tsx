'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { routes } from '@/config/routes'
import { api } from '@/lib/apiClient'
import { Loader2, Mail, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

const verifySchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
})

type VerifyForm = z.infer<typeof verifySchema>

const resendSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ResendForm = z.infer<typeof resendSchema>

export default function VerifyEmailPage() {
  const router = useRouter()
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const {
    register: registerVerify,
    handleSubmit: handleSubmitVerify,
    formState: { errors: verifyErrors },
  } = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
    defaultValues: { token: '' },
  })

  const {
    register: registerResend,
    handleSubmit: handleSubmitResend,
    formState: { errors: resendErrors },
  } = useForm<ResendForm>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: '' },
  })

  const onVerify = async (data: VerifyForm) => {
    setIsVerifying(true)
    setServerError(null)

    try {
      const result = await api.post('/auth/verify-email', { token: data.token })
      if (result.error) {
        setServerError(result.error.message)
        return
      }
      setSuccess(true)
      setTimeout(() => {
        router.push(routes.login)
        router.refresh()
      }, 2000)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  const onResend = async (data: ResendForm) => {
    setIsResending(true)
    setServerError(null)
    setResendSuccess(false)

    try {
      const result = await api.post('/auth/resend-verification', { email: data.email })
      if (result.error) {
        setServerError(result.error.message)
        return
      }
      setResendSuccess(true)
      setResendCooldown(300) // 5 minutes
      startCooldown()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to resend')
    } finally {
      setIsResending(false)
    }
  }

  const startCooldown = () => {
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" aria-hidden="true" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Email verified!</h2>
          <p className="text-muted-foreground mt-2">
            Your account has been verified. You can now sign in to your restaurant.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl">Verify your email</CardTitle>
        <CardDescription>
          Enter the verification code sent to your email address
        </CardDescription>
      </CardHeader>

      {serverError && (
        <Alert variant="destructive" className="gap-2">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Verify Token Form */}
      <form onSubmit={handleSubmitVerify(onVerify)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="token">Verification Token</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="token"
              type="text"
              placeholder="Enter 6-digit code"
              className="pl-10 text-center tracking-widest text-lg"
              {...registerVerify('token')}
              disabled={isVerifying}
              maxLength={6}
              aria-invalid={!!verifyErrors.token}
              aria-describedby={verifyErrors.token ? 'token-error' : undefined}
            />
          </div>
          {verifyErrors.token && (
            <p id="token-error" className="text-sm text-destructive" role="alert">
              {verifyErrors.token.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isVerifying}>
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Verifying...
            </>
          ) : (
            'Verify Email'
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* Resend Form */}
      <form onSubmit={handleSubmitResend(onResend)} className="space-y-4" noValidate>
        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t receive the email? Resend verification link.
        </p>

        {resendSuccess && (
          <Alert className="gap-2 bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>Verification email sent! Check your inbox.</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="resendEmail">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="resendEmail"
              type="email"
              placeholder="you@restaurant.com"
              className="pl-10"
              {...registerResend('email')}
              disabled={isResending || resendCooldown > 0}
              aria-invalid={!!resendErrors.email}
              aria-describedby={resendErrors.email ? 'resend-email-error' : undefined}
            />
          </div>
          {resendErrors.email && (
            <p id="resend-email-error" className="text-sm text-destructive" role="alert">
              {resendErrors.email.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          variant="outline"
          disabled={isResending || resendCooldown > 0}
        >
          {isResending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Sending...
            </>
          ) : resendCooldown > 0 ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Resend in {formatTime(resendCooldown)}
            </>
          ) : (
            'Resend Verification Email'
          )}
        </Button>
      </form>

      <CardFooter className="flex flex-col space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          <Link href={routes.login} className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardFooter>
    </div>
  )
}