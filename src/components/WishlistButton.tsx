import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { toggleLike } from '../store/slices/wishlistSlice'

interface WishlistButtonProps {
  productId: number
  className?: string
  iconSize?: number
  showLabel?: boolean
}

/** One consistent favorite control for every public product surface. */
export default function WishlistButton({
  productId,
  className = '',
  iconSize = 16,
  showLabel = false,
}: WishlistButtonProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const liked = useAppSelector((state) => state.wishlist.liked.includes(productId))

  const toggle = () => {
    dispatch(toggleLike(productId))
    toast.success(t(liked ? 'wishlist.removed' : 'wishlist.added'))
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        toggle()
      }}
      aria-label={t(liked ? 'wishlist.remove' : 'wishlist.add')}
      aria-pressed={liked}
      className={`${className} ${liked ? 'border-red-200 bg-red-50 text-red-500' : ''}`}
    >
      <Heart size={iconSize} className={liked ? 'fill-current' : ''} />
      {showLabel && <span>{t(liked ? 'wishlist.saved' : 'wishlist.save')}</span>}
    </button>
  )
}
