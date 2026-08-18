import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { identificarProducto } from '@/lib/identificar-producto';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Falta la imagen' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const producto = await identificarProducto(buffer.toString('base64'));

    if (!producto) {
      return NextResponse.json(
        { error: 'En la foto no se distingue un producto de jardinería. Prueba enfocando la etiqueta.' },
        { status: 422 }
      );
    }

    return NextResponse.json(producto);
  } catch (error) {
    console.error('Error identificando el producto:', error);
    return NextResponse.json({ error: 'Error al analizar la imagen' }, { status: 500 });
  }
}
