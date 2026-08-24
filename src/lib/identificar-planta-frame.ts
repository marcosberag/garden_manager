import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';

// Contexto que acompaña a cada fotograma: lo que ya consta en el jardín, para
// reconocer plantas registradas en vez de duplicarlas. Agrupar las fotos de un
// mismo ejemplar NO es cosa del modelo: lo decide el cliente con especie, GPS
// y tiempo (src/lib/recorrido.ts), que es determinista y corregible a mano.
export type ContextoRecorrido = {
  plantasRegistradas: { nombre: string; especie: string | null }[];
};

export type DeteccionDeFrame = {
  hay_planta: boolean;
  especie: string;
  nombre_comun: string;
  alternativa: string | null;
  confianza: 'alta' | 'media' | 'baja';
  coincide_con_registrada: string | null;
  sintomas: string | null;
  motivo: string;
};

/**
 * Analiza un fotograma del recorrido por el jardín. Decide si hay una planta
 * protagonista (no césped de fondo ni maceta lejana), la identifica —con una
 * segunda opción cuando duda—, avisa si parece una planta ya registrada y
 * anota síntomas visibles de enfermedad si los hay.
 */
export async function identificarPlantaEnFrame(
  base64Image: string,
  contexto: ContextoRecorrido,
): Promise<DeteccionDeFrame | null> {
  const registradas = contexto.plantasRegistradas
    .map(p => `- ${p.nombre}${p.especie ? ` (${p.especie})` : ''}`)
    .join('\n');

  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        hay_planta: z.boolean().describe('true solo si hay una planta clara y protagonista del encuadre (no césped de fondo, no vegetación lejana o borrosa).'),
        especie: z.string().describe('Especie o mejor estimación botánica en español. Ej: "Cupressus leylandii", "Rosal", "Phoenix canariensis".'),
        nombre_comun: z.string().describe('Nombre común corto en español. Ej: "Leylandi", "Palmera canaria".'),
        alternativa: z.string().nullable().describe('Si dudas seriamente entre dos especies, la segunda opción en nombre común (ej: "Laurel"); null si no hay duda razonable.'),
        confianza: z.enum(['alta', 'media', 'baja']).describe('Cuánto fías la identificación: baja si la foto está movida, lejos o la especie es ambigua.'),
        coincide_con_registrada: z.string().nullable().describe('Si parece corresponder a una planta YA registrada en el jardín (por especie y contexto), su nombre EXACTO de la lista; null si no.'),
        sintomas: z.string().nullable().describe('Síntomas visibles de enfermedad o plaga (amarronamiento, oídio, hojas amarillas, picaduras...) en una frase; null si se ve sana.'),
        motivo: z.string().describe('Una frase en español con la pista principal de la identificación.'),
      }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Eres un botánico haciendo el inventario de un jardín doméstico en España. Analiza este fotograma de un recorrido con la cámara.

Plantas ya registradas en el jardín (dan contexto de qué especies son probables aquí):
${registradas || '(ninguna)'}

Sé conservador en dos sentidos: si el encuadre no tiene una planta protagonista y razonablemente nítida, hay_planta = false; y si dudas entre dos especies parecidas (lavanda/romero, laurel/adelfa...), da la más probable como especie y la otra en "alternativa" en vez de callarte la duda.`,
            },
            { type: 'image', image: base64Image },
          ],
        },
      ],
      temperature: 0.2,
    });

    return object;
  } catch (e) {
    console.error('Error analizando el fotograma del recorrido:', e);
    return null;
  }
}
