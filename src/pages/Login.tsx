import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, LogIn, Car } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useAppSelector } from '../store/hooks'

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})
type FormData = z.infer<typeof schema>

const ADMIN_ROLES = [
  'SUPER_ADMIN', 'BRANCH_ADMIN', 'MANAGER', 'RECEPTIONIST',
  'MECHANIC', 'CAR_WASH_EMPLOYEE', 'STOCK_MANAGER', 'ACCOUNTANT', 'FLEET_MANAGER',
]

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const cartItems = useAppSelector((s) => s.cart.items)
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const profile = await login(data.email, data.password)
      toast.success(t('auth.loginSuccess'))

      const role: string = profile?.role ?? 'CUSTOMER'
      const from = (location.state as { from?: string } | null)?.from

      if (ADMIN_ROLES.includes(role)) {
        navigate('/admin')
        return
      }

      // A customer signs in for one of two reasons: they were bounced off a
      // protected page, or they want to pay for what is already in the basket.
      // The basket survives the login round-trip via localStorage, so an
      // occupied cart means the next step they wanted was payment.
      const wantsToBuy = cartItems.length > 0

      const safeFrom = (() => {
        if (!from || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return null
        try {
          const parsed = new URL(from, window.location.origin)
          return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null
        } catch {
          return null
        }
      })()

      if (safeFrom) {
        // The blocked page wins — unless they arrived from the basket itself,
        // where the only forward move is checkout.
        const fromPath = safeFrom.split('?')[0]
        navigate(wantsToBuy && (fromPath === '/cart' || fromPath === '/checkout') ? '/checkout' : safeFrom)
        return
      }

      navigate(wantsToBuy ? '/checkout' : '/dashboard')
    } catch (err: any) {
      const response = err?.response?.data
      const code = response?.message
      if (code === 'ACCOUNT_LOCKED') {
        const minutes = response?.data?.lockoutMinutes
        toast.error(minutes
          ? t('auth.errors.accountLockedFor', { minutes })
          : t('auth.errors.accountLocked'))
      } else if (code === 'INVALID_CREDENTIALS') {
        const remaining = response?.data?.remainingAttempts
        toast.error(Number.isInteger(remaining)
          ? t('auth.errors.invalidCredentialsRemaining', { count: remaining })
          : t('auth.errors.invalidCredentials'))
      } else {
        toast.error(t('auth.errors.loginFailed'))
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="relative flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-16 bg-[#0a0a0f]">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4af37]/6 blur-[120px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl shadow-2xl">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#b8952e] shadow-lg shadow-[#d4af37]/20 mb-4">
              <Car className="h-6 w-6 text-black" />
            </div>
            <h1 className="text-2xl font-black text-white">{t('auth.loginTitle')}</h1>
            <p className="mt-1.5 text-sm text-white/40">Bienvenue chez Bouslama Auto</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/50">{t('auth.email')}</label>
              <input {...register('email')} type="email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#d4af37]/50 focus:bg-white/8 focus:ring-1 focus:ring-[#d4af37]/30"
                placeholder="vous@example.com" />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-white/50">{t('auth.password')}</label>
                <button type="button" className="text-xs text-[#d4af37]/70 hover:text-[#d4af37] transition">
                  {t('auth.forgotPassword')}
                </button>
              </div>
              <div className="relative">
                <input {...register('password')} type={showPw ? 'text' : 'password'}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#d4af37]/50 focus:bg-white/8 focus:ring-1 focus:ring-[#d4af37]/30"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] py-3.5 text-sm font-bold text-black shadow-lg shadow-[#d4af37]/20 transition hover:shadow-[#d4af37]/40 disabled:opacity-60">
              {loading ? (
                <span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
              ) : (
                <><LogIn size={17} />{t('auth.loginBtn')}</>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/40">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-semibold text-[#d4af37] hover:text-[#f0d060] transition">
              {t('nav.register')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
