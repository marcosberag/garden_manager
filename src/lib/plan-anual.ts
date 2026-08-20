import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';

export type PropuestaPlan = {
  fecha: string;
  tipo: 'Fumigación' | 'Poda' | 'Abono' | 'Otro';
  planta: string | null;
  producto: string | null;
  titulo: string;
  motivo: string;
  frequency_days: number | null;
  hasta: string | null;
};

export type ContextoPlan = {
  hoy: string; // AAAA-MM-DD
  coordenadas: { lat: number; lng: number } | null;
  plantas: { nombre: string; especie: string | null }[];
  inventario: { nombre: string; tipo: string; descripcion: string | null }[];
  historial: string[]; // líneas resumen de tratamientos reales
  programado: string[]; // líneas resumen de lo ya programado (no duplicar)
  indicaciones: string | null; // plagas y problemas que el usuario declara
};

/**
 * Plan preventivo anual del jardín: qué intervenciones estacionales conviene
 * programar en los próximos 12 meses. Regla de oro: solo se planifica contra
 * problemas con evidencia (historial, notas) o declarados por el usuario —
 * nunca contra plagas supuestas.
 */
export async function generarPlanAnual(contexto: ContextoPlan): Promise<PropuestaPlan[] | null> {
  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        propuestas: z.array(z.object({
          fecha: z.string().describe('Fecha propuesta AAAA-MM-DD, dentro de los próximos 12 meses y posterior a hoy.'),
          tipo: z.enum(['Fumigación', 'Poda', 'Abono', 'Otro']),
          planta: z.string().nullable().describe('Nombre EXACTO de una planta de la lista, o null si es una tarea general del jardín.'),
          producto: z.string().nullable().describe('Nombre EXACTO de un producto del inventario si procede usarlo; null si no hay producto adecuado.'),
          titulo: z.string().describe('Qué hacer, en pocas palabras. Ej: "Cobre preventivo antes de las lluvias".'),
          motivo: z.string().describe('Por qué esa intervención y por qué en esa fecha, en una o dos frases.'),
          frequency_days: z.number().nullable().describe('Si la intervención es una tanda de varias aplicaciones, cada cuántos días; null si es puntual.'),
          hasta: z.string().nullable().describe('Hasta cuándo mantener la tanda si aplica; null si es puntual.'),
        })).describe('Como mucho 10 propuestas, las que de verdad aporten.'),
      }),
      prompt: `Eres un ingeniero agrónomo planificando el año de un jardín doméstico en España.
Hoy es ${contexto.hoy}.${contexto.coordenadas ? ` El jardín está aproximadamente en lat ${contexto.coordenadas.lat.toFixed(2)}, lng ${contexto.coordenadas.lng.toFixed(2)} — ten en cuenta el clima de esa zona.` : ''}

Plantas del jardín:
${contexto.plantas.map(p => `- ${p.nombre}${p.especie ? ` (${p.especie})` : ''}`).join('\n') || '(ninguna)'}

Inventario de productos:
${contexto.inventario.map(p => `- ${p.nombre} (${p.tipo})${p.descripcion ? `: ${p.descripcion}` : ''}`).join('\n') || '(vacío)'}

Historial real de tratamientos:
${contexto.historial.join('\n') || '(sin historial)'}

Ya programado (NO lo dupliques):
${contexto.programado.join('\n') || '(nada)'}

Problemas y plagas declarados por el dueño (fuente de máxima autoridad):
${contexto.indicaciones?.trim() || '(no ha indicado nada)'}

Propón el plan preventivo de los próximos 12 meses: tratamientos estacionales, abonados y podas con su fecha.

REGLAS ESTRICTAS:
- Planifica SOLO contra problemas con evidencia: los que aparezcan en el historial, en las notas o en lo que declara el dueño. NO inventes plagas: si el dueño dice que su plaga de palmeras es Paysandisia archon, no planifiques contra picudo rojo, y viceversa.
- Comprueba que la enfermedad encaje con la especie antes de planificar contra ella. El oídio, por ejemplo, es de plantas de hoja (rosales, cucurbitáceas, vid); las coníferas como el ciprés de Leyland no lo padecen — a ellas les afecta el chancro por Seiridium, el amarronamiento por Phytophthora, la seca por Pestalotiopsis o el pulgón del ciprés (Cinara cupressi). Si lo que declara el dueño no cuadra con esa planta, NO le sigas la corriente: dilo en el motivo y propón lo que de verdad explique los síntomas.
- Prefiere productos del inventario; si ninguno sirve, deja producto en null y dilo en el motivo.
- Fechas realistas para el clima español y la fenología de cada especie (el cobre preventivo va antes de las lluvias de otoño; el abonado, al arrancar la primavera...).
- Pocas propuestas y buenas: como mucho 10. Nada de rellenar por rellenar.`,
      temperature: 0.3,
    });

    const hoy = contexto.hoy;
    return object.propuestas
      .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) && p.fecha > hoy)
      .slice(0, 10)
      .map(p => ({
        ...p,
        frequency_days: p.frequency_days && p.frequency_days >= 1 && p.frequency_days <= 365 ? Math.round(p.frequency_days) : null,
      }));
  } catch (e) {
    console.error('No se pudo generar el plan anual:', e);
    return null;
  }
}
