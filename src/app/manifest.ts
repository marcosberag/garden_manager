import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Brotes — Gestión de jardín',
    short_name: 'Brotes',
    description: 'Tu jardín, con seguimiento inteligente de plantas y tratamientos.',
    start_url: '/',
    display: 'standalone',
    background_color: '#e7eae6',
    theme_color: '#09352e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
