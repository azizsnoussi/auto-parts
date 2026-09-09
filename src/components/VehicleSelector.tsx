import { useEffect, useMemo } from "react"
import { Car, Loader2 } from "lucide-react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import {
  fetchInitialData,
  fetchModels,
  fetchCars,
  fetchVehicleProducts,
  setSelectedSupplier,
  setSelectedManufacturer,
  setSelectedModel,
  setSelectedCar,
  setSelectedProductId,
} from "../store/slices/vehicleSlice"

export default function VehicleSelector() {
  const dispatch = useAppDispatch()
  
  const {
    suppliers,
    manufacturers,
    models,
    cars,
    vehicleProducts,
    selectedSupplier,
    selectedManufacturer,
    selectedModel,
    selectedCar,
    selectedProductId,
    loading: vehicleLoading,
    apiError,
  } = useAppSelector((state) => state.vehicle)

  const piecesLoading = useAppSelector((state) => state.products.piecesLoading)

  // Fetch initial suppliers & manufacturers on mount
  useEffect(() => {
    if (suppliers.length === 0 && manufacturers.length === 0) {
      dispatch(fetchInitialData())
    }
  }, [dispatch, suppliers.length, manufacturers.length])

  // Fetch models when manufacturer changes
  const handleManufacturerChange = (manufacturerId: string) => {
    dispatch(setSelectedManufacturer(manufacturerId))
    if (manufacturerId) {
      dispatch(fetchModels(Number(manufacturerId)))
    }
  }

  // Fetch cars when model changes
  const handleModelChange = (modelId: string) => {
    dispatch(setSelectedModel(modelId))
    if (modelId) {
      dispatch(fetchCars(Number(modelId)))
    }
  }

  // Fetch vehicle products when version changes
  const handleCarChange = (carId: string) => {
    dispatch(setSelectedCar(carId))
    if (carId) {
      dispatch(fetchVehicleProducts({ vehicleId: Number(carId), supplierId: selectedSupplier ? Number(selectedSupplier) : undefined }))
    }
  }

  // Calculate the current active vehicle label
  const selectedVehicleLabel = useMemo(() => {
    const manufacturer = manufacturers.find((item) => String(item.id) === selectedManufacturer)
    const model = models.find((item) => String(item.id) === selectedModel)
    const car = cars.find((item) => String(item.id) === selectedCar)
    return [
      manufacturer?.description,
      model?.description,
      car?.description || car?.fullDescription,
    ].filter(Boolean).join(" ")
  }, [cars, manufacturers, models, selectedCar, selectedManufacturer, selectedModel])

  return (
    <div className="vehicle-selector">
      <div className="vehicle-title">
        <Car size={22} />
        <div>
          <h3>Choisir la voiture</h3>
          <p>{selectedVehicleLabel || "Selectionnez fournisseur TecDoc, marque, modele et version avant de chercher les pieces."}</p>
        </div>
        {(vehicleLoading || piecesLoading) && (
          <Loader2 className="ml-auto animate-spin text-[#d4af37]" size={22} />
        )}
      </div>
      <div className="vehicle-grid">
        <label>
          <span>Fournisseur TecDoc</span>
          <select
            value={selectedSupplier}
            onChange={(event) => dispatch(setSelectedSupplier(event.target.value))}
          >
            <option value="">Choisir fournisseur</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.description || supplier.fullDescription || supplier.matchcode || `Supplier ${supplier.id}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Marque</span>
          <select
            value={selectedManufacturer}
            onChange={(event) => handleManufacturerChange(event.target.value)}
          >
            <option value="">Toutes les marques</option>
            {manufacturers.map((manufacturer) => (
              <option key={manufacturer.id} value={manufacturer.id}>
                {manufacturer.description || manufacturer.fullDescription || manufacturer.matchcode || `Marque ${manufacturer.id}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Modele</span>
          <select
            value={selectedModel}
            onChange={(event) => handleModelChange(event.target.value)}
            disabled={!selectedManufacturer}
          >
            <option value="">Tous les modeles</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.description || model.fullDescription || `Modele ${model.id}`} {model.constructionInterval ? `(${model.constructionInterval})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Version</span>
          <select
            value={selectedCar}
            onChange={(event) => handleCarChange(event.target.value)}
            disabled={!selectedModel}
          >
            <option value="">Toutes les versions</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.description || car.fullDescription || `Vehicule ${car.id}`} {car.constructionInterval ? `(${car.constructionInterval})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Famille produit</span>
          <select
            value={selectedProductId}
            onChange={(event) => dispatch(setSelectedProductId(event.target.value))}
            disabled={!selectedCar}
          >
            <option value="">Toutes familles</option>
            {vehicleProducts.map((product) => (
              <option key={`${product.source}-${product.id}`} value={product.id}>
                {product.description || product.normalizedDescription || `Produit ${product.id}`} {product.source === "ENGINE" ? "(engine_prd)" : "(vehicle)"}
              </option>
            ))}
          </select>
        </label>
      </div>
      {apiError && <p className="api-warning">{apiError}</p>}
    </div>
  )
}
