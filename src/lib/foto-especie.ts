// Foto representativa de una especie, sacada de Wikipedia (es primero, en de
// respaldo). Es la imagen por defecto del pin cuando la planta aún no tiene
// foto real; no se persiste — la caché de fetch de Next la guarda un mes.

type PaginaWiki = { thumbnail?: { source?: string } };

export async function fotoDeEspecie(especie?: string | null, nombre?: string | null): Promise<string | null> {
  const consulta = (especie || nombre || '').trim();
  if (!consulta) return null;

  for (const dominio of ['es.wikipedia.org', 'en.wikipedia.org']) {
    try {
      const url = `https://${dominio}/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(consulta)}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=300&format=json`;
      const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
      if (!res.ok) continue;
      const data = await res.json();
      const paginas = data?.query?.pages as Record<string, PaginaWiki> | undefined;
      const primera = paginas ? Object.values(paginas)[0] : null;
      const foto = primera?.thumbnail?.source;
      if (foto) return foto;
    } catch {
      // Sin red o sin resultado: se prueba el siguiente dominio.
    }
  }
  return null;
}
