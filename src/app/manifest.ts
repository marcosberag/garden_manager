import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Brotes — Gestión de jardín',
    short_name: 'Brotes',
    description: 'Tu jardín, con seguimiento inteligente de plantas y tratamientos.',
    start_url: '/',
    display: 'standalone',
    background_color: '#e7eae6',
    theme_color: '#09352e',
    // El ?v=2 cambia la URL de los iconos para que Chrome refresque el icono
    // instalado y la pantalla de arranque (cacheaba aún el antiguo de Vercel).
    icons: [
      { src: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
