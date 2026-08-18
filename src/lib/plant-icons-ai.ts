import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';
import { CATEGORIAS, categoriaDeEspecie, esCategoriaValida, type CategoriaPlanta } from '@/lib/plant-icons';

/**
 * Categoría de icono de una planta. Primero las reglas de texto, que resuelven
 * la mayoría al instante; solo lo que no encaje llega a la IA, que elige de una
 * lista cerrada. Nunca falla: si la IA no responde, cae en "generica".
 */
export async function resolverCategoria(
  especie?: string | null,
  nombre?: string | null
): Promise<CategoriaPlanta> {
  const porReglas = categoriaDeEspecie(especie, nombre);
  if (porReglas) return porReglas;

  const texto = `${especie || ''} ${nombre || ''}`.trim();
  if (!texto) return 'generica';

  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        categoria: z.enum(CATEGORIAS).describe('Categoría visual que mejor representa la planta'),
      }),
      prompt: `Clasifica esta planta de jardín en una sola categoría visual: "${texto}".
Usa "generica" solo si no puedes deducir de qué tipo de planta se trata.`,
      temperature: 0,
    });
    return esCategoriaValida(object.categoria) ? object.categoria : 'generica';
  } catch (error) {
    console.error(`[plant-icons] No se pudo clasificar "${texto}":`, error);
    return 'generica';
  }
}
