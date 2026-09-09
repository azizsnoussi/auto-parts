import { Facebook, Instagram } from 'lucide-react'
import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="site-footer bg-[#2A2A2A] text-white">
      <div className="container mx-auto py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-16 md:px-32 lg:px-64">
          
          <div className="text-center md:text-left">
            <h3 className="text-[#D4AF37] font-bold mb-4">Contactez-nous</h3>
            <p>Avenue Mohamed V, Sousse</p>
            <p>Email: exemple@gmail.com</p>
            <p>TEL: (+216) 25199188</p>
            <p>- Lun au Ven: de 8h à 18h</p>
            <p>- Sam: de 8h à 14h</p>
          </div>

          <div className="text-center md:text-left">
            <h3 className="text-[#D4AF37] font-bold mb-4">Information</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="hover:text-[#D4AF37]">À propos de nous</Link></li>
              <li><Link href="/terms" className="hover:text-[#D4AF37]">Termes et conditions</Link></li>
              <li><Link href="/contact" className="hover:text-[#D4AF37]">Contactez-nous</Link></li>
            </ul>
          </div>

          <div className="text-center md:text-left">
            <h3 className="text-[#D4AF37] font-bold mb-4">Mon Compte</h3>
            <ul className="space-y-2">
              <li><Link href="/profile" className="hover:text-[#D4AF37]">Editer le profil</Link></li>
              <li><Link href="/orders" className="hover:text-[#D4AF37]">Historique des commandes</Link></li>
              <li><Link href="/favorites" className="hover:text-[#D4AF37]">Mes Favoris</Link></li>
            </ul>
          </div>

          <div className="text-center md:text-left">
            <h3 className="text-[#D4AF37] font-bold mb-4">Rejoignez-nous</h3>
            <ul className="rejoignez-us-icons space-y-3 flex flex-col justify-center items-center">
            <li>
                <Link href="#" className="hover:text-[#D4AF37]">
                  <Facebook className="h-12 w-12" />
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[#D4AF37]">
                  <Instagram className="h-12 w-12" />
                </Link>
              </li>
            </ul>
          </div>

        </div>
        <div className="mt-8 pt-8 border-t border-gray-700">
          <div className="flex justify-center">
            <p className="text-center">Copyright 2025 © BOUSLAMA AUTO. Tous droits réservés.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
