/**
 * Reglas del recorrido: cuándo dos fotos son la misma planta.
 *
 * Un seto de 30 metros se fotografía cacho a cacho, y cada cacho no puede
 * convertirse en una planta nueva. Pero dos moreras en puntas opuestas del
 * jardín tampoco pueden fundirse en una sola por compartir especie. La regla:
 * misma especie + poco tiempo + poca distancia = mismo ejemplar; en cuanto te
 * alejas o dejas pasar un rato, es otro. Y en la revisión siempre se puede
 * separar o reagrupar a mano.
 */

/** Segundos que pueden pasar entre dos fotos del mismo ejemplar. */
export const VENTANA_MISMA_PLANTA_MS = 4 * 60 * 1000;

/** Metros a partir de los cuales una misma especie cuenta como otro ejemplar. */
export const RADIO_MISMA_PLANTA_M = 15;

export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function normalizaEspecie(s: string | null | undefined): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export type GrupoCandidato = {
  key: string;
  especie: string;
  ultimaFotoTs: number;
  lat: number | null;
  lng: number | null;
};

/**
 * A qué detección de este recorrido pertenece la foto recién analizada, o null
 * si es un ejemplar nuevo. Se compara solo con la ÚLTIMA detección de esa
 * especie: si ya te alejaste de ella y vuelves más tarde, es razonable pensar
 * que es otra (y si no, en la revisión se corrige con un toque).
 */
export function grupoParaFoto(
  detecciones: GrupoCandidato[],
  especie: string,
  pos: { lat: number; lng: number } | null,
  ahora: number,
): string | null {
  const objetivo = normalizaEspecie(especie);
  if (!objetivo) return null;

  const candidatas = detecciones.filter(d => normalizaEspecie(d.especie) === objetivo);
  if (candidatas.length === 0) return null;
  const ultima = candidatas[candidatas.length - 1];

  if (ahora - ultima.ultimaFotoTs > VENTANA_MISMA_PLANTA_MS) return null;

  // Con GPS en las dos: manda la distancia. Sin GPS no hay forma de separar
  // ejemplares, así que pesa la cercanía en el tiempo.
  if (pos && ultima.lat != null && ultima.lng != null) {
    return distanciaMetros(pos, { lat: ultima.lat, lng: ultima.lng }) <= RADIO_MISMA_PLANTA_M
      ? ultima.key
      : null;
  }
  return ultima.key;
}

/**
 * Nombre para un ejemplar nuevo cuando ya hay otros de su especie en el
 * recorrido: «Morera», «Morera 2», «Morera 3»… Sin esto, dos moreras serían
 * indistinguibles en la lista y en el mapa.
 */
export function nombreParaNuevo(nombreBase: string, especie: string, detecciones: { especie: string }[]): string {
  const iguales = detecciones.filter(d => normalizaEspecie(d.especie) === normalizaEspecie(especie)).length;
  return iguales === 0 ? nombreBase : `${nombreBase} ${iguales + 1}`;
}
