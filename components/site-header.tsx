"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Phone, Heart, User, ShoppingCart, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const cartRef = useRef<HTMLDivElement | null>(null); 
  const menuRef = useRef<HTMLDivElement | null>(null); 



  useEffect(() => {
    // Close the cart when clicking outside of it
    const handleClickOutside = (event: MouseEvent) => {
      if (cartRef.current && !cartRef.current.contains(event.target as Node)) {
        setIsCartOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    // Add the event listener for clicks outside
    document.addEventListener("mousedown", handleClickOutside);

    // Clean up the event listener on unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header
      className={`site-header w-full z-50 border-b bg-white shadow transition-all duration-300 ease-in-out ${isCollapsed ? "collapsed" : ""} fixed`}
    >
      {/* Contact Bar */}
      <div className="bg-[#D4AF37] text-white py-2 px-4 text-sm">
        <div className="container mx-auto flex items-center justify-end gap-2">
          <Phone size={16} />
          <span className="hidden sm:inline">Contactez-nous :</span>
          <span>(+216) 12345678 - (+216) 987654321</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto py-4 px-16 sm:px-20">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="logo font-bold text-3xl">
            <img src="/images/bouslamaauto.png" alt="Bouslama Auto" className="h-10" />
          </Link>

          <div className="flex items-center gap-8">
            {/* Heart icon */}
            <Button variant="ghost" size="icon" className="p-2">
              <Heart className=" text-[#000000]" />
            </Button>

            {/* User icon */}
            <Button variant="ghost" size="icon" className="p-2">
              <User className="h-7 w-7 text-[#000000]" />
            </Button>

            {/* Cart */}
            <div className="relative" ref={cartRef}>
              <Button
                variant="ghost"
                size="icon"
                className="relative p-2"
                onClick={() => setIsCartOpen(!isCartOpen)}
              >
                <ShoppingCart className="h-7 w-7 text-[#000000]" />
                <span className="absolute top-0 right-0 bg-[#D4AF37] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  2
                </span>
              </Button>

              {isCartOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white shadow-lg rounded-lg p-4 z-50">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-sm">Votre Panier</h3>
                    <button onClick={() => setIsCartOpen(false)}>
                      <X className="h-4 w-4 text-gray-500 hover:text-red-500" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-3">
                    <div className="flex items-center gap-2">
                      <img
                        src="/images/piece1.jpg"
                        alt="Pièce 1"
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Filtre à Huile</p>
                        <p className="text-xs text-gray-500">Quantité: 1</p>
                      </div>
                      <p className="text-sm font-bold">25.00 TND</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src="/images/piece2.jpg"
                        alt="Pièce 2"
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Batterie 12V</p>
                        <p className="text-xs text-gray-500">Quantité: 1</p>
                      </div>
                      <p className="text-sm font-bold">180.00 TND</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between items-center font-bold">
                    <span>Total :</span>
                    <span>205.00 TND</span>
                  </div>
                  <Link href="/checkout">
                    <Button
                      className="w-full mt-3 bg-[#D4AF37] hover:bg-[#d6992d] text-white"
                      onClick={() => setIsCartOpen(false)}
                    >
                      Commander
                    </Button>
                  </Link>

                </div>
              )}
            </div>

            {/* Menu icon */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Responsive Navigation */}
      <nav
        ref={menuRef}
        className={`absolute left-0 w-full transition-all duration-300 ease-in-out ${isMenuOpen ? "top-full opacity-100 visible" : "top-[-100%] opacity-0 invisible"} sm:relative sm:top-auto sm:opacity-100 sm:visible`}
      >
        <div className={`container mx-auto p-4 sm:p-0 ${isMenuOpen ? "bg-white rounded-b-xl" : ""}`}>
          <ul className="grid grid-cols-1 sm:grid-cols-2 sm:flex items-center justify-center gap-4 sm:gap-6 py-4 sm:py-2">
            <li className="text-center">
              <Link href="/" className="block py-2 px-4 rounded-lg hover:bg-[#D4AF37] hover:text-white transition" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                Accueil
              </Link>
            </li>
            <li className="text-center">
              <Link href="/pieces" className="block py-2 px-4 rounded-lg hover:bg-[#D4AF37] hover:text-white transition" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                Pièces auto
              </Link>
            </li>
            <li className="text-center">
              <Link href="/marques" className="block py-2 px-4 rounded-lg hover:bg-[#D4AF37] hover:text-white transition" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                Marques
              </Link>
            </li>
            <li className="text-center">
              <Link href="/huiles" className="block py-2 px-4 rounded-lg hover:bg-[#D4AF37] hover:text-white transition" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                Huiles & additifs
              </Link>
            </li>
            <li className="text-center">
              <Link href="/accessoires" className="block py-2 px-4 rounded-lg hover:bg-[#D4AF37] hover:text-white transition" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                Accessoires Et Entretien
              </Link>
            </li>
            <li className="text-center">
              <Link href="/batteries" className="block py-2 px-4 rounded-lg hover:bg-[#D4AF37] hover:text-white transition" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                Batteries
              </Link>
            </li>
            <li className="text-center col-span-1 sm:col-span-2">
              <Link href="/about" className="block py-2 px-4 rounded-lg hover:bg-[#D4AF37] hover:text-white transition" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                À propos de nous
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
