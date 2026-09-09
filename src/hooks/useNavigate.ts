import { useAppDispatch } from "../store/hooks"
import { setRoute, setLoading, setMenuOpen } from "../store/slices/uiSlice"
import { Route } from "../types"

export function useAppNavigate() {
  const dispatch = useAppDispatch()

  const navigate = (nextRoute: Route) => {
    dispatch(setMenuOpen(false))
    dispatch(setLoading(true))
    window.history.pushState({}, "", nextRoute)
    setTimeout(() => {
      dispatch(setRoute(nextRoute))
      dispatch(setLoading(false))
      window.scrollTo({ top: 0, behavior: "smooth" })
    }, 420)
  }

  return navigate
}
