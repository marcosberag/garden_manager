import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { diagnosticarPlanta } from '@/lib/diagnosticar-planta';
import { compararFotosPlanta } from '@/lib/comparar-fotos';

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
    .select('name, species, description, image_url')
    .match({ id: plantId, user_id: user.id })
    .single();
  if (!plant) {
    return NextResponse.json({ error: 'Planta no encontrada' }, { status: 404 });
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, type, description')
    .eq('user_id', user.id);

  const buffer = Buffer.from(await image.arrayBuffer());
  const base64 = buffer.toString('base64');
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

  // Historial fotográfico y veredicto de evolución. Todo este bloque es
  // opcional: si la tabla plant_photos aún no existe (migración 008 pendiente)
  // o algo falla, el diagnóstico se devuelve igual, solo que sin evolución.
  let evolucion: string | null = null;
  let veredicto: string | null = null;
  try {
    const { data: previas } = await supabase
      .from('plant_photos')
      .select('url, note, created_at')
      .match({ plant_id: plantId, user_id: user.id })
      .order('created_at', { ascending: false })
      .limit(1);
    const previa = previas?.[0]
      || (plant.image_url ? { url: plant.image_url, note: null, created_at: null } : null);

    if (previa?.url) {
      const descarga = await fetch(previa.url);
      if (descarga.ok) {
        const base64Anterior = Buffer.from(await descarga.arrayBuffer()).toString('base64');
        const v = await compararFotosPlanta(base64Anterior, base64, {
          planta: { nombre: plant.name, especie: plant.species },
          notaAnterior: previa.note,
          fechaAnterior: previa.created_at ? String(previa.created_at).slice(0, 10) : null,
          diagnosticoNuevo: diagnostico.diagnostico,
        });
        if (v && v.evolucion !== 'no_comparable') {
          evolucion = v.evolucion;
          veredicto = v.veredicto;
        }
      }
    }

    const filePath = `${user.id}/${Math.random().toString(36).substring(2, 15)}.jpg`;
    const { error: errorSubida } = await supabase.storage
      .from('plant_images')
      .upload(filePath, buffer, { contentType: image.type || 'image/jpeg' });
    if (!errorSubida) {
      const url = supabase.storage.from('plant_images').getPublicUrl(filePath).data.publicUrl;
      await supabase.from('plant_photos').insert({
        user_id: user.id,
        plant_id: plantId,
        url,
        note: `${diagnostico.diagnostico}. ${diagnostico.descripcion}`.slice(0, 400),
        verdict: veredicto,
        evolution: evolucion,
      });
    }
  } catch (e) {
    console.error('El historial fotográfico no se pudo guardar:', e);
  }

  return NextResponse.json({ ...diagnostico, producto_id: productoId, evolucion, veredicto_evolucion: veredicto });
}
