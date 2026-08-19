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

export type CasoTratamiento = {
  producto: { nombre: string; tipo?: string | null; descripcion?: string | null; dosis?: string | null };
  planta?: { nombre?: string | null; especie?: string | null } | null;
  metodo?: string | null;
  notas?: string | null;
  /** Dimensión real de lo tratado: metros del seto medidos en el mapa, o tamaño anotado. */
  dimension?: { metros?: number | null; tamano?: string | null } | null;
};

export type FrecuenciaDelCaso = {
  frequency_days: number;
  min_days: number | null;
  max_days: number | null;
  motivo: string;
  /** Hasta cuándo mantener las aplicaciones: época o condición de parada. */
  hasta: string | null;
  /** Dosis y caldo total si se puede calcular. Ej: "3 ml/L — unos 8 L de caldo para tus 18 m de seto". */
  dosis: string | null;
  /** De dónde sale la dosis: 'producto' (apuntada por el usuario), 'etiqueta' o 'general'. */
  dosis_fuente: 'producto' | 'etiqueta' | 'general' | null;
};

// Valores del selector de modo de aplicación del formulario de tratamiento.
const METODOS: Record<string, string> = {
  foliar: 'foliar, pulverizando las hojas',
  raiz: 'en la raíz, con el agua de riego',
  suelo: 'al suelo, incorporado',
};

export function textoDeMetodo(metodo?: string | null): string | null {
  if (!metodo) return null;
  return METODOS[metodo] ?? metodo;
}

/**
 * Pauta para un tratamiento concreto. A diferencia de deducirFrecuencia, que da
 * la pauta general del producto, aquí cuentan la planta, el modo de aplicación
 * (el cobre foliar no se repite igual que un fungicida al riego) y lo que el
 * usuario cuente en las notas (severidad, clima...). Devuelve null si la IA no
 * está disponible: el formulario se queda entonces con la pauta del producto.
 */
export async function frecuenciaSegunCaso(caso: CasoTratamiento): Promise<FrecuenciaDelCaso | null> {
  const lineas = [`- Producto: "${caso.producto.nombre}"${caso.producto.tipo ? ` (${caso.producto.tipo})` : ''}`];
  if (caso.producto.descripcion) lineas.push(`- Notas del producto: "${caso.producto.descripcion}"`);
  if (caso.producto.dosis?.trim()) lineas.push(`- Dosis apuntada en el producto (manda sobre cualquier otra fuente): "${caso.producto.dosis.trim()}"`);
  const planta = [caso.planta?.nombre, caso.planta?.especie].filter(Boolean).join(', ');
  if (planta) lineas.push(`- Planta tratada: ${planta}`);
  if (caso.dimension?.metros && caso.dimension.metros > 0) {
    lineas.push(`- Dimensión medida en el mapa: un seto/hilera de ${caso.dimension.metros.toFixed(0)} m de largo`);
  } else if (caso.dimension?.tamano?.trim()) {
    lineas.push(`- Tamaño anotado de la planta: "${caso.dimension.tamano.trim()}"`);
  }
  const metodo = textoDeMetodo(caso.metodo);
  if (metodo) lineas.push(`- Modo de aplicación: ${metodo}`);
  if (caso.notas?.trim()) lineas.push(`- Notas del usuario sobre este tratamiento: "${caso.notas.trim()}"`);

  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        frequency_days: z.number().describe('Cada cuántos días repetir ESTE tratamiento concreto. 0 si no procede repetirlo de forma periódica.'),
        min_days: z.number().describe('Límite inferior del rango habitual de la pauta, en días. 0 si no hay rango.'),
        max_days: z.number().describe('Límite superior del rango habitual de la pauta, en días. 0 si no hay rango.'),
        motivo: z.string().describe('Una o dos frases en español justificando la pauta para este caso: modo de aplicación, especie y severidad si se conocen. Sin repetir el nombre del producto.'),
        hasta: z.string().describe('Hasta cuándo mantener las aplicaciones, en pocas palabras: una condición de parada o época del año. Ej: "mientras haya síntomas", "hasta finales de octubre", "solo con humedad alta". Cadena vacía si de verdad no hay límite.'),
        dosis: z.string().describe('La dosis para este caso, corta y práctica. Si se conoce la dimensión, incluye el caldo total aproximado. Ej: "3 ml/L — prepara unos 8 L de caldo para los 18 m de seto". Cadena vacía si no se puede dar una dosis fiable.'),
        dosis_fuente: z.enum(['producto', 'etiqueta', 'general', 'ninguna']).describe('De dónde sale la dosis: "producto" si viene de la dosis apuntada en el producto, "etiqueta" si aparece en las notas/etiqueta del producto, "general" si es conocimiento agronómico general, "ninguna" si no hay dosis.'),
      }),
      prompt: `Eres un ingeniero agrónomo. Un usuario va a registrar este tratamiento en su jardín doméstico:
${lineas.join('\n')}

Indica cada cuántos días conviene repetirlo EN ESTE CASO CONCRETO, no la pauta genérica del producto:
- El modo de aplicación importa: una aplicación foliar no sigue la misma pauta que la misma materia activa al riego o al suelo.
- La especie importa: usa la pauta adecuada para esa planta si la conoces.
- Si las notas indican severidad ("hay bastante", "muy avanzado"...), acorta hacia el mínimo del rango habitual; si es un uso preventivo, alarga hacia el máximo.
Devuelve también el rango habitual (mínimo y máximo en días) para que el usuario pueda ajustar con criterio,
y hasta cuándo mantener las aplicaciones: los tratamientos no son para siempre. Indica la condición de parada
o la época del año en que dejan de tener sentido (fin de la temporada del hongo, desaparición de síntomas...).

Da también la DOSIS, con esta prioridad estricta de fuentes:
1. La dosis apuntada en el producto (a veces la dio el vivero y no viene en el envase): si existe, es LA dosis.
2. La que aparezca en las notas/etiqueta del producto.
3. Solo si no hay nada de lo anterior, tu conocimiento general — y en ese caso sé conservador.
Si conoces la dimensión (metros de seto, tamaño), calcula el caldo total aproximado para esa dimensión.
No inventes dosis para productos comerciales que no conozcas: mejor cadena vacía que una dosis errónea.`,
      temperature: 0.2,
    });

    const dias = Math.round(object.frequency_days);
    if (dias < MIN_DIAS || dias > MAX_DIAS) return null;

    const min = Math.round(object.min_days);
    const max = Math.round(object.max_days);
    // El rango solo se enseña si es coherente con la recomendación.
    const rangoValido = min >= MIN_DIAS && max <= MAX_DIAS && min <= dias && dias <= max && min < max;

    const dosis = object.dosis?.trim() || null;
    return {
      frequency_days: dias,
      min_days: rangoValido ? min : null,
      max_days: rangoValido ? max : null,
      motivo: object.motivo,
      hasta: object.hasta?.trim() || null,
      dosis,
      dosis_fuente: dosis && object.dosis_fuente !== 'ninguna' ? object.dosis_fuente : null,
    };
  } catch (error) {
    console.error('[frecuencias] Fallo calculando la pauta del caso, se mantiene la del producto:', error);
    return null;
  }
}

// Versión corta del modo, para incrustarla en las notas del evento.
const ETIQUETAS_METODO: Record<string, string> = {
  foliar: 'foliar',
  raiz: 'en la raíz',
  suelo: 'al suelo',
};

export function etiquetaDeMetodo(metodo?: string | null): string | null {
  if (!metodo) return null;
  return ETIQUETAS_METODO[metodo] ?? metodo;
}
