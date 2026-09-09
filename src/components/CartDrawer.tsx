import { AnimatePresence, motion } from "framer-motion"
import { Minus, Plus, X } from "lucide-react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { setCartOpen } from "../store/slices/uiSlice"
import { updateQuantity, removeItem } from "../store/slices/cartSlice"
import { useAppNavigate } from "../hooks/useNavigate"
import SummaryLine from "./SummaryLine"

export default function CartDrawer() {
  const dispatch = useAppDispatch()
  const navigate = useAppNavigate()

  const open = useAppSelector((state) => state.ui.cartOpen)
  const cart = useAppSelector((state) => state.cart.items)

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const delivery = subtotal >= 120 || subtotal === 0 ? 0 : 9
  const tax = subtotal * 0.19
  const total = subtotal + tax + delivery

  const close = () => dispatch(setCartOpen(false))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            className="cart-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-2xl font-black">Votre panier</h2>
              <button className="icon-button" onClick={close} aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 flex-1 space-y-4 overflow-auto">
              {cart.length === 0 ? (
                <div className="empty-state">Votre panier est vide.</div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="cart-line">
                    <img src={item.imageUrl || '/images/placeholder.png'} alt={item.name} />
                    <div className="min-w-0 flex-1">
                      <h3>{item.name}</h3>
                      <p>{item.price.toFixed(2)} TND</p>
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity - 1 }))}>
                          <Minus size={16} />
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}>
                          <Plus size={16} />
                        </button>
                        <button className="ml-auto" onClick={() => dispatch(removeItem(item.id))}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t pt-5">
              <SummaryLine label="Total TTC" value={`${total.toFixed(2)} TND`} strong />
              <button
                className="primary-action mt-5 w-full justify-center"
                onClick={() => {
                  close()
                  navigate("/checkout")
                }}
              >
                Passer commande <Plus size={18} />
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
