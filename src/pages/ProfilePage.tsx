import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { User, Mail, Phone, Shield, Palette, Save, Loader2, MapPin, Building2, Eye, EyeOff, KeyRound, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function ProfilePage() {
  const { t } = useTranslation()
  const { user, updateProfile, changePassword } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName ?? '',
    email:     user?.email ?? '',
    phone:     user?.phone ?? '',
    address:   user?.address ?? '',
    city:      user?.city ?? '',
    language:  user?.preferredLanguage ?? 'FR',
    theme:     user?.preferredTheme ?? 'DARK',
    notifications: true,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      // `email` is intentionally not sent: it is the login identifier and
      // changing it requires a re-verification flow.
      await updateProfile({
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        phone:     form.phone.trim(),
        address:   form.address.trim(),
        city:      form.city.trim(),
        preferredLanguage: form.language,
        preferredTheme:    form.theme,
      })
      toast.success('Profil mis à jour !')
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Erreur lors de la mise à jour du profil'
      )
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault()
    if (passwordForm.newPassword.length < 8) {
      toast.error(t('profile.password.errors.tooShort'))
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('profile.password.errors.mismatch'))
      return
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error(t('profile.password.errors.same'))
      return
    }

    setChangingPassword(true)
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      toast.success(t('profile.password.success'))
      navigate('/login', { replace: true, state: { passwordChanged: true } })
    } catch (err: any) {
      const code = err?.response?.data?.error || err?.response?.data?.message
      toast.error(
        code?.includes('CURRENT_PASSWORD_INCORRECT')
          ? t('profile.password.errors.incorrect')
          : code?.includes('NEW_PASSWORD_MUST_DIFFER')
            ? t('profile.password.errors.same')
            : t('profile.password.errors.failed')
      )
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="customer-portal min-h-screen bg-[#0a0a0f]">
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Mon Profil</h1>
        <p className="mt-1 text-sm text-white/40">Gérez vos informations personnelles</p>
      </div>

      {/* Avatar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#b8952e] text-2xl font-black text-black shadow-lg shadow-[#d4af37]/20">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <div>
          <p className="font-black text-white text-lg">{user?.firstName} {user?.lastName}</p>
          <p className="text-sm text-white/40">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="rounded-full bg-[#d4af37]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#d4af37]">
              {user?.role}
            </span>
            {user?.emailVerified && (
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                Vérifié
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Sections */}
      {[
        {
          title: 'Informations personnelles', icon: User,
          fields: [
            { key: 'firstName', label: t('auth.firstName'), icon: User,   type: 'text' },
            { key: 'lastName',  label: t('auth.lastName'),  icon: User,   type: 'text' },
            { key: 'email',     label: t('auth.email'),     icon: Mail,   type: 'email', disabled: true },
            { key: 'phone',     label: t('auth.phone'),     icon: Phone,  type: 'tel' },
            { key: 'address',   label: 'Adresse',           icon: MapPin, type: 'text', full: true },
            { key: 'city',      label: 'Ville',             icon: Building2, type: 'text' },
          ]
        }
      ].map(section => (
        <motion.div key={section.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4">
            <section.icon size={16} className="text-[#d4af37]" />
            <h2 className="font-bold text-white text-sm">{section.title}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.fields.map(({ key, label, icon: FieldIcon, type, disabled, full }: any) => (
              <div key={key} className={full ? 'sm:col-span-2' : undefined}>
                <label className="text-xs font-semibold text-white/40">{label}</label>
                <div className="relative mt-1">
                  <FieldIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    type={type} disabled={disabled}
                    className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/30 disabled:opacity-40 disabled:cursor-not-allowed" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Preferences */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={16} className="text-[#d4af37]" />
          <h2 className="font-bold text-white text-sm">Préférences</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-white/40">Langue</label>
            <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#0a0a0f] px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4af37]/50">
              <option value="FR">Français</option>
              <option value="EN">English</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/40">Thème</label>
            <select value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#0a0a0f] px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4af37]/50">
              <option value="DARK">Sombre</option>
              <option value="LIGHT">Clair</option>
              <option value="AUTO">Automatique</option>
            </select>
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={form.notifications} onChange={e => setForm(f => ({ ...f, notifications: e.target.checked }))}
            className="h-4 w-4 rounded accent-[#d4af37]" />
          <span className="text-sm text-white/60">Recevoir les notifications par email</span>
        </label>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-[#d4af37]" />
          <h2 className="font-bold text-white text-sm">Sécurité</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Authentification 2FA</p>
              <p className="text-xs text-white/40">Sécurité renforcée par OTP</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user?.twoFactorEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
              {user?.twoFactorEnabled ? 'Activé' : 'Désactivé'}
            </span>
          </div>
          <button onClick={() => setPasswordOpen(true)} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/8">
            {t('profile.password.open')}
          </button>
        </div>
      </motion.div>

      <button onClick={handleSave} disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] py-3.5 text-sm font-bold text-black shadow-lg shadow-[#d4af37]/20 transition hover:shadow-[#d4af37]/40 disabled:opacity-60">
        {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        {t('common.save')} les modifications
      </button>

      {passwordOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setPasswordOpen(false)}>
          <motion.form
            onSubmit={handlePasswordChange}
            initial={{ opacity: 0, y: 18, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d4af37]/15 text-[#d4af37]"><KeyRound size={20} /></span>
                <div><h2 className="font-black text-white">{t('profile.password.title')}</h2><p className="mt-1 text-xs leading-relaxed text-white/40">{t('profile.password.hint')}</p></div>
              </div>
              <button type="button" onClick={() => setPasswordOpen(false)} aria-label={t('common.close')} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              {([
                ['currentPassword', t('profile.password.current')],
                ['newPassword', t('profile.password.new')],
                ['confirmPassword', t('profile.password.confirm')],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-xs font-semibold text-white/50">{label}</span>
                  <span className="relative mt-1 block">
                    <input
                      autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
                      type={showPasswords ? 'text' : 'password'}
                      required
                      minLength={key === 'currentPassword' ? undefined : 8}
                      maxLength={128}
                      value={passwordForm[key]}
                      onChange={(event) => setPasswordForm(form => ({ ...form, [key]: event.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 pr-11 text-sm text-white outline-none transition focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30"
                    />
                    <button type="button" onClick={() => setShowPasswords(value => !value)} aria-label={t(showPasswords ? 'profile.password.hide' : 'profile.password.show')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/30 hover:text-white">
                      {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setPasswordOpen(false)} disabled={changingPassword} className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-white/60 hover:bg-white/5">{t('common.cancel')}</button>
              <button type="submit" disabled={changingPassword} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] py-3 text-sm font-black text-black disabled:opacity-60">
                {changingPassword ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}{t('profile.password.submit')}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </div>
    </div>
  )
}
