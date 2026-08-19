import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';

export type ProductoDisponible = {
  id: string;
  name: string;
  type: string;
  description: string | null;
};

export type Diagnostico = {
  es_planta: boolean;
  enferma: boolean;
  diagnostico: string;
  gravedad: 'leve' | 'moderada' | 'grave' | null;
  descripcion: string;
  tratamiento: string;
  producto_del_inventario: string | null;
  tipo_de_producto_sugerido: string | null;
  metodo: 'foliar' | 'raiz' | 'suelo' | null;
  frequency_days: number | null;
  duracion: string | null;
  confianza: 'alta' | 'media' | 'baja';
};

/**
 * Diagnostica una planta a partir de una foto de la zona afectada. Devuelve el
 * diagnóstico y una recomendación de tratamiento completa (producto — del
 * inventario del usuario si alguno sirve —, modo de aplicación, frecuencia y
 * duración), lista para encadenar con el registro de tratamientos.
 */
export async function diagnosticarPlanta(
  base64Image: string,
  contexto: {
    planta: { nombre: string; especie: string | null; descripcion: string | null };
    productos: ProductoDisponible[];
    notas: string | null;
  },
): Promise<Diagnostico | null> {
  const inventario = contexto.productos
    .map(p => `- ${p.name} (${p.type})${p.description ? `: ${p.description}` : ''}`)
    .join('\n');

  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        es_planta: z.boolean().describe('true solo si la imagen muestra una planta o una parte de ella con detalle suficiente para valorarla.'),
        enferma: z.boolean().describe('true si se aprecian síntomas de enfermedad, plaga o carencia.'),
        diagnostico: z.string().describe('El diagnóstico en pocas palabras. Ej: "Oídio", "Amarronamiento por Phytophthora", "Pulgón", "Sana".'),
        gravedad: z.enum(['leve', 'moderada', 'grave']).nullable().describe('Gravedad de lo observado; null si está sana.'),
        descripcion: z.string().describe('Dos o tres frases en español: qué síntomas se ven en la foto y qué los causa.'),
        tratamiento: z.string().describe('La recomendación de tratamiento en una o dos frases prácticas. Si está sana, recomendación de cuidado preventivo o "Ninguno necesario".'),
        producto_del_inventario: z.string().nullable().describe('Si alguno de los productos del inventario listado sirve para este tratamiento, su nombre EXACTO tal como aparece en la lista; null si ninguno encaja.'),
        tipo_de_producto_sugerido: z.string().nullable().describe('Si ningún producto del inventario sirve, qué tipo de producto comprar (ej: "fungicida sistémico con fosetil-Al"); null si no hace falta.'),
        metodo: z.enum(['foliar', 'raiz', 'suelo']).nullable().describe('Modo de aplicación recomendado para el tratamiento; null si no aplica.'),
        frequency_days: z.number().nullable().describe('Cada cuántos días repetir la aplicación según el caso y su gravedad; null si no aplica.'),
        duracion: z.string().nullable().describe('Hasta cuándo mantener el tratamiento (condición de parada o duración). Ej: "hasta 2-3 semanas sin síntomas nuevos". null si no aplica.'),
        confianza: z.enum(['alta', 'media', 'baja']).describe('Cuánto fías el diagnóstico con lo que se ve en la foto.'),
      }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Eres un ingeniero agrónomo diagnosticando una planta de un jardín doméstico en España a partir de una foto.

Planta: ${contexto.planta.nombre}${contexto.planta.especie ? ` (${contexto.planta.especie})` : ''}${contexto.planta.descripcion ? ` — ${contexto.planta.descripcion}` : ''}
${contexto.notas ? `Lo que cuenta el dueño: ${contexto.notas}` : ''}

Inventario de productos del usuario:
${inventario || '(vacío)'}

Observa la foto con atención (color y textura de hojas, manchas, polvo blanco, picaduras, insectos...) y da el diagnóstico y el plan de tratamiento. Prefiere siempre un producto del inventario si alguno sirve de verdad; no fuerces uno que no encaje.`,
            },
            { type: 'image', image: base64Image },
          ],
        },
      ],
      temperature: 0.2,
    });

    if (!object.es_planta) return null;

    // Frecuencia fuera de rango: mejor sin pauta que con una absurda.
    const dias = object.frequency_days != null ? Math.round(object.frequency_days) : null;
    return { ...object, frequency_days: dias != null && dias >= 1 && dias <= 365 ? dias : null };
  } catch (e) {
    console.error('Error diagnosticando la planta:', e);
    return null;
  }
}
