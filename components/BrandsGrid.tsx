import { Card } from "@/components/ui/card"

const brands = [
  {
    name: "BMW",
    logo: "https://pngimg.com/uploads/bmw/bmw_PNG99546.png",
  },
  {
    name: "Mercedes",
    logo: "https://logos-world.net/wp-content/uploads/2020/05/Mercedes-Benz-Logo.png",
  },
  {
    name: "Porsche",
    logo: "https://logos-world.net/wp-content/uploads/2021/06/Porsche-Logo-2014.png",
  },
  {
    name: "MiniCooper",
    logo: "https://logos-world.net/wp-content/uploads/2021/04/Mini-Logo.png",
  },
  {
    name: "Volkswagen",
    logo: "https://1000logos.net/wp-content/uploads/2021/04/Volkswagen-logo.png",
  },
  {
    name: "Audi",
    logo: "https://logohistory.net/wp-content/uploads/2023/01/Audi-Emblem.png",
  },
  {
    name: "Land Rover",
    logo: "https://listcarbrands.com/wp-content/uploads/2016/03/Logo-Land-Rover.png",
  }
]

export function BrandsGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {brands.map((brand) => (
        <Card
          key={brand.name}
          className="p-6 flex flex-col items-center justify-center text-center hover:shadow-lg transition-shadow cursor-pointer"
        >
          <img src={brand.logo} alt={brand.name} className="w-20 h-20 object-contain mb-4" />
          <h3 className="font-medium">{brand.name}</h3>
        </Card>
      ))}
    </div>
  )
}
