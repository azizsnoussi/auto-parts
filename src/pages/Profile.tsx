import { LogOut, Lock } from "lucide-react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { setClient, setIsLoggedIn } from "../store/slices/authSlice"
import { useAppNavigate } from "../hooks/useNavigate"
import PageShell from "../components/PageShell"
import { Client } from "../types"

export default function Profile() {
  const dispatch = useAppDispatch()
  const navigate = useAppNavigate()

  const client = useAppSelector((state) => state.auth.client)
  const isLoggedIn = useAppSelector((state) => state.auth.isLoggedIn)

  const handleFieldChange = (key: keyof Client, value: string) => {
    dispatch(setClient({ ...client, [key]: value }))
  }

  const handleLogout = () => {
    dispatch(setIsLoggedIn(false))
    navigate("/")
  }

  return (
    <PageShell eyebrow="Settings client" title="Mon profil">
      {!isLoggedIn && (
        <div className="login-required">
          <Lock />
          <p>Connectez-vous pour sauvegarder votre profil.</p>
        </div>
      )}
      <div className="checkout-form">
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          {(Object.keys(client) as Array<keyof Client>).map((key) => (
            <input
              key={key}
              value={client[key]}
              placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
              onChange={(event) => handleFieldChange(key, event.target.value)}
              className={key === "address" || key === "car" ? "md:col-span-2" : ""}
            />
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="primary-action" onClick={() => navigate("/checkout")}>
            Sauvegarder et commander
          </button>
          <button className="secondary-dark" onClick={handleLogout}>
            <LogOut size={18} /> Deconnexion
          </button>
        </div>
      </div>
    </PageShell>
  )
}
