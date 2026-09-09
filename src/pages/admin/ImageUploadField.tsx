/**
 * Reusable image picker for the admin forms.
 *
 * Replaces the "paste a URL" text inputs: the operator selects (or drops) a
 * file, it is sent as `multipart/form-data`, the backend pushes it to Supabase
 * Storage and returns the public URL, which is what stays in the form state and
 * in MySQL. Nothing Supabase-specific lives here — no project URL, no key.
 *
 * Two upload paths, picked automatically:
 *  - the record already exists (`entityId`) → the entity-bound endpoint, which
 *    also deletes the previous object and persists the column server-side;
 *  - the record is being created → `POST /storage/images`, and the returned URL
 *    travels with the normal create payload.
 */
import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import type { AxiosResponse } from 'axios'
import { storageApi, type ImageFolder } from '../../lib/api'
import { LABEL } from './_ui'

/** Mirrors `supabase.allowed-content-types`; the backend re-checks everything. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
/** Mirrors `supabase.max-file-size` (5 MB). */
const MAX_BYTES = 5 * 1024 * 1024

/** Entities expose the URL under different names; the storage endpoint under `url`. */
function urlFromResponse(res: AxiosResponse<any> | undefined): string {
  const d = res?.data?.data
  return d?.imageUrl ?? d?.logoUrl ?? d?.avatarUrl ?? d?.url ?? ''
}

function errorMessage(e: any, fallback: string): string {
  return e?.response?.data?.error || e?.response?.data?.message || e?.message || fallback
}

const SHAPES = {
  video:  'aspect-video',
  square: 'aspect-square',
  wide:   'h-32',
} as const

export default function ImageUploadField({
  value,
  onChange,
  folder,
  entityId,
  upload,
  remove,
  label,
  hint,
  shape = 'video',
  fit = 'cover',
  disabled = false,
  className = '',
}: {
  /** Current URL held by the form state (`''` when empty). */
  value: string
  /** Receives the new public URL, or `''` after a delete. */
  onChange: (url: string) => void
  /** Bucket folder — must be one of the backend's allowed folders. */
  folder: ImageFolder
  /** Id of the existing record; omit while creating. */
  entityId?: number | null
  /** Entity-bound upload, e.g. `adminProductsApi.uploadImage`. */
  upload?: (id: number, file: File) => Promise<AxiosResponse<any>>
  /** Entity-bound delete, e.g. `adminProductsApi.deleteImage`. */
  remove?: (id: number) => Promise<AxiosResponse<any>>
  label?: string
  hint?: string
  shape?: keyof typeof SHAPES
  fit?: 'cover' | 'contain'
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('adminShared.upload.image')
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy,    setBusy]    = useState<'upload' | 'delete' | null>(null)
  const [dragging, setDragging] = useState(false)
  /** Local blob shown while the bytes are still in flight. */
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  const preview = localPreview ?? (value || null)
  const locked  = disabled || busy !== null

  const pick = () => { if (!locked) inputRef.current?.click() }

  /** Instant feedback before spending a round-trip; the backend validates again. */
  const reject = (file: File): string | null => {
    if (!ACCEPTED.includes(file.type)) return t('adminShared.upload.unsupported', { type: file.type || t('adminShared.upload.unknown') })
    if (file.size > MAX_BYTES) return t('adminShared.upload.tooLarge', { size: MAX_BYTES / (1024 * 1024) })
    return null
  }

  const send = async (file: File) => {
    const problem = reject(file)
    if (problem) { toast.error(problem); return }

    const previous  = value
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setBroken(false)
    setBusy('upload')
    try {
      const res = entityId != null && upload
        ? await upload(entityId, file)
        : await storageApi.upload(file, folder)
      const url = urlFromResponse(res)
      if (!url) throw new Error(t('adminShared.upload.missingUrl'))
      onChange(url)
      // Creation flow: the bound endpoint is not involved, so the previous
      // object would stay in the bucket forever. Drop it, best effort.
      if (!(entityId != null && upload) && previous && previous !== url) {
        storageApi.delete(previous, folder).catch(() => { /* orphan, logged server-side */ })
      }
      toast.success(t('adminShared.upload.uploaded'))
    } catch (e: any) {
      toast.error(errorMessage(e, t('adminShared.upload.uploadFailed')))
    } finally {
      URL.revokeObjectURL(objectUrl)
      setLocalPreview(null)
      setBusy(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const clear = async () => {
    if (!value) return
    setBusy('delete')
    try {
      if (entityId != null && remove) await remove(entityId)
      else await storageApi.delete(value, folder)
      onChange('')
      setBroken(false)
      toast.success(t('adminShared.upload.deleted'))
    } catch (e: any) {
      toast.error(errorMessage(e, t('adminShared.upload.deleteFailed')))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={className}>
      <label className={LABEL}>{resolvedLabel}</label>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!locked) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file && !locked) void send(file)
        }}
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-out-expo ${SHAPES[shape]} ${
          dragging
            ? 'border-gold-500 bg-gold-50 shadow-gold-sm'
            : 'border-ink-100 bg-gray-50 hover:border-gold-400'
        }`}
      >
        {preview && !broken ? (
          <img
            src={preview}
            alt={t('adminShared.upload.preview')}
            className={`h-full w-full ${fit === 'contain' ? 'object-contain p-2' : 'object-cover'}`}
            onError={() => setBroken(true)}
          />
        ) : (
          <button
            type="button"
            onClick={pick}
            disabled={locked}
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center disabled:cursor-not-allowed"
          >
            <ImageIcon size={26} className="text-ink-200" />
            <span className="text-xs font-bold text-ink-500">
              {broken ? t('adminShared.upload.broken') : t('adminShared.upload.drop')}
            </span>
            <span className="text-[10px] font-medium text-ink-400">
              JPG, PNG, WEBP, GIF, AVIF, SVG · max {MAX_BYTES / (1024 * 1024)} Mo
            </span>
          </button>
        )}

        <AnimatePresence>
          {busy && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-sm"
            >
              <Loader2 size={22} className="animate-spin text-gold-600" />
              <span className="text-xs font-bold text-ink-600">
                {busy === 'upload' ? t('adminShared.upload.uploading') : t('adminShared.upload.deleting')}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={pick}
          disabled={locked}
          className="ba-press inline-flex items-center gap-1.5 rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-xs font-bold text-ink-600 shadow-elev-1 transition-all duration-300 ease-out-expo hover:border-gold-400 hover:text-gold-700 disabled:opacity-50"
        >
          <Upload size={13} />
          {value ? t('adminShared.upload.replace') : t('adminShared.upload.choose')}
        </button>

        {value && (
          <button
            type="button"
            onClick={clear}
            disabled={locked}
            className="ba-press inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-all duration-300 ease-out-expo hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 size={13} />
            {t('adminShared.delete')}
          </button>
        )}
      </div>

      {hint && <p className="mt-1 text-[11px] font-medium text-ink-400">{hint}</p>}

      {/* The stored Supabase URL, kept visible so an admin can copy or audit it. */}
      {value && (
        <p className="mt-1 break-all text-[10px] font-medium text-ink-300" title={value}>
          {value}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        aria-label={resolvedLabel}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void send(file)
        }}
      />
    </div>
  )
}
