export default function ProductDetail({ params }: { params: { type: string; id: string } }) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold">Détails de la pièce</h1>
        <p>Type : {decodeURIComponent(params.type)}</p>
        <p>ID du produit : {params.id}</p>
        {/* Ici tu peux ajouter des détails récupérés depuis une API */}
      </div>
    )
  }
  