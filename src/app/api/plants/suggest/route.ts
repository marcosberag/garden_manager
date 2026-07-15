import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return Response.json([]);
    }

    const { object } = await generateObject({
      model: google('gemini-3.5-flash'),
      schema: z.object({
        suggestions: z.array(z.string()).max(5).describe('Una lista de hasta 5 nombres científicos y comunes de plantas que coincidan con la búsqueda. Ej: "Monstera deliciosa", "Palmera Phoenix"'),
      }),
      prompt: `Eres una base de datos botánica experta. El usuario está escribiendo un nombre de planta o especie: "${query}".
Tu tarea es sugerir hasta 5 nombres reales de plantas (combinando el nombre común más conocido y su especie si es posible) que completen lo que está escribiendo.
Asegúrate rigurosamente de que las plantas existen. NO inventes nombres. Si la búsqueda no tiene sentido, devuelve un array vacío.
Devuelve cadenas simples, por ejemplo: "Palmera Phoenix (Phoenix canariensis)".`,
    });

    return Response.json(object.suggestions);
  } catch (error) {
    console.error('Error in plant suggest:', error);
    return Response.json([]);
  }
}
