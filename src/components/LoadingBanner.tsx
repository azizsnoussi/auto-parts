import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"

export default function LoadingBanner({ loading, title }: { loading: boolean; title: string }) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div className="loading-banner" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}>
          <div className="loading-track">
            <motion.span initial={{ width: "15%" }} animate={{ width: "92%" }} transition={{ duration: 0.42 }} />
          </div>
          <Loader2 className="animate-spin" size={18} />
          <strong>Chargement {title}</strong>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
