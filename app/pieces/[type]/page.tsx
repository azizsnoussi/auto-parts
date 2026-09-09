export default function CategoryPage({ params }: { params: { type: string } }) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold">Catégorie : {decodeURIComponent(params.type)}</h1>
        <p>Liste des produits disponibles pour cette catégorie.</p>
        {/* Ici tu peux ajouter une liste des produits récupérés depuis une API ou base de données */}
      </div>
    )
  }
  