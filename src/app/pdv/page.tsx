"use client";

import dynamic from 'next/dynamic';

// Import the PDV component dynamically to ensure it only runs on the client-side
// and doesn't cause SSR hydration mismatch issues (since it uses react-router-dom)
const BarraPdvRoot = dynamic(
  () => import('@/components/barrapdv/BarraPdvRoot'),
  { ssr: false }
);

export default function PDVPage() {
  return <BarraPdvRoot />;
}
