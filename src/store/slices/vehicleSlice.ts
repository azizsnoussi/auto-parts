import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit"
import { Manufacturer, CarModel, PassengerCar, Supplier, TecDocProduct, getManufacturers, getSuppliers, getModels, getPassengerCars, getVehicleProducts } from "../../api"

interface VehicleState {
  manufacturers: Manufacturer[]
  suppliers: Supplier[]
  models: CarModel[]
  cars: PassengerCar[]
  vehicleProducts: TecDocProduct[]
  selectedSupplier: string
  selectedManufacturer: string
  selectedModel: string
  selectedCar: string
  selectedProductId: string
  loading: boolean
  apiError: string
}

const initialState: VehicleState = {
  manufacturers: [],
  suppliers: [],
  models: [],
  cars: [],
  vehicleProducts: [],
  selectedSupplier: "",
  selectedManufacturer: "",
  selectedModel: "",
  selectedCar: "",
  selectedProductId: "",
  loading: false,
  apiError: "",
}

export const fetchInitialData = createAsyncThunk(
  "vehicle/fetchInitialData",
  async (_, { rejectWithValue }) => {
    try {
      const [manufacturers, suppliers] = await Promise.all([
        getManufacturers(),
        getSuppliers(),
      ])
      return { manufacturers, suppliers }
    } catch (error) {
      return rejectWithValue("Backend Spring indisponible: affichage des produits demo.")
    }
  }
)

export const fetchModels = createAsyncThunk(
  "vehicle/fetchModels",
  async (manufacturerId: number, { rejectWithValue }) => {
    try {
      const models = await getModels(manufacturerId)
      return models
    } catch (error) {
      return rejectWithValue("Impossible de charger les modeles TecDoc.")
    }
  }
)

export const fetchCars = createAsyncThunk(
  "vehicle/fetchCars",
  async (modelId: number, { rejectWithValue }) => {
    try {
      const cars = await getPassengerCars(modelId)
      return cars
    } catch (error) {
      return rejectWithValue("Impossible de charger les vehicules TecDoc.")
    }
  }
)

export const fetchVehicleProducts = createAsyncThunk(
  "vehicle/fetchVehicleProducts",
  async ({ vehicleId, supplierId }: { vehicleId: number; supplierId?: number }, { rejectWithValue }) => {
    try {
      const products = await getVehicleProducts(vehicleId, supplierId)
      return products
    } catch (error) {
      return rejectWithValue("Impossible de charger les familles produits engine_prd/passanger_car_prd.")
    }
  }
)

const vehicleSlice = createSlice({
  name: "vehicle",
  initialState,
  reducers: {
    setSelectedSupplier: (state, action: PayloadAction<string>) => {
      state.selectedSupplier = action.payload
    },
    setSelectedManufacturer: (state, action: PayloadAction<string>) => {
      state.selectedManufacturer = action.payload
      state.selectedModel = ""
      state.selectedCar = ""
      state.selectedProductId = ""
      state.models = []
      state.cars = []
      state.vehicleProducts = []
    },
    setSelectedModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload
      state.selectedCar = ""
      state.selectedProductId = ""
      state.cars = []
      state.vehicleProducts = []
    },
    setSelectedCar: (state, action: PayloadAction<string>) => {
      state.selectedCar = action.payload
      state.selectedProductId = ""
      state.vehicleProducts = []
    },
    setSelectedProductId: (state, action: PayloadAction<string>) => {
      state.selectedProductId = action.payload
    },
    setApiError: (state, action: PayloadAction<string>) => {
      state.apiError = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Initial Data (manufacturers + suppliers)
      .addCase(fetchInitialData.pending, (state) => {
        state.loading = true
        state.apiError = ""
      })
      .addCase(fetchInitialData.fulfilled, (state, action) => {
        state.loading = false
        state.manufacturers = action.payload.manufacturers
        state.suppliers = action.payload.suppliers
        if (action.payload.suppliers.length > 0) {
          state.selectedSupplier = String(action.payload.suppliers[0].id)
        }
      })
      .addCase(fetchInitialData.rejected, (state, action) => {
        state.loading = false
        state.apiError = action.payload as string
      })
      // Models
      .addCase(fetchModels.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchModels.fulfilled, (state, action) => {
        state.loading = false
        state.models = action.payload
      })
      .addCase(fetchModels.rejected, (state, action) => {
        state.loading = false
        state.apiError = action.payload as string
      })
      // Cars / Versions
      .addCase(fetchCars.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchCars.fulfilled, (state, action) => {
        state.loading = false
        state.cars = action.payload
      })
      .addCase(fetchCars.rejected, (state, action) => {
        state.loading = false
        state.apiError = action.payload as string
      })
      // Vehicle Products (Assembly Groups)
      .addCase(fetchVehicleProducts.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchVehicleProducts.fulfilled, (state, action) => {
        state.loading = false
        state.vehicleProducts = action.payload
      })
      .addCase(fetchVehicleProducts.rejected, (state, action) => {
        state.loading = false
        state.vehicleProducts = []
        state.apiError = action.payload as string
      })
  },
})

export const {
  setSelectedSupplier,
  setSelectedManufacturer,
  setSelectedModel,
  setSelectedCar,
  setSelectedProductId,
  setApiError,
} = vehicleSlice.actions

export default vehicleSlice.reducer
