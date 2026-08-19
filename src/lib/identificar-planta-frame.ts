import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';

// Contexto que acompaña a cada fotograma del recorrido: lo que ya se detectó
// en este paseo (para no registrar la misma planta dos veces) y lo que ya
// consta en el jardín (para reconocer plantas registradas en vez de duplicarlas).
export type ContextoRecorrido = {
  detectadasEnRecorrido: string[]; // especies ya vistas en este paseo
  plantasRegistradas: { nombre: string; especie: string | null }[];
};

export type DeteccionDeFrame = {
  hay_planta: boolean;
  especie: string;
  nombre_comun: string;
  confianza: 'alta' | 'media' | 'baja';
  ya_vista_en_recorrido: boolean;
  coincide_con_registrada: string | null;
  sintomas: string | null;
  motivo: string;
};

/**
 * Analiza un fotograma del recorrido por el jardín. Decide si hay una planta
 * protagonista (no césped de fondo ni maceta lejana), la identifica, avisa si
 * parece la misma que una detección anterior o que una planta ya registrada,
 * y anota síntomas visibles de enfermedad si los hay.
 */
export async function identificarPlantaEnFrame(
  base64Image: string,
  contexto: ContextoRecorrido,
): Promise<DeteccionDeFrame | null> {
  const registradas = contexto.plantasRegistradas
    .map(p => `- ${p.nombre}${p.especie ? ` (${p.especie})` : ''}`)
    .join('\n');
  const previas = contexto.detectadasEnRecorrido.join(', ');

  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        hay_planta: z.boolean().describe('true solo si hay una planta clara y protagonista del encuadre (no césped de fondo, no vegetación lejana o borrosa).'),
        especie: z.string().describe('Especie o mejor estimación botánica en español. Ej: "Cupressus leylandii", "Rosal", "Phoenix canariensis".'),
        nombre_comun: z.string().describe('Nombre común corto en español. Ej: "Leylandi", "Palmera canaria".'),
        confianza: z.enum(['alta', 'media', 'baja']).describe('Cuánto fías la identificación: baja si la foto está movida, lejos o la especie es ambigua.'),
        ya_vista_en_recorrido: z.boolean().describe('true si es con toda probabilidad la MISMA planta (o un ejemplar indistinguible pegado al anterior) que una de las especies ya detectadas en este recorrido.'),
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

Plantas ya registradas en el jardín:
${registradas || '(ninguna)'}

Especies ya detectadas en este recorrido: ${previas || '(ninguna)'}

Sé conservador: si el encuadre no tiene una planta protagonista y razonablemente nítida, hay_planta = false.`,
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
