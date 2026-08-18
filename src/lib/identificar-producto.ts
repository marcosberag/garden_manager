import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';

// Los mismos tipos que ofrece el selector de /products/new: la IA elige de una
// lista cerrada para que lo identificado encaje en el inventario sin arreglos.
export const TIPOS_PRODUCTO = [
  'Abono Universal',
  'Abono Específico',
  'Insecticida',
  'Fungicida',
  'Sustrato',
  'Herramienta',
  'Otro',
] as const;

export type ProductoIdentificado = {
  name: string;
  type: (typeof TIPOS_PRODUCTO)[number];
  description: string;
  frequency_days: number | null;
  motivo: string | null;
};

/**
 * Identifica un producto de jardinería a partir de una foto del envase. La
 * etiqueta suele traer la materia activa y la pauta del fabricante, que es la
 * mejor fuente posible para la frecuencia. Devuelve null si la imagen no
 * muestra un producto de jardinería.
 */
export async function identificarProducto(base64Image: string): Promise<ProductoIdentificado | null> {
  const { object } = await generateObject({
    model: modelo(),
    schema: z.object({
      es_producto: z.boolean().describe('true solo si la imagen muestra un producto de jardinería o fitosanitario (envase, etiqueta, saco...).'),
      name: z.string().describe('Nombre corto para el inventario: el comercial de la etiqueta o, si no se lee, el genérico de la materia activa. Ej: "Oxicloruro de cobre", "Aceite de Neem".'),
      type: z.enum(TIPOS_PRODUCTO).describe('Categoría del producto.'),
      description: z.string().describe('Una o dos frases en español: materia activa o composición y para qué sirve, según la etiqueta.'),
      frequency_days: z.number().describe('Cada cuántos días se aplica. Prioridad: la pauta que indique la propia etiqueta; si no se lee, la habitual del producto. 0 si no es de aplicación periódica o no se puede saber.'),
      motivo: z.string().describe('Una frase en español explicando de dónde sale la pauta (de la etiqueta o del uso habitual).'),
    }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Eres un ingeniero agrónomo. Identifica el producto de jardinería de esta foto leyendo su etiqueta con atención (nombre comercial, materia activa, dosis y pauta de aplicación si aparecen).`,
          },
          { type: 'image', image: base64Image },
        ],
      },
    ],
    temperature: 0.2,
  });

  if (!object.es_producto) return null;

  const dias = Math.round(object.frequency_days);
  const pautaValida = dias >= 1 && dias <= 365;

  return {
    name: object.name,
    type: object.type,
    description: object.description,
    frequency_days: pautaValida ? dias : null,
    motivo: pautaValida ? object.motivo : null,
  };
}
