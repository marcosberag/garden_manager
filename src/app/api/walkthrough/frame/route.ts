import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { identificarPlantaEnFrame } from '@/lib/identificar-planta-frame';
import { jardinDe } from '@/lib/jardin';

// Analiza un fotograma del recorrido por el jardín. Exige sesión: cada llamada
// gasta cuota de Gemini y el recorrido lanza muchas seguidas.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const jardin = await jardinDe(supabase, user);

  let body: { imagen?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }
  if (!body.imagen) {
    return NextResponse.json({ error: 'Falta la imagen' }, { status: 400 });
  }

  // Las plantas registradas se leen aquí (con la sesión del usuario) para que
  // el cliente no tenga que mandarlas en cada fotograma.
  const { data: plants } = await supabase
    .from('plants')
    .select('name, species')
    .eq('user_id', jardin.id);

  const deteccion = await identificarPlantaEnFrame(body.imagen, {
    plantasRegistradas: (plants || []).map(p => ({ nombre: p.name, especie: p.species })),
  });

  if (!deteccion) {
    return NextResponse.json({ error: 'No se pudo analizar el fotograma' }, { status: 502 });
  }

  return NextResponse.json(deteccion);
}
