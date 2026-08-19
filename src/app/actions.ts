'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deducirFrecuencia, leerFrecuencia, etiquetaDeMetodo, frecuenciaSegunCaso } from '@/lib/frecuencias';
import { resolverCategoria } from '@/lib/plant-icons-ai';

export async function addPlant(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  let name = formData.get('name') as string;
  const species = formData.get('species') as string;
  const description = formData.get('description') as string;
  const location = formData.get('location') as string;
  const size = formData.get('size') as string;
  const age = formData.get('age') as string;
  const icon_emoji = formData.get('icon_emoji') as string;
  
  let image_url = null;
  const imageFile = formData.get('image') as File | null;
  
  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage.from('plant_images').upload(filePath, imageFile);
    if (uploadError) {
      console.error("Error upload:", uploadError);
      throw new Error('Error al subir la imagen al bucket plant_images');
    }
    
    const { data: { publicUrl } } = supabase.storage.from('plant_images').getPublicUrl(filePath);
    image_url = publicUrl;
  }

  if (!name) {
    name = species;
  }
  
  if (!name) {
    throw new Error('La especie o el nombre de la planta es obligatorio');
  }

  // Categoría del icono del mapa, deducida de la especie.
  const icon_category = await resolverCategoria(species, name);

  const { error } = await supabase.from('plants').insert({
    user_id: user.id,
    name,
    species,
    description,
    location,
    size,
    age,
    icon_emoji: icon_emoji || null,
    icon_category,
    image_url
  });

  if (error) {
    console.error("Error al añadir planta:", error);
    throw new Error('Error al guardar la planta en la base de datos');
  }

  revalidatePath('/plants');
  redirect('/plants');
}

export async function addProduct(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const name = formData.get('name') as string;
  const type = formData.get('type') as string;
  const description = formData.get('description') as string;
  const barcode = formData.get('barcode') as string;

  if (!name || !type) {
    throw new Error('El nombre y el tipo de producto son obligatorios');
  }

  // Si el usuario deja la frecuencia en blanco, la deduce la IA a partir del
  // producto. Así no hay que saberse la pauta al registrar cada tratamiento.
  const frecuenciaManual = leerFrecuenciaDelFormulario(formData);
  const { frequency_days, frequency_source } = frecuenciaManual !== null
    ? { frequency_days: frecuenciaManual, frequency_source: 'manual' }
    : { ...(await deducirFrecuencia(name, type, description)), frequency_source: 'ia' };

  const { error } = await supabase.from('products').insert({
    user_id: user.id,
    name,
    type,
    description,
    barcode: barcode || null,
    frequency_days,
    frequency_source,
  });

  if (error) {
    console.error("Error al añadir producto:", error);
    throw new Error('Error al guardar el producto en la base de datos');
  }

  revalidatePath('/products');
  redirect('/products');
}

export async function deletePlant(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  await supabase.from('plants').delete().match({ id, user_id: user.id });
  revalidatePath('/plants');
}

export async function updatePlant(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  let name = formData.get('name') as string;
  const species = formData.get('species') as string;
  const description = formData.get('description') as string;
  const location = formData.get('location') as string;
  const size = formData.get('size') as string;
  const age = formData.get('age') as string;
  const icon_emoji = formData.get('icon_emoji') as string;

  let image_url = undefined;
  const imageFile = formData.get('image') as File | null;
  
  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage.from('plant_images').upload(filePath, imageFile);
    if (uploadError) {
      console.error("Error upload:", uploadError);
      throw new Error('Error al subir la nueva imagen');
    }
    
    const { data: { publicUrl } } = supabase.storage.from('plant_images').getPublicUrl(filePath);
    image_url = publicUrl;
  }
  
  if (!name) {
    name = species;
  }

  if (!name) throw new Error('La especie o el nombre de la planta es obligatorio');

  const updateData: any = {
    name, species, description, location, size, age,
    icon_emoji: icon_emoji || null,
    icon_category: await resolverCategoria(species, name),
  };
  if (image_url) {
    updateData.image_url = image_url;
  }

  await supabase.from('plants').update(updateData).match({ id, user_id: user.id });
  
  revalidatePath('/plants');
  redirect('/plants');
}

export async function deleteProduct(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  await supabase.from('products').delete().match({ id, user_id: user.id });
  revalidatePath('/products');
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  const name = formData.get('name') as string;
  const type = formData.get('type') as string;
  const description = formData.get('description') as string;
  const barcode = formData.get('barcode') as string;

  if (!name || !type) throw new Error('El nombre y tipo son obligatorios');

  const { data: anterior } = await supabase
    .from('products')
    .select('frequency_days, frequency_source')
    .match({ id, user_id: user.id })
    .single();

  const frecuenciaFormulario = leerFrecuenciaDelFormulario(formData);
  let frequency_days = frecuenciaFormulario;
  // Sin valor en el formulario volvemos a preguntar a la IA. Si el valor no ha
  // cambiado, conservamos su origen: editar el nombre no debe convertir en
  // "manual" una pauta que puso la IA, ni al revés.
  let frequency_source = frecuenciaFormulario === null ? 'ia' : 'manual';

  if (frecuenciaFormulario === null) {
    frequency_days = (await deducirFrecuencia(name, type, description)).frequency_days;
  } else if (anterior && frecuenciaFormulario === anterior.frequency_days) {
    frequency_source = anterior.frequency_source || 'manual';
  }

  await supabase
    .from('products')
    .update({ name, type, description, barcode: barcode || null, frequency_days, frequency_source })
    .match({ id, user_id: user.id });
  
  revalidatePath('/products');
  redirect('/products');
}

export async function setPlantLocation(id: string, lat: number, lng: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  const { error } = await supabase
    .from('plants')
    .update({ lat, lng })
    .match({ id, user_id: user.id });

  if (error) {
    console.error('Error setting location', error);
    throw new Error(`DB Error: ${error.message}`);
  }

  revalidatePath('/');
  revalidatePath('/plants');
}

export async function setPlantPath(id: string, path: [number, number][]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  const { error } = await supabase
    .from('plants')
    .update({ path, lat: null, lng: null })
    .match({ id, user_id: user.id });

  if (error) {
    console.error('Error setting path', error);
    throw new Error(`DB Error: ${error.message}`);
  }

  revalidatePath('/');
  revalidatePath('/plants');
}

export async function removePlantLocation(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  const { error } = await supabase
    .from('plants')
    .update({ lat: null, lng: null })
    .match({ id, user_id: user.id });

  if (error) {
    console.error('Error removing location', error);
    throw new Error(`DB Error: ${error.message}`);
  }

  revalidatePath('/');
  revalidatePath('/plants');
}

export async function saveUserParcel(geojsonStr: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  // Check if parcel already exists
  const { data: existing } = await supabase.from('parcels').select('id').eq('user_id', user.id).single();

  let error;
  if (existing) {
    const { error: updateErr } = await supabase.from('parcels').update({ geojson: geojsonStr }).eq('id', existing.id);
    error = updateErr;
  } else {
    const { error: insertErr } = await supabase.from('parcels').insert({ user_id: user.id, geojson: geojsonStr });
    error = insertErr;
  }

  if (error) {
    console.error('Error saving parcel', error);
    throw new Error('Error al guardar la parcela en base de datos');
  }

  revalidatePath('/');
}

export async function addEvent(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuario no autenticado');

  const type = formData.get('type') as string;
  const dates = formData.getAll('dates[]') as string[];
  const dateFallback = formData.get('date') as string;
  const notes = formData.get('notes') as string;
  const plant_id = formData.get('plant_id') as string;
  const product_id = formData.get('product_id') as string;
  const application_method = formData.get('application_method') as string;

  const frequency_days_str = formData.get('frequency_days') as string;
  const frequency_days = frequency_days_str ? parseInt(frequency_days_str, 10) : 0;

  // El modo de aplicación viaja dentro de las notas, en texto legible: no hace
  // falta otra columna y el calendario y los avisos ya enseñan las notas.
  const etiquetaMetodo = etiquetaDeMetodo(application_method || null);
  const notasUsuario = notes?.trim() || '';
  const notasFinales = notasUsuario
    ? (etiquetaMetodo ? `${notasUsuario} (aplicación ${etiquetaMetodo})` : notasUsuario)
    : (etiquetaMetodo ? `Aplicación ${etiquetaMetodo}.` : null);

  const finalDates = dates.length > 0 ? dates : (dateFallback ? [dateFallback] : []);

  if (!type || finalDates.length === 0) {
    throw new Error('Tipo y fecha son obligatorios');
  }

  let futureEventsToInsert: any[] = [];

  if (frequency_days > 0) {
    // Limpiar eventos programados antiguos para esta misma tarea
    let deleteQuery = supabase.from('events').delete()
      .eq('user_id', user.id)
      .eq('type', type)
      .like('notes', '%[PROGRAMADO]%');
      
    if (plant_id) deleteQuery = deleteQuery.eq('plant_id', plant_id);
    else deleteQuery = deleteQuery.is('plant_id', null);
    
    if (product_id) deleteQuery = deleteQuery.eq('product_id', product_id);
    else deleteQuery = deleteQuery.is('product_id', null);
    
    await deleteQuery;

    const latestDateStr = finalDates.sort().reverse()[0];
    const latestDate = new Date(latestDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let nextDate = new Date(latestDate);
    nextDate.setDate(nextDate.getDate() + frequency_days);
    
    // Lógica biológica: si la fecha en la que tocaba el tratamiento ya ha pasado,
    // el usuario va tarde. No tiene sentido mantener el ciclo antiguo (podría sobre-fumigar).
    // Lo correcto es decirle que lo haga HOY, y proyectar las siguientes dosis a partir de HOY.
    if (nextDate < today) {
      nextDate = new Date(today);
    }
    
    const getLocalDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    
    for (let i = 0; i < 3; i++) {
      futureEventsToInsert.push({
        user_id: user.id,
        type,
        date: getLocalDateString(nextDate),
        notes: `[PROGRAMADO] Tarea programada cada ${frequency_days} días${etiquetaMetodo ? ` (aplicación ${etiquetaMetodo})` : ''}.`,
        frequency_days,
        plant_id: plant_id || null,
        product_id: product_id || null
      });
      nextDate.setDate(nextDate.getDate() + frequency_days);
    }
  }

  const eventsToInsert = finalDates.map(d => ({
    user_id: user.id,
    type,
    date: d,
    notes: notasFinales,
    frequency_days: frequency_days > 0 ? frequency_days : null,
    plant_id: plant_id || null,
    product_id: product_id || null
  }));

  // Insert past events
  const { error } = await supabase.from('events').insert(eventsToInsert);
  if (error) {
    console.error("Error al añadir evento:", error);
    throw new Error('Error al guardar el evento en la base de datos');
  }

  // Insert future events if any
  if (futureEventsToInsert.length > 0) {
    await supabase.from('events').insert(futureEventsToInsert);
  }

  revalidatePath('/');
  if (plant_id) {
    revalidatePath(`/plants/${plant_id}`);
  }
  redirect('/');
}

export async function markAsCured(plant_id: string, product_id?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const today = new Date().toISOString().split('T')[0];

  // Delete all future PROGRAMADO events for this plant
  let query = supabase.from('events').delete()
    .eq('user_id', user.id)
    .eq('plant_id', plant_id)
    .gt('date', today)
    .like('notes', '%[PROGRAMADO]%');
    
  if (product_id) {
    query = query.eq('product_id', product_id);
  }

  await query;
  
  // Add a "Planta Curada" historical record
  await supabase.from('events').insert({
    user_id: user.id,
    type: 'Alta Médica',
    date: today,
    notes: 'Tratamiento curativo finalizado manualmente.',
    plant_id: plant_id
  });

  revalidatePath('/');
  revalidatePath(`/plants/${plant_id}`);
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuario no autenticado');

  const type = formData.get('type') as string;
  const date = formData.get('date') as string;
  const notes = formData.get('notes') as string;
  const plant_id = formData.get('plant_id') as string;
  const product_id = formData.get('product_id') as string;

  if (!type || !date) {
    throw new Error('Tipo y fecha son obligatorios');
  }

  const { error } = await supabase.from('events').update({
    type,
    date,
    notes: notes || null,
    plant_id: plant_id || null,
    product_id: product_id || null
  }).match({ id, user_id: user.id });

  if (error) {
    console.error("Error al actualizar evento:", error);
    throw new Error('Error al actualizar el evento en la base de datos');
  }

  revalidatePath('/');
  if (plant_id) {
    revalidatePath(`/plants/${plant_id}`);
  }
  redirect('/');
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuario no autenticado');

  const { error } = await supabase.from('events').delete().match({ id, user_id: user.id });
  
  if (error) {
    console.error("Error al eliminar evento:", error);
    throw new Error('Error al eliminar el evento en la base de datos');
  }
  
  revalidatePath('/');
  redirect('/');
}

export async function deleteAllEvents() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuario no autenticado');

  const { error } = await supabase.from('events').delete().eq('user_id', user.id);
  
  if (error) {
    console.error("Error al limpiar eventos:", error);
    throw new Error('Error al limpiar el historial en la base de datos');
  }
  
  revalidatePath('/');
}

export async function postponeEvent(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuario no autenticado');

  // Recuperamos el evento completo para saber qué se ha pospuesto
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select(`
      type, 
      notes, 
      plants(name), 
      products(name)
    `)
    .eq('id', id)
    .single();
    
  if (fetchError || !event) {
    throw new Error('No se pudo recuperar el evento');
  }

  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = `${tomorrowObj.getFullYear()}-${String(tomorrowObj.getMonth()+1).padStart(2,'0')}-${String(tomorrowObj.getDate()).padStart(2,'0')}`;

  const currentNotes = event.notes || '';
  const newNotes = currentNotes.includes('[POSPUESTO]') ? currentNotes : `${currentNotes} [POSPUESTO]`.trim();

  const { error } = await supabase
    .from('events')
    .update({ date: tomorrowStr, notes: newNotes })
    .match({ id, user_id: user.id });

  if (error) {
    console.error("Error al posponer evento:", error);
    throw new Error('Error al posponer el evento en la base de datos');
  }

  // ENVIAR NOTIFICACIÓN INMEDIATA POR CALLMEBOT
  const productName = (event.products as any)?.name || event.type;
  const plantName = (event.plants as any)?.name || 'General';
  const alertText = `🕒 *Pospuesto a mañana:*\nSe ha aplazado la tarea de ${productName} en ${plantName}.`;
  
  const { data: contacts } = await supabase.from('notification_contacts').select('phone_number, api_key').eq('user_id', user.id);
  
  if (contacts && contacts.length > 0) {
    for (const contact of contacts) {
      if (contact.phone_number && contact.api_key) {
        const text = encodeURIComponent(alertText);
        const cleanPhone = contact.phone_number.replace(/\D/g, '');
        const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${text}&apikey=${contact.api_key}`;
        
        // Lo disparamos sin esperar a que termine (en background) para no ralentizar la interfaz
        fetch(url).catch(e => console.error("Error enviando aviso de posponer:", e));
      }
    }
  }

  revalidatePath('/');
  revalidatePath('/calendar');
}

export async function completeEvent(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuario no autenticado');

  const { data: event } = await supabase.from('events').select('*').eq('id', id).single();
  
  if (event) {
    let newNotes = event.notes || '';
    const frequency_days = leerFrecuencia(event);

    newNotes = newNotes.replace(/\[PROGRAMADO\]/g, '').replace(/\[POSPUESTO\]/g, '').trim();
    newNotes = newNotes ? `${newNotes} [HECHO]` : '[HECHO]';

    const todayObj = new Date();
    // Forzamos la zona horaria a medianoche para evitar desajustes
    todayObj.setHours(0, 0, 0, 0); 
    
    const getLocalDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const todayStr = getLocalDateString(todayObj);

    await supabase
      .from('events')
      .update({ notes: newNotes, date: todayStr })
      .match({ id, user_id: user.id });
      
    // Si la tarea tenía una frecuencia, debemos re-programar los próximos eventos a partir de HOY
    if (frequency_days > 0) {
      // 1. Borrar los eventos futuros programados para esta misma tarea
      let deleteQuery = supabase.from('events').delete()
        .eq('user_id', user.id)
        .eq('type', event.type)
        .like('notes', '%[PROGRAMADO]%');
        
      if (event.plant_id) deleteQuery = deleteQuery.eq('plant_id', event.plant_id);
      else deleteQuery = deleteQuery.is('plant_id', null);
      
      if (event.product_id) deleteQuery = deleteQuery.eq('product_id', event.product_id);
      else deleteQuery = deleteQuery.is('product_id', null);
      
      await deleteQuery;
      
      // 2. Crear los 3 próximos eventos calculados desde HOY
      let nextDate = new Date(todayObj);
      nextDate.setDate(nextDate.getDate() + frequency_days);
      
      let futureEventsToInsert = [];
      for (let i = 0; i < 3; i++) {
        futureEventsToInsert.push({
          user_id: user.id,
          type: event.type,
          date: getLocalDateString(nextDate),
          notes: `[PROGRAMADO] Tarea programada cada ${frequency_days} días.`,
          frequency_days,
          plant_id: event.plant_id || null,
          product_id: event.product_id || null
        });
        nextDate.setDate(nextDate.getDate() + frequency_days);
      }
      
      if (futureEventsToInsert.length > 0) {
        await supabase.from('events').insert(futureEventsToInsert);
      }
    }

    revalidatePath('/');
    revalidatePath('/calendar');
  }
}

/**
 * Lee el campo de frecuencia de un formulario. Devuelve null cuando el usuario
 * lo deja vacío, que es la señal de "decídela tú".
 */
function leerFrecuenciaDelFormulario(formData: FormData): number | null {
  const bruto = (formData.get('frequency_days') as string | null)?.trim();
  if (!bruto) return null;
  const dias = parseInt(bruto, 10);
  return Number.isFinite(dias) && dias > 0 ? dias : null;
}

/**
 * Alta de un producto identificado por foto desde el formulario de tratamiento.
 * A diferencia de addProduct no redirige: devuelve la fila insertada para que
 * el formulario la seleccione al momento.
 */
export async function addProductFromScan(identificado: {
  name: string;
  type: string;
  description?: string | null;
  frequency_days?: number | null;
}): Promise<{ product?: any; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Usuario no autenticado' };

  const { name, type } = identificado;
  if (!name || !type) return { error: 'La identificación llegó incompleta' };

  // La pauta leída de la etiqueta manda; si no se pudo leer, se deduce igual
  // que al dar de alta un producto a mano.
  const frequency_days = identificado.frequency_days
    ?? (await deducirFrecuencia(name, type, identificado.description)).frequency_days;

  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      name,
      type,
      description: identificado.description || null,
      frequency_days,
      frequency_source: 'ia',
    })
    .select()
    .single();

  if (error) {
    console.error('Error al guardar el producto identificado:', error);
    return { error: 'No se pudo guardar el producto en el inventario' };
  }

  revalidatePath('/products');
  return { product: data };
}

/**
 * Repasa todas las tareas programadas y les recalcula la pauta con la IA según
 * su caso (producto + planta + modo si consta en las notas). Cuando la pauta
 * cambia, borra los avisos [PROGRAMADO] de esa tarea y los reprograma desde la
 * última aplicación real; si nunca la hubo, conserva la próxima cita y solo
 * reespacia las siguientes. Las tareas sin producto no se tocan: sin producto
 * no hay pauta que calcular.
 */
export async function recalcularPautasProgramadas(): Promise<{
  cambios?: { tarea: string; antes: number; ahora: number; motivo: string }[];
  yaCorrectas?: number;
  sinProducto?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Usuario no autenticado' };

  const { data: events, error } = await supabase
    .from('events')
    .select('id, type, date, notes, frequency_days, plant_id, product_id, products(name, type, description), plants(name, species)')
    .order('date', { ascending: true });

  if (error || !events) {
    console.error('Error leyendo los eventos para recalcular pautas:', error);
    return { error: 'No se pudieron leer los eventos' };
  }

  const programados = events.filter(e => e.notes?.includes('[PROGRAMADO]') && !e.notes?.includes('[HECHO]'));

  // Una "tarea" es la combinación tipo + planta + producto, la misma que usa
  // addEvent para reemplazar los avisos programados.
  const grupos = new Map<string, any[]>();
  for (const e of programados) {
    const clave = `${e.type}|${e.plant_id || ''}|${e.product_id || ''}`;
    grupos.set(clave, [...(grupos.get(clave) || []), e]);
  }

  const getLocalDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const cambios: { tarea: string; antes: number; ahora: number; motivo: string }[] = [];
  let yaCorrectas = 0;
  let sinProducto = 0;

  for (const grupo of grupos.values()) {
    const muestra: any = grupo[0];
    const producto: any = muestra.products;
    const planta: any = muestra.plants;

    if (!producto?.name) {
      sinProducto += 1;
      continue;
    }

    // Los eventos nuevos llevan el modo en las notas; si consta, se aprovecha.
    const metodo = muestra.notes?.match(/\(aplicación ([^)]+)\)/)?.[1] || null;

    const pauta = await frecuenciaSegunCaso({
      producto: { nombre: producto.name, tipo: producto.type, descripcion: producto.description },
      planta: planta ? { nombre: planta.name, especie: planta.species } : null,
      metodo,
    });
    if (!pauta) continue;

    const antes = leerFrecuencia(muestra);
    const ahora = pauta.frequency_days;
    const tarea = `${producto.name}${planta?.name ? ` en ${planta.name}` : ''}`;

    if (ahora === antes) {
      yaCorrectas += 1;
      continue;
    }

    // Ancla: la última aplicación real de esta misma tarea.
    const reales = events.filter(e =>
      e.type === muestra.type &&
      (e.plant_id || null) === (muestra.plant_id || null) &&
      (e.product_id || null) === (muestra.product_id || null) &&
      !e.notes?.includes('[PROGRAMADO]')
    );
    const ultimaReal = reales.length ? reales[reales.length - 1].date : null;

    let siguiente: Date;
    if (ultimaReal) {
      siguiente = new Date(ultimaReal);
      siguiente.setDate(siguiente.getDate() + ahora);
    } else {
      siguiente = new Date(muestra.date);
    }
    if (siguiente < hoy) siguiente = new Date(hoy);

    const { error: errorBorrado } = await supabase.from('events').delete().in('id', grupo.map((g: any) => g.id));
    if (errorBorrado) {
      console.error(`Error borrando los avisos antiguos de "${tarea}":`, errorBorrado);
      continue;
    }

    const nuevos = [];
    for (let i = 0; i < 3; i++) {
      nuevos.push({
        user_id: user.id,
        type: muestra.type,
        date: getLocalDateString(siguiente),
        notes: `[PROGRAMADO] Tarea programada cada ${ahora} días${metodo ? ` (aplicación ${metodo})` : ''}.`,
        frequency_days: ahora,
        plant_id: muestra.plant_id || null,
        product_id: muestra.product_id || null,
      });
      siguiente.setDate(siguiente.getDate() + ahora);
    }

    const { error: errorInsercion } = await supabase.from('events').insert(nuevos);
    if (errorInsercion) {
      console.error(`Error reprogramando "${tarea}":`, errorInsercion);
      continue;
    }

    cambios.push({ tarea, antes, ahora, motivo: pauta.motivo });
  }

  revalidatePath('/');
  revalidatePath('/calendar');
  return { cambios, yaCorrectas, sinProducto };
}
