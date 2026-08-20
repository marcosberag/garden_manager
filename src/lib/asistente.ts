import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';

export type EventoAsistente = {
  tipo: 'Fumigación' | 'Poda' | 'Abono' | 'Otro';
  fecha: string;
  nota: string;
  planta: string | null;
  producto: string | null;
  frequency_days: number | null;
};

export type ProductoAsistente = {
  nombre: string;
  tipo: string;
  descripcion: string | null;
};

export type PlantaAsistente = {
  nombre: string;
  especie: string | null;
};

export type EnlaceAsistente = 'inventario' | 'nuevo_producto' | 'nueva_planta' | 'nuevo_tratamiento' | 'recorrido' | 'ajustes';

export type PeticionInterpretada = {
  respuesta: string;
  eventos: EventoAsistente[];
  productos: ProductoAsistente[];
  plantas: PlantaAsistente[];
  enlaces: EnlaceAsistente[];
};

export type ContextoAsistente = {
  hoy: string; // AAAA-MM-DD
  plantas: { nombre: string; especie: string | null }[];
  inventario: { nombre: string; tipo: string }[];
  agenda: string[]; // líneas: próximos avisos y últimos registros
  previas: { pregunta: string; respuesta: string }[]; // turnos anteriores de esta conversación
};

/**
 * El oído del jardín: recibe una petición en lenguaje natural («he visto pulgón
 * en el rosal, anótalo», «he comprado un abono», «¿qué me recomiendas para…?»)
 * y decide qué registrar, qué contestar y a qué pantalla conviene enlazar.
 * Quien llama ejecuta después los registros contra la base de datos.
 */
export async function interpretarPeticion(texto: string, contexto: ContextoAsistente): Promise<PeticionInterpretada | null> {
  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        respuesta: z.string().describe('Tu contestación al dueño: una a tres frases, sin saludos. Si registras algo, confirma exactamente qué y para qué fecha; si es una consulta, responde concreto usando los datos del jardín.'),
        eventos: z.array(z.object({
          tipo: z.enum(['Fumigación', 'Poda', 'Abono', 'Otro']).describe('Una observación o detección va como "Otro".'),
          fecha: z.string().describe('AAAA-MM-DD. Hoy si cuenta algo ya ocurrido o visto; la fecha que pida si es un recordatorio futuro.'),
          nota: z.string().describe('Lo que cuenta el dueño, en limpio y breve. Sin corchetes.'),
          planta: z.string().nullable().describe('Nombre EXACTO de una planta de la lista, o null.'),
          producto: z.string().nullable().describe('Nombre EXACTO de un producto del inventario, o null.'),
          frequency_days: z.number().nullable().describe('Solo si el dueño pide expresamente repetición; si no, null.'),
        })).describe('Anotaciones o recordatorios que haya que apuntar en la agenda. Vacío si no procede.'),
        productos: z.array(z.object({
          nombre: z.string(),
          tipo: z.string().describe('Fungicida, Insecticida, Abono Universal, Abono Específico, Sustrato, Herramienta u Otro.'),
          descripcion: z.string().nullable(),
        })).describe('Productos nuevos que el dueño dice haber comprado, con los datos que dé. Vacío si no procede.'),
        plantas: z.array(z.object({
          nombre: z.string(),
          especie: z.string().nullable(),
        })).describe('Plantas nuevas que el dueño dice tener. Vacío si no procede.'),
        enlaces: z.array(z.enum(['inventario', 'nuevo_producto', 'nueva_planta', 'nuevo_tratamiento', 'recorrido', 'ajustes'])).describe('Pantallas que conviene ofrecerle. "inventario" es CONSULTAR lo que ya tiene; "nuevo_producto" es DAR DE ALTA uno que acaba de comprar. Vacío si no hace falta ninguna.'),
      }),
      prompt: `Eres el asistente del jardín de la app Brotes. El dueño te escribe peticiones cortas y tú decides: qué anotar en la agenda, qué dar de alta y qué contestar. Hoy es ${contexto.hoy}.

Plantas del jardín:
${contexto.plantas.map(p => `- ${p.nombre}${p.especie ? ` (${p.especie})` : ''}`).join('\n') || '(ninguna)'}

Inventario de productos:
${contexto.inventario.map(p => `- ${p.nombre} (${p.tipo})`).join('\n') || '(vacío)'}

Agenda — próximos avisos y últimos registros:
${contexto.agenda.join('\n') || '(vacía)'}
${contexto.previas.length > 0 ? `\nConversación previa de hoy:\n${contexto.previas.map(t => `Dueño: ${t.pregunta}\nTú: ${t.respuesta}`).join('\n')}\n` : ''}
Petición del dueño: «${texto}»

CÓMO ACTUAR:
1. Si cuenta algo que ha visto o hecho («he detectado pulgón en el rosal», «he podado el evónimo») → apúntalo como evento con fecha de hoy, ligado a la planta y al producto EXACTOS de las listas si los menciona. Una detección u observación va como tipo "Otro".
2. Si pide un recordatorio futuro («apúntame regar el sábado») → evento con esa fecha.
3. Si ha comprado un producto → dalo de alta con lo que diga. Si no da ni el nombre, no inventes: ofrece el enlace "nuevo_producto" para que lo escanee.
4. Si tiene una planta nueva → dala de alta y ofrece "nueva_planta" para completar la ficha con foto; en la respuesta dile que podrá ubicarla en el mapa.
5. Si pide consejo o recomendación → contesta tú directamente, concreto y con los datos del jardín (qué producto del inventario usar, cuándo). NO registres nada salvo que lo pida. Si le remites a lo que ya tiene guardado, el enlace es "inventario".
6. No dupliques: si la agenda ya recoge lo que pide, dilo en la respuesta y no lo vuelvas a crear.
7. Ante una petición ambigua, haz lo más razonable y di en la respuesta qué has entendido.`,
      temperature: 0.4,
    });

    return object;
  } catch (e) {
    console.error('El asistente no pudo interpretar la petición:', e);
    return null;
  }
}
