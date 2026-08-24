import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // El recorrido guarda cada planta con sus fotos en una server action, y
      // varias capturas JPEG en base64 superan de sobra el 1 MB por defecto:
      // el guardado fallaba con un error genérico en cuanto había más de una
      // o dos fotos.
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
