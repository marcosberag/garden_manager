import { generateObject } from 'ai';
import { z } from 'zod';
import { modelo } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString('base64');

    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        species: z.string().describe('El nombre botánico o científico exacto de la planta, o el nombre común si el botánico es desconocido. Ej: "Monstera deliciosa"'),
      }),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Eres un botánico experto. Identifica la especie exacta de la planta que aparece en esta imagen.' },
            { type: 'image', image: base64Image }
          ]
        }
      ]
    });

    return Response.json(object);
  } catch (error) {
    console.error('Error in plant identify:', error);
    return Response.json({ error: 'Error processing image' }, { status: 500 });
  }
}
