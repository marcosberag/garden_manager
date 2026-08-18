import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { modelo } from '@/lib/ai';
import { z } from 'zod';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const { object } = await generateObject({
      model: modelo(),
      schema: z.object({
        suggestions: z.array(z.string())
      }),
      prompt: `El usuario está añadiendo un producto a su inventario de jardinería y ha escrito: "${q}".
      Sugiérele 3 nombres de productos comerciales, genéricos o compuestos químicos muy conocidos para el cuidado de plantas (ej: Aceite de Neem, Jabón Potásico, Fungicida de Cobre, Quelato de Hierro, Anti-oidio...).
      Devuelve solo un array de strings con los nombres sugeridos (cortos y concisos).`,
      temperature: 0.3,
    });

    return NextResponse.json(object.suggestions);
  } catch (error) {
    console.error('Error in product suggestion API:', error);
    // Fallback: hardcoded array of common products if AI fails
    const hardcoded = ["Aceite de Neem", "Jabón Potásico", "Tierra de Diatomeas", "Fungicida Polivalente", "Insecticida Polivalente", "Quelato de Hierro", "Cobre", "Abono Universal"];
    const matched = hardcoded.filter(h => h.toLowerCase().includes(q.toLowerCase()));
    return NextResponse.json(matched.slice(0, 3));
  }
}
