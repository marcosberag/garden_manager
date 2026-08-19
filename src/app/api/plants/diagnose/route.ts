import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { diagnosticarPlanta } from '@/lib/diagnosticar-planta';

const normaliza = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Diagnóstico por foto de una planta concreta. Exige sesión: gasta cuota de
// Gemini y lee el inventario del usuario.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const formData = await req.formData();
  const image = formData.get('image') as File | null;
  const plantId = formData.get('plant_id') as string | null;
  const notas = (formData.get('notes') as string | null)?.slice(0, 500) || null;

  if (!image || !plantId) {
    return NextResponse.json({ error: 'Faltan la imagen o la planta' }, { status: 400 });
  }

  const { data: plant } = await supabase
    .from('plants')
    .select('name, species, description')
    .match({ id: plantId, user_id: user.id })
    .single();
  if (!plant) {
    return NextResponse.json({ error: 'Planta no encontrada' }, { status: 404 });
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, type, description')
    .eq('user_id', user.id);

  const base64 = Buffer.from(await image.arrayBuffer()).toString('base64');
  const diagnostico = await diagnosticarPlanta(base64, {
    planta: { nombre: plant.name, especie: plant.species, descripcion: plant.description },
    productos: products || [],
    notas,
  });

  if (!diagnostico) {
    return NextResponse.json({ error: 'No se pudo valorar la foto. Prueba con otra más cercana y nítida.' }, { status: 422 });
  }

  // El nombre de producto que devuelve la IA se resuelve aquí a su id, para que
  // el cliente pueda encadenar directamente con el registro de tratamiento.
  let productoId: string | null = null;
  if (diagnostico.producto_del_inventario) {
    const objetivo = normaliza(diagnostico.producto_del_inventario);
    productoId = (products || []).find(p => {
      const nombre = normaliza(p.name || '');
      return nombre && (nombre.includes(objetivo) || objetivo.includes(nombre));
    })?.id || null;
  }

  return NextResponse.json({ ...diagnostico, producto_id: productoId });
}
