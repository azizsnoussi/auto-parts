'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-gray-900">
      <h1 className="text-7xl font-bold text-[#D4AF37]">404</h1>
      <h2 className="text-2xl font-semibold mt-4">Oups ! Page Introuvable</h2>
      <p className="mt-2 text-gray-600 text-center max-w-md">
        La page que vous recherchez a peut-être été supprimée, renommée ou est temporairement indisponible.
      </p>
      <Link href="/">
        <Button className="mt-6 px-6 py-3 bg-[#D4AF37] text-white rounded-lg hover:bg-[#b8962e] transition">
          Retour à l'accueil
        </Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
