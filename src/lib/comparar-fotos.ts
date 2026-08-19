import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';

export type Evolucion = 'mejora' | 'igual' | 'empeora' | 'no_comparable';

export type VeredictoEvolucion = {
  evolucion: Evolucion;
  veredicto: string;
};

/**
 * Compara la foto nueva de una planta con la anterior y dicta veredicto:
 * ¿el tratamiento está funcionando? Es la respuesta con pruebas a la pregunta
 * «¿siguen los síntomas?» que hace el WhatsApp diario.
 */
export async function compararFotosPlanta(
  fotoAnterior: string,
  fotoNueva: string,
  contexto: {
    planta: { nombre: string; especie: string | null };
    notaAnterior: string | null;
    fechaAnterior: string | null;
    diagnosticoNuevo: string | null;
  },
): Promise<VeredictoEvolucion | null> {
  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        evolucion: z.enum(['mejora', 'igual', 'empeora', 'no_comparable']).describe('Comparación del estado sanitario entre ambas fotos. "no_comparable" si las fotos no muestran la misma zona o no permiten comparar con honestidad.'),
        veredicto: z.string().describe('Una o dos frases en español, concretas y accionables: qué ha cambiado entre las fotos y qué implica para el tratamiento (mantener, acortar pauta, dar por terminado...).'),
      }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Eres un ingeniero agrónomo siguiendo la evolución de una planta: ${contexto.planta.nombre}${contexto.planta.especie ? ` (${contexto.planta.especie})` : ''}.

La PRIMERA imagen es la foto anterior${contexto.fechaAnterior ? ` (${contexto.fechaAnterior})` : ''}${contexto.notaAnterior ? `, cuando se anotó: «${contexto.notaAnterior}»` : ''}.
La SEGUNDA imagen es la foto de hoy${contexto.diagnosticoNuevo ? `, con diagnóstico actual: «${contexto.diagnosticoNuevo}»` : ''}.

Compara el estado sanitario (manchas, amarronamiento, oídio, plaga, vigor) y di si mejora, sigue igual o empeora. Sé honesto: si las fotos no permiten comparar, dilo.`,
            },
            { type: 'image', image: fotoAnterior },
            { type: 'image', image: fotoNueva },
          ],
        },
      ],
      temperature: 0.2,
    });
    return object;
  } catch (e) {
    console.error('Error comparando fotos de la planta:', e);
    return null;
  }
}
