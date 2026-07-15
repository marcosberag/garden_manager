// @ts-nocheck
import { createClient } from '@/utils/supabase/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let context = 'El usuario actual no ha iniciado sesión.';
  
  if (user) {
    const [
      { data: plants },
      { data: products },
      { data: events }
    ] = await Promise.all([
      supabase.from('plants').select('id, name, species, description'),
      supabase.from('products').select('id, name, type, description'),
      supabase.from('events').select('type, date, notes')
    ]);

    context = `
    DATOS REALES DEL JARDÍN DEL USUARIO:
    - Plantas registradas: ${JSON.stringify(plants || [])}
    - Inventario de productos: ${JSON.stringify(products || [])}
    - Historial de tareas: ${JSON.stringify(events || [])}
    `;
  }

  const systemPrompt = `
  Eres el 'Asesor Botánico de Brotes', un experto en jardinería con capacidad para modificar la base de datos del usuario.
  Tu personalidad es profesional, calmada y directa.
  
  REGLAS ESTRICTAS DE HERRAMIENTAS:
  1. Tienes acceso a herramientas para registrar Plantas, Productos y Tratamientos (eventos).
  2. DEBES EJECUTAR LAS HERRAMIENTAS DIRECTAMENTE cuando el usuario te dé una instrucción clara (ej: "Añade cobre a la leylandi los días X y Y").
  3. Si el usuario te pide registrar múltiples fechas o múltiples acciones de golpe, EJECUTA LA HERRAMIENTA VARIAS VECES (una por cada fecha/acción).
  4. NO pidas confirmación a menos que falte información vital que no puedas deducir.
  5. Una vez ejecutadas las herramientas, responde al usuario confirmando de forma resumida y amigable lo que has hecho.
  6. Si el usuario te indica una frecuencia (ej. cada X días), añade al campo 'notes' exactamente la etiqueta [FREQ:X] (ej. [FREQ:7]).
  7. Si tienes que buscar el UUID de una planta o producto, búscalo en el CONTEXTO proporcionado.
  8. Para fechas, asume el año actual (${new Date().getFullYear()}) si no se especifica. Convierte fechas como "24 de mayo" a formato "YYYY-05-24".

  CONTEXTO ACTUAL DEL USUARIO:
  ${context}
  `;

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
  });

  try {
    const result = streamText({
      model: google('gemini-3.5-flash'),
      system: systemPrompt,
      messages,
      tools: {
        registrar_tratamiento: tool({
          description: 'Añade un evento o tratamiento al calendario.',
          parameters: z.object({
            type: z.string().describe('Fumigación, Poda u Otro'),
            date: z.string().describe('Fecha en formato YYYY-MM-DD'),
            notes: z.string().optional().describe('Notas o detalles. INCLUIR SIEMPRE [FREQ:X] si el usuario indicó una frecuencia en días.'),
            plant_id: z.string().optional().describe('ID (UUID) exacto de la planta, extráelo del contexto'),
            product_id: z.string().optional().describe('ID (UUID) exacto del producto, extráelo del contexto'),
          }),
          execute: async (args) => {
            const { type, date, notes, plant_id, product_id } = args;
            if (!user) return 'No autenticado';
            const { error } = await supabase.from('events').insert({
              user_id: user.id, type, date, notes: notes || null, plant_id: plant_id || null, product_id: product_id || null
            });
            return error ? `Error de BD: ${error.message}` : 'Tratamiento registrado con éxito en la base de datos.';
          }
        }),
        registrar_producto: tool({
          description: 'Añade un nuevo producto botánico al inventario.',
          parameters: z.object({
            name: z.string().describe('Nombre del producto'),
            type: z.string().describe('Tipo (Fungicida, Abono, Insecticida, Otro)'),
            description: z.string().optional().describe('Descripción o notas'),
          }),
          execute: async (args) => {
            const { name, type, description } = args;
            if (!user) return 'No autenticado';
            const { error } = await supabase.from('products').insert({
              user_id: user.id, name, type, description: description || null
            });
            return error ? `Error de BD: ${error.message}` : 'Producto añadido exitosamente al inventario.';
          }
        }),
        registrar_planta: tool({
          description: 'Añade una nueva planta al mapa y base de datos.',
          parameters: z.object({
            name: z.string().describe('Nombre o mote de la planta'),
            species: z.string().optional().describe('Especie o variedad'),
            description: z.string().optional().describe('Descripción breve'),
          }),
          execute: async (args) => {
            const { name, species, description } = args;
            if (!user) return 'No autenticado';
            const { error } = await supabase.from('plants').insert({
              user_id: user.id, name, species: species || null, description: description || null
            });
            return error ? `Error de BD: ${error.message}` : 'Planta añadida correctamente al jardín.';
          }
        })
      }
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Error en Gemini API:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
