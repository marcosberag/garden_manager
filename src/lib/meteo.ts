// Parte meteorológico para fumigar DE NOCHE (así se hace en este jardín): lo
// que importa es la lluvia y el viento de esta noche y de la madrugada — que
// lavarían un foliar recién aplicado —, no el calor del mediodía.
// Fuente: Open-Meteo, gratis y sin clave.

export type ParteNocturno = {
  resumen: string; // línea lista para el WhatsApp
  buenaNoche: boolean;
};

/** Centro aproximado de un geojson (media de todas sus coordenadas). */
export function centroDeGeojson(geojsonTexto?: string | null): { lat: number; lng: number } | null {
  if (!geojsonTexto) return null;
  try {
    const geo = JSON.parse(geojsonTexto);
    let sumaLat = 0, sumaLng = 0, n = 0;
    const recorre = (nodo: unknown) => {
      if (!Array.isArray(nodo)) {
        if (nodo && typeof nodo === 'object') Object.values(nodo).forEach(recorre);
        return;
      }
      if (nodo.length >= 2 && typeof nodo[0] === 'number' && typeof nodo[1] === 'number') {
        sumaLng += nodo[0]; // GeoJSON va en [lng, lat]
        sumaLat += nodo[1];
        n += 1;
        return;
      }
      nodo.forEach(recorre);
    };
    recorre(geo);
    return n > 0 ? { lat: sumaLat / n, lng: sumaLng / n } : null;
  } catch {
    return null;
  }
}

export async function parteNocturnoFumigacion(lat: number, lng: number): Promise<ParteNocturno | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=precipitation,precipitation_probability,wind_speed_10m,temperature_2m` +
      `&forecast_days=3&timezone=auto`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const horas: string[] = data?.hourly?.time || [];
    const lluvia: number[] = data?.hourly?.precipitation || [];
    const probabilidad: number[] = data?.hourly?.precipitation_probability || [];
    const viento: number[] = data?.hourly?.wind_speed_10m || [];
    const temperatura: number[] = data?.hourly?.temperature_2m || [];
    if (horas.length === 0) return null;

    const hoy = horas[0]?.slice(0, 10);
    const manana = new Date(`${hoy}T12:00:00`);
    manana.setDate(manana.getDate() + 1);
    const mananaStr = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, '0')}-${String(manana.getDate()).padStart(2, '0')}`;

    // Índices de cada franja. La ventana de aplicación es esta noche (20-02 h);
    // el secado, la madrugada y mañana siguientes (02-14 h del día después).
    const enFranja = (dia: string, desde: number, hasta: number) => (t: string, i: number) => {
      const [d, h] = [t.slice(0, 10), parseInt(t.slice(11, 13), 10)];
      if (desde <= hasta) return d === dia && h >= desde && h <= hasta ? i : -1;
      // Franja que cruza medianoche: parte final del día + parte inicial del siguiente
      if (d === dia && h >= desde) return i;
      const sig = new Date(`${dia}T12:00:00`); sig.setDate(sig.getDate() + 1);
      const sigStr = `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, '0')}-${String(sig.getDate()).padStart(2, '0')}`;
      return d === sigStr && h <= hasta ? i : -1;
    };
    const indices = (dia: string, desde: number, hasta: number) =>
      horas.map(enFranja(dia, desde, hasta)).filter(i => i >= 0);

    const ventana = indices(hoy, 20, 2);       // esta noche
    const secado = indices(mananaStr, 3, 14);  // madrugada y mañana siguientes
    const ventanaManana = indices(mananaStr, 20, 2); // mañana por la noche

    const suma = (idx: number[], serie: number[]) => idx.reduce((s, i) => s + (serie[i] || 0), 0);
    const maximo = (idx: number[], serie: number[]) => idx.reduce((m, i) => Math.max(m, serie[i] || 0), 0);

    const mmNoche = suma(ventana, lluvia);
    const probNoche = maximo(ventana, probabilidad);
    const mmSecado = suma(secado, lluvia);
    const mmMananaNoche = suma(ventanaManana, lluvia);
    const probMananaNoche = maximo(ventanaManana, probabilidad);
    const vientoNoche = Math.round(maximo(ventana, viento));
    const temp22 = ventana.length > 0 ? Math.round(temperatura[ventana[Math.min(2, ventana.length - 1)]] ?? temperatura[ventana[0]]) : null;

    const llueveNoche = mmNoche >= 0.3 || probNoche >= 55;
    const llueveSecado = mmSecado >= 1;
    const llueveMananaNoche = mmMananaNoche >= 0.3 || probMananaNoche >= 55;
    const ventoso = vientoNoche >= 20;

    let resumen: string;
    let buenaNoche = false;
    if (llueveNoche) {
      resumen = `🌧️ Esta noche llueve (~${mmNoche.toFixed(1)} mm): mejor no fumigar. ${llueveMananaNoche ? 'Mañana por la noche también pinta lluvia.' : 'Mañana por la noche se espera seco.'}`;
    } else if (llueveSecado) {
      resumen = `🌧️ Esta noche no llueve, pero llegan lluvias de madrugada (~${mmSecado.toFixed(1)} mm): si fumigas foliar, cuenta con pocas horas de secado. ${llueveMananaNoche ? 'Mañana por la noche también pinta lluvia.' : 'Mañana por la noche se espera seco.'}`;
    } else if (ventoso) {
      resumen = `💨 Viento de ~${vientoNoche} km/h esta noche: mala noche para pulverizar, la deriva se lleva el producto.`;
    } else {
      buenaNoche = true;
      resumen = `🌙 Buena noche para fumigar: sin lluvia a la vista y viento flojo (~${vientoNoche} km/h)${temp22 != null ? `, ${temp22} °C a las 22 h` : ''}.`;
    }

    return { resumen, buenaNoche };
  } catch (e) {
    console.error('No se pudo consultar la previsión meteorológica:', e);
    return null;
  }
}
