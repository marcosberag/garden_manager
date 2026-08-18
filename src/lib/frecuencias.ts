import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';

// Pauta de reserva por tipo de producto, para cuando la IA no está disponible o
// devuelve un disparate. Los tipos son los del selector de /products/new.
const POR_TIPO: Record<string, number> = {
  'Insecticida': 14,
  'Fungicida': 21,
  'Abono Universal': 30,
  'Abono Específico': 21,
};

// Un sustrato o una herramienta no se "aplican" cada X días.
const SIN_PAUTA = ['Sustrato', 'Herramienta'];

const MIN_DIAS = 1;
const MAX_DIAS = 365;

export type Frecuencia = {
  frequency_days: number | null;
  motivo: string | null;
};

export function frecuenciaPorTipo(tipo: string): Frecuencia {
  if (SIN_PAUTA.includes(tipo)) {
    return { frequency_days: null, motivo: null };
  }
  const dias = POR_TIPO[tipo];
  return dias
    ? { frequency_days: dias, motivo: `Pauta habitual para ${tipo.toLowerCase()}` }
    : { frequency_days: null, motivo: null };
}

/**
 * Deduce cada cuántos días se aplica un producto. Se llama una sola vez, al
 * guardarlo, y el resultado queda en el propio producto: así registrar un
 * tratamiento no obliga a saberse la pauta de memoria ni a esperar a la IA.
 */
export async function deducirFrecuencia(
  nombre: string,
  tipo: string,
  descripcion?: string | null
): Promise<Frecuencia> {
  if (SIN_PAUTA.includes(tipo)) {
    return { frequency_days: null, motivo: null };
  }

  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        frequency_days: z
          .number()
          .describe('Cada cuántos días se aplica el producto en un uso normal de mantenimiento. 0 si no es un producto que se aplique de forma periódica.'),
        motivo: z
          .string()
          .describe('Explicación de una sola frase, en español, de por qué esa pauta. Sin repetir el nombre del producto.'),
      }),
      prompt: `Eres un ingeniero agrónomo. Un usuario tiene este producto en su inventario de jardinería:
- Nombre: "${nombre}"
- Tipo: "${tipo}"${descripcion ? `\n- Notas del usuario: "${descripcion}"` : ''}

Indica cada cuántos días se aplica en un uso normal de mantenimiento preventivo en jardín doméstico.
Usa la pauta real del producto si lo conoces (por ejemplo, el aceite de neem preventivo se aplica cada 14 días).
Si no es un producto de aplicación periódica, devuelve 0.`,
      temperature: 0.2,
    });

    const dias = Math.round(object.frequency_days);

    // La IA puede devolver 0, un número negativo o "cada 3 años": fuera de rango
    // preferimos la pauta por tipo antes que programar tratamientos absurdos.
    if (dias < MIN_DIAS || dias > MAX_DIAS) {
      return dias === 0 ? { frequency_days: null, motivo: null } : frecuenciaPorTipo(tipo);
    }

    return { frequency_days: dias, motivo: object.motivo };
  } catch (error) {
    console.error(`[frecuencias] Fallo deduciendo la pauta de "${nombre}", se usa la del tipo:`, error);
    return frecuenciaPorTipo(tipo);
  }
}

type EventoConFrecuencia = { frequency_days?: number | null; notes?: string | null };

/**
 * Frecuencia con la que se programó una tarea. Los eventos creados antes de que
 * existiera la columna la llevan escrita como "[FREQ:15]" dentro de las notas:
 * se sigue leyendo de ahí como respaldo, pero ya no se escribe en eventos nuevos.
 */
export function leerFrecuencia(evento: EventoConFrecuencia): number {
  if (evento.frequency_days && evento.frequency_days > 0) {
    return evento.frequency_days;
  }
  const etiqueta = evento.notes?.match(/\[FREQ:(\d+)\]/);
  return etiqueta ? parseInt(etiqueta[1], 10) : 0;
}
