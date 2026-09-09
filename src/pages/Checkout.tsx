import { Check, Lock } from "lucide-react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { setLoading } from "../store/slices/uiSlice"
import { useAppNavigate } from "../hooks/useNavigate"
import PageShell from "../components/PageShell"
import SummaryLine from "../components/SummaryLine"

export default function Checkout() {
  const dispatch = useAppDispatch()
  const navigate = useAppNavigate()

  const cart = useAppSelector((state) => state.cart.items)
  const isLoggedIn = useAppSelector((state) => state.auth.isLoggedIn)
  const client = useAppSelector((state) => state.auth.client)

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const delivery = subtotal >= 120 || subtotal === 0 ? 0 : 9
  const tax = subtotal * 0.19
  const total = subtotal + tax + delivery

  const handleConfirmOrder = () => {
    if (!isLoggedIn) {
      navigate("/login")
      return
    }
    dispatch(setLoading(true))
    setTimeout(() => {
      dispatch(setLoading(false))
      alert("Commande confirmée avec succès !")
    }, 700)
  }

  return (
    <PageShell eyebrow="Commande" title="Checkout et livraison">
      {!isLoggedIn && (
        <div className="login-required">
          <Lock />
          <p>Connexion obligatoire avant confirmation de commande.</p>
          <button className="primary-action" onClick={() => navigate("/login")}>
            Se connecter
          </button>
        </div>
      )}
      <div className="checkout-layout">
        <div className="checkout-form">
          <h2>Informations client</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={client.name} readOnly />
            <input value={client.phone} readOnly />
            <input value={client.city} readOnly />
            <input value={client.email} readOnly />
            <input className="md:col-span-2" value={client.address} readOnly />
            <textarea className="md:col-span-2" value={client.car} readOnly rows={4} />
          </div>
        </div>
        <aside className="summary-panel">
          <h3>Resume panier</h3>
          <div className="cart-mini-list">
            {cart.length === 0 ? (
              <p>Panier vide.</p>
            ) : (
              cart.map((item) => (
                <p key={item.id}>
                  {item.quantity}x {item.name}
                </p>
              ))
            )}
          </div>
          <SummaryLine label="Sous-total HT" value={`${subtotal.toFixed(2)} TND`} />
          <SummaryLine label="TVA 19%" value={`${tax.toFixed(2)} TND`} />
          <SummaryLine label="Livraison" value={delivery === 0 ? "Gratuite" : `${delivery.toFixed(2)} TND`} />
          <SummaryLine label="Total" value={`${total.toFixed(2)} TND`} strong />
          <button
            className="primary-action mt-6 w-full justify-center"
            disabled={cart.length === 0}
            onClick={handleConfirmOrder}
          >
            Confirmer la commande <Check size={18} />
          </button>
        </aside>
      </div>
    </PageShell>
  )
}
