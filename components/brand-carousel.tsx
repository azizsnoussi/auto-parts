"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from "@/components/ui/button"

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

export function BrandCarousel() {
  const [startIndex, setStartIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const visibleBrands = 7 // Number of brands visible at once

  const handlePrevious = () => {
    if (!isAnimating) {
      setIsAnimating(true)
      setStartIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : brands.length - 1))
    }
  }

  const handleNext = () => {
    if (!isAnimating) {
      setIsAnimating(true)
      setStartIndex((prevIndex) => (prevIndex < brands.length - 1 ? prevIndex + 1 : 0))
    }
  }

  // Handle mouse wheel horizontal scrolling (left/right)
  const handleWheel = (event: WheelEvent) => {
    if (isAnimating) return; // Prevent wheel action during animation

    // Detect horizontal scroll (left/right)
    if (event.deltaX > 0) {
      // Scroll right, move to next item
      handleNext();
    } else if (event.deltaX < 0) {
      // Scroll left, move to previous item
      handlePrevious();
    }

    event.preventDefault(); // Prevent page scroll
  }

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.5s ease-in-out'
      containerRef.current.style.transform = `translateX(-${startIndex * (100 / visibleBrands)}%)`
      
      const transitionEndHandler = () => setIsAnimating(false)
      containerRef.current.addEventListener('transitionend', transitionEndHandler)

      // Add the mouse wheel event listener
      containerRef.current.addEventListener('wheel', handleWheel, { passive: false })
      
      return () => {
        containerRef.current?.removeEventListener('transitionend', transitionEndHandler)
        containerRef.current?.removeEventListener('wheel', handleWheel)
      }
    }
  }, [startIndex, isAnimating])

  return (
    <Card className="bg-[#D4AF37] p-8 relative overflow-hidden rounded-3xl shadow-lg"> 
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="absolute left-2 z-10" onClick={handlePrevious} disabled={isAnimating}>
          <ChevronLeft className="h-8 w-8 text-white" />
        </Button>
        <div className="flex-1 overflow-hidden">
          <div 
            ref={containerRef} 
            className="flex transition-transform duration-500 ease-in-out"
            style={{ width: `${(brands.length / visibleBrands) * 100}%` }}
          >
            {brands.concat(brands.slice(0, visibleBrands - 1)).map((brand, index) => (
              <div 
                key={`${brand.name}-${index}`} 
                className="flex-shrink-0"
                style={{ width: `${100 / visibleBrands}%` }}
              >
                <div className="w-200 h-240 mx-auto rounded-full flex items-center justify-center">
                  <Image
                    src={brand.logo || "/placeholder.svg"}
                    alt={brand.name}
                    width={300}
                    height={300}
                    className="object-contain p-2"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="absolute right-2 z-10" onClick={handleNext} disabled={isAnimating}>
          <ChevronRight className="h-8 w-8 text-white" />
        </Button>
      </div>
    </Card>
  )
}
