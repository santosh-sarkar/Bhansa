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
import { Loader2, Mail, Lock, User, Building, AlertCircle, CheckCircle } from 'lucide-react'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  organizationSlug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      organizationName: '',
      organizationSlug: '',
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library, @typescript-eslint/no-unused-vars
  const organizationName = watch('organizationName')

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    setServerError(null)

    try {
      const result = await api.post<{ user: unknown }>('/auth/register', {
        email: data.email,
        password: data.password,
        full_name: data.fullName,
        organization_name: data.organizationName,
        organization_slug: data.organizationSlug,
      })

      if (result.error) {
        setServerError(result.error.message)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(routes.verifyEmail)
        router.refresh()
      }, 2000)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
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
          <h2 className="text-2xl font-bold text-foreground">Account created!</h2>
          <p className="text-muted-foreground mt-2">
            We&apos;ve sent a verification email to your inbox. Please check your email and verify your account.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Redirecting to verification page...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Start your 14-day free trial. No credit card required.</CardDescription>
      </CardHeader>

      {serverError && (
        <Alert variant="destructive" className="gap-2">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              className="pl-10"
              {...register('fullName')}
              disabled={isLoading}
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? 'fullName-error' : undefined}
            />
          </div>
          {errors.fullName && (
            <p id="fullName-error" className="text-sm text-destructive" role="alert">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              placeholder="you@restaurant.com"
              className="pl-10"
              {...register('email')}
              disabled={isLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
          </div>
          {errors.email && (
            <p id="email-error" className="text-sm text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationName">Restaurant Name</Label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="organizationName"
              type="text"
              placeholder="Bansa Kitchen"
              className="pl-10"
              {...register('organizationName')}
              disabled={isLoading}
              aria-invalid={!!errors.organizationName}
              aria-describedby={errors.organizationName ? 'orgName-error' : undefined}
            />
          </div>
          {errors.organizationName && (
            <p id="orgName-error" className="text-sm text-destructive" role="alert">
              {errors.organizationName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationSlug">URL Slug</Label>
          <p className="text-xs text-muted-foreground">
            Your restaurant&apos;s URL: app.bansa.com/<strong>your-slug</strong>
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              app.bansa.com/
            </span>
            <Input
              id="organizationSlug"
              type="text"
              placeholder="bansa-kitchen"
              className="pl-36"
              {...register('organizationSlug')}
              disabled={isLoading}
              aria-invalid={!!errors.organizationSlug}
              aria-describedby={errors.organizationSlug ? 'orgSlug-error' : undefined}
            />
          </div>
          {errors.organizationSlug && (
            <p id="orgSlug-error" className="text-sm text-destructive" role="alert">
              {errors.organizationSlug.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="pl-10"
              {...register('password')}
              disabled={isLoading}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
          </div>
          {errors.password && (
            <p id="password-error" className="text-sm text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              className="pl-10"
              {...register('confirmPassword')}
              disabled={isLoading}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
            />
          </div>
          {errors.confirmPassword && (
            <p id="confirmPassword-error" className="text-sm text-destructive" role="alert">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Creating account...
          </>
        ) : (
          'Create Account'
        )}
      </Button>

      <CardFooter className="flex flex-col space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href={routes.login} className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{' '}
          <Link href="#" className="underline hover:text-foreground">Terms of Service</Link>{' '}
          and{' '}
          <Link href="#" className="underline hover:text-foreground">Privacy Policy</Link>
        </p>
      </CardFooter>
    </form>
  )
}