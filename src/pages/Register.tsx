import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, UserPlus, Car } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'

const schema = z.object({
  firstName: z.string().min(2, 'Prénom requis (min 2 caractères)'),
  lastName:  z.string().min(2, 'Nom requis (min 2 caractères)'),
  email:     z.string().email('Email invalide'),
  phone:     z.string().optional(),
  password:  z.string().min(8, 'Mot de passe min 8 caractères'),
  confirm:   z.string(),
}).refine(d => d.password === d.confirm, { message: 'Mots de passe différents', path: ['confirm'] })
type FormData = z.infer<typeof schema>

export default function Register() {
  const { t } = useTranslation()
  const { register: authRegister } = useAuth()
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await authRegister({ firstName: data.firstName, lastName: data.lastName,
        email: data.email, phone: data.phone, password: data.password })
      toast.success(t('auth.registerSuccess'))
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur lors de la création du compte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-16 bg-[#0a0a0f]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4af37]/6 blur-[120px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl shadow-2xl">
          <div className="mb-8 flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#b8952e] shadow-lg shadow-[#d4af37]/20 mb-4">
              <Car className="h-6 w-6 text-black" />
            </div>
            <h1 className="text-2xl font-black text-white">{t('auth.registerTitle')}</h1>
            <p className="mt-1.5 text-sm text-white/40">Créer votre compte gratuit</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { field: 'firstName', label: t('auth.firstName'), placeholder: 'Mohamed' },
                { field: 'lastName',  label: t('auth.lastName'),  placeholder: 'Bouslama' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="mb-1.5 block text-xs font-semibold text-white/50">{label}</label>
                  <input {...register(field as keyof FormData)} placeholder={placeholder}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/30" />
                  {errors[field as keyof FormData] && (
                    <p className="mt-1 text-[10px] text-red-400">{errors[field as keyof FormData]?.message}</p>
                  )}
                </div>
              ))}
            </div>

            {[
              { field: 'email', label: t('auth.email'), type: 'email', placeholder: 'vous@example.com' },
              { field: 'phone', label: t('auth.phone'), type: 'tel',   placeholder: '+216 20 000 000' },
            ].map(({ field, label, type, placeholder }) => (
              <div key={field}>
                <label className="mb-1.5 block text-xs font-semibold text-white/50">{label}</label>
                <input {...register(field as keyof FormData)} type={type} placeholder={placeholder}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/30" />
                {errors[field as keyof FormData] && (
                  <p className="mt-1 text-xs text-red-400">{errors[field as keyof FormData]?.message}</p>
                )}
              </div>
            ))}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/50">{t('auth.password')}</label>
              <div className="relative">
                <input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="Min 8 caractères"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/30" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/50">Confirmer le mot de passe</label>
              <input {...register('confirm')} type={showPw ? 'text' : 'password'} placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/30" />
              {errors.confirm && <p className="mt-1 text-xs text-red-400">{errors.confirm.message}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] py-3.5 text-sm font-bold text-black shadow-lg shadow-[#d4af37]/20 transition hover:shadow-[#d4af37]/40 disabled:opacity-60">
              {loading
                ? <span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                : <><UserPlus size={17} />{t('auth.registerBtn')}</>
              }
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/40">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-semibold text-[#d4af37] hover:text-[#f0d060] transition">
              {t('auth.loginBtn')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
