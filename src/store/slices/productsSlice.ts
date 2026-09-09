import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit"
import { Product, StockStatus } from "../../types"
import { searchOffers, searchArticles, ShopOffer, TecDocArticle } from "../../api"

interface ProductsState {
  query: string
  category: string
  stockFilter: string
  products: Product[]
  piecesLoading: boolean
  apiError: string
}

const initialState: ProductsState = {
  query: "",
  category: "Tous",
  stockFilter: "Tous",
  products: [],
  piecesLoading: false,
  apiError: "",
}

// Mappers and Helpers from App.tsx
function productCategory(value = "") {
  const text = value.toLowerCase()
  if (text.includes("filter") || text.includes("filtre")) return "Filtration"
  if (text.includes("brake") || text.includes("frein") || text.includes("disc")) return "Freinage"
  if (text.includes("battery") || text.includes("batterie")) return "Batteries"
  if (text.includes("huile") || text.includes("oil")) return "Huiles"
  if (text.includes("amort") || text.includes("suspension")) return "Suspension"
  return "Moteur"
}

function mapOfferToProduct(offer: ShopOffer, vehicleLabel: string): Product {
  const name = offer.articleDescription || `Piece TecDoc ${offer.articleNumber}`
  const stock = Number(offer.stockQuantity || 0)
  return {
    id: offer.id,
    name,
    brand: offer.sellerName || `Fournisseur ${offer.supplierId}`,
    category: productCategory(name),
    car: vehicleLabel || "Vehicule selectionne / universel",
    price: Number(offer.price || 0),
    rating: 4.7,
    stock,
    status: stock > 0 ? "En stock" : "Par commande",
    image: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=80",
    badge: offer.articleNumber,
    supplierId: offer.supplierId,
    articleNumber: offer.articleNumber,
  }
}

function mapArticleToProduct(article: TecDocArticle, index: number, vehicleLabel: string): Product {
  const supplierId = article.supplierId || article.id?.supplierId || 1
  const articleNumber = article.articleNumber || article.id?.dataSupplierArticleNumber || `ART-${index + 1}`
  const productType = article.productDescription || article.productNormalizedDescription || article.normalizedDescription
  const name = productType || article.description || article.foundString || `Piece TecDoc ${articleNumber}`
  return {
    id: -Math.abs(supplierId * 100000 + index + 1),
    name,
    brand: article.supplierName || `Supplier ${supplierId || "-"}`,
    category: article.assemblyGroupDescription || productCategory(name),
    car: vehicleLabel || "Vehicule selectionne / universel",
    price: 0,
    rating: 4.5,
    stock: 0,
    status: "Par commande",
    image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=900&q=80",
    badge: articleNumber,
    supplierId,
    articleNumber,
    productType,
    assemblyGroup: article.assemblyGroupDescription,
    usage: article.usageDescription,
    attributes: article.attributes,
    eans: article.eans,
    oeNumbers: article.oeNumbers,
  }
}

// Async Thunk to fetch articles and offers
export const loadPieces = createAsyncThunk(
  "products/loadPieces",
  async (searchText: string | undefined, { getState, rejectWithValue }) => {
    const state = getState() as any
    const queryStr = searchText !== undefined ? searchText : state.products.query
    const supplierId = Number(state.vehicle.selectedSupplier)
    const vehicleId = state.vehicle.selectedCar ? Number(state.vehicle.selectedCar) : undefined
    const productId = state.vehicle.selectedProductId ? Number(state.vehicle.selectedProductId) : undefined

    if (!supplierId) {
      return rejectWithValue("Choisissez un fournisseur TecDoc avant de rechercher les articles.")
    }

    // Build vehicle label
    const manufacturer = state.vehicle.manufacturers.find((item: any) => String(item.id) === state.vehicle.selectedManufacturer)
    const model = state.vehicle.models.find((item: any) => String(item.id) === state.vehicle.selectedModel)
    const car = state.vehicle.cars.find((item: any) => String(item.id) === state.vehicle.selectedCar)
    const vehicleLabel = [
      manufacturer?.description,
      model?.description,
      car?.description || car?.fullDescription,
    ].filter(Boolean).join(" ")

    try {
      const [offers, articles] = await Promise.all([
        searchOffers(queryStr, supplierId),
        searchArticles(queryStr, supplierId, vehicleId, productId),
      ])

      const mappedOffers = offers.map((offer) => mapOfferToProduct(offer, vehicleLabel))
      const offerRefs = new Set(mappedOffers.map((product) => product.badge))
      
      const mappedArticles = articles
        .map((article, index) => mapArticleToProduct(article, index, vehicleLabel))
        .filter((product) => !offerRefs.has(product.badge))

      return [...mappedOffers, ...mappedArticles].slice(0, 80)
    } catch (error) {
      return rejectWithValue("Impossible de charger les articles TecDoc pour ce fournisseur.")
    }
  }
)

const productsSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload
    },
    setCategory: (state, action: PayloadAction<string>) => {
      state.category = action.payload
    },
    setStockFilter: (state, action: PayloadAction<string>) => {
      state.stockFilter = action.payload
    },
    setApiError: (state, action: PayloadAction<string>) => {
      state.apiError = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPieces.pending, (state) => {
        state.piecesLoading = true
        state.apiError = ""
      })
      .addCase(loadPieces.fulfilled, (state, action: PayloadAction<Product[]>) => {
        state.piecesLoading = false
        state.products = action.payload
      })
      .addCase(loadPieces.rejected, (state, action) => {
        state.piecesLoading = false
        state.products = []
        state.apiError = action.payload as string
      })
  },
})

export const { setQuery, setCategory, setStockFilter, setApiError } = productsSlice.actions
export default productsSlice.reducer
