'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deducirFrecuencia, leerFrecuencia, etiquetaDeMetodo, frecuenciaSegunCaso } from '@/lib/frecuencias';
import { resolverCategoria } from '@/lib/plant-icons-ai';
import { categoriaDeEspecie } from '@/lib/plant-icons';
import { centroDeGeojson } from '@/lib/meteo';
import { generarPlanAnual, type PropuestaPlan } from '@/lib/plan-anual';
import { interpretarPeticion, type EnlaceAsistente } from '@/lib/asistente';
import { aplicacionesDeLaTanda, cortePorInactividad } from '@/lib/tandas';
import { enviarWhatsApp } from '@/lib/callmebot';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Forma mínima de una fila de events tal como se maneja en este módulo. El
 * cliente de Supabase no está tipado contra el esquema, así que esto documenta
 * lo que las funciones usan de verdad.
 */
type EventoFila = {
  id: string;
  type: string;
  date: string;
  notes: string | null;
  plant_id: string | null;
  product_id: string | null;
  frequency_days?: number | null;
  products?: { name: string; type?: string | null; description?: string | null; frequency_days?: number | null } | null;
  plants?: { name: string; species?: string | null } | null;
};
import { jardinDe } from '@/lib/jardin';

/**
 * Tope de aplicaciones que venga del formulario de producto. Vacío o fuera de
 * rango cuenta como "sin límite".
 */
function leerLimiteDelFormulario(formData: FormData) {
  const bruto = (formData.get('max_aplicaciones') as string || '').trim();
  const n = bruto ? parseInt(bruto, 10) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 50) return { max_aplicaciones: null, limite_periodo: null };
  return {
    max_aplicaciones: n,
    limite_periodo: (formData.get('limite_periodo') as string) === 'total' ? 'total' : 'anual',
  };
}

export async function addPlant(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const jardin = await jardinDe(supabase, user);

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
    user_id: jardin.id,
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

  const jardin = await jardinDe(supabase, user);

  const name = formData.get('name') as string;
  const type = formData.get('type') as string;
  const description = formData.get('description') as string;
  const barcode = formData.get('barcode') as string;
  const dosage = (formData.get('dosage') as string)?.trim();

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
    user_id: jardin.id,
    name,
    type,
    description,
    barcode: barcode || null,
    dosage: dosage || null,
    frequency_days,
    frequency_source,
    ...leerLimiteDelFormulario(formData),
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

  const jardin = await jardinDe(supabase, user);

  await supabase.from('plants').delete().match({ id, user_id: jardin.id });
  revalidatePath('/plants');
}

export async function updatePlant(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  const jardin = await jardinDe(supabase, user);

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

  const updateData: Record<string, unknown> = {
    name, species, description, location, size, age,
    icon_emoji: icon_emoji || null,
    icon_category: await resolverCategoria(species, name),
  };
  if (image_url) {
    updateData.image_url = image_url;
  }

  await supabase.from('plants').update(updateData).match({ id, user_id: jardin.id });
  
  revalidatePath('/plants');
  redirect('/plants');
}

export async function deleteProduct(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  const jardin = await jardinDe(supabase, user);

  await supabase.from('products').delete().match({ id, user_id: jardin.id });
  revalidatePath('/products');
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  const jardin = await jardinDe(supabase, user);

  const name = formData.get('name') as string;
  const type = formData.get('type') as string;
  const description = formData.get('description') as string;
  const barcode = formData.get('barcode') as string;
  const dosage = (formData.get('dosage') as string)?.trim();

  if (!name || !type) throw new Error('El nombre y tipo son obligatorios');

  const { data: anterior } = await supabase
    .from('products')
    .select('frequency_days, frequency_source')
    .match({ id, user_id: jardin.id })
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
    .update({ name, type, description, barcode: barcode || null, dosage: dosage || null, frequency_days, frequency_source, ...leerLimiteDelFormulario(formData) })
    .match({ id, user_id: jardin.id });

  // Si la pauta cambió, los avisos ya programados con este producto se
  // reprograman solos: no hay que acordarse de recalcular nada.
  if (frequency_days && frequency_days !== anterior?.frequency_days) {
    await propagarFrecuenciaDeProducto(supabase, jardin.id, id, frequency_days);
    revalidatePath('/');
  }
  
  revalidatePath('/products');
  redirect('/products');
}

export async function setPlantLocation(id: string, lat: number, lng: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  const jardin = await jardinDe(supabase, user);

  const { error } = await supabase
    .from('plants')
    .update({ lat, lng })
    .match({ id, user_id: jardin.id });

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

  const jardin = await jardinDe(supabase, user);

  const { error } = await supabase
    .from('plants')
    .update({ path, lat: null, lng: null })
    .match({ id, user_id: jardin.id });

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

  const jardin = await jardinDe(supabase, user);

  const { error } = await supabase
    .from('plants')
    .update({ lat: null, lng: null })
    .match({ id, user_id: jardin.id });

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

  const jardin = await jardinDe(supabase, user);

  // Check if parcel already exists
  const { data: existing } = await supabase.from('parcels').select('id').eq('user_id', jardin.id).single();

  let error;
  if (existing) {
    const { error: updateErr } = await supabase.from('parcels').update({ geojson: geojsonStr }).eq('id', existing.id);
    error = updateErr;
  } else {
    const { error: insertErr } = await supabase.from('parcels').insert({ user_id: jardin.id, geojson: geojsonStr });
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

  const jardin = await jardinDe(supabase, user);

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
  // Condición de parada que calculó la IA para este caso. Viaja en las notas
  // de los avisos programados: el calendario la enseña y el WhatsApp pregunta.
  const hastaBruto = (formData.get('until_hint') as string || '').trim();
  const hastaCuando = hastaBruto.replace(/[\[\]\r\n]/g, '').slice(0, 140) || null;
  const notasUsuario = notes?.trim() || '';
  const notasFinales = notasUsuario
    ? (etiquetaMetodo ? `${notasUsuario} (aplicación ${etiquetaMetodo})` : notasUsuario)
    : (etiquetaMetodo ? `Aplicación ${etiquetaMetodo}.` : null);

  const finalDates = dates.length > 0 ? dates : (dateFallback ? [dateFallback] : []);

  if (!type || finalDates.length === 0) {
    throw new Error('Tipo y fecha son obligatorios');
  }

  const futureEventsToInsert: { user_id: string; type: string; date: string; notes: string; frequency_days: number; plant_id: string | null; product_id: string | null }[] = [];

  if (frequency_days > 0) {
    // Limpiar eventos programados antiguos para esta misma tarea
    let deleteQuery = supabase.from('events').delete()
      .eq('user_id', jardin.id)
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
        user_id: jardin.id,
        type,
        date: getLocalDateString(nextDate),
        notes: `[PROGRAMADO] Tarea programada cada ${frequency_days} días${etiquetaMetodo ? ` (aplicación ${etiquetaMetodo})` : ''}.${hastaCuando ? ` Revisar hasta: ${hastaCuando}.` : ''}`,
        frequency_days,
        plant_id: plant_id || null,
        product_id: product_id || null
      });
      nextDate.setDate(nextDate.getDate() + frequency_days);
    }
  }

  // Una fecha que aún no ha llegado es un plan, no el registro de algo hecho.
  // Sin marcarla como aviso, al pasar el día la agenda la tomaba por una
  // aplicacion antigua y la archivaba sola en el historial: el tratamiento
  // desaparecia sin que nadie lo hubiera dado por hecho.
  const hoyStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const eventsToInsert = finalDates.map(d => ({
    user_id: jardin.id,
    type,
    date: d,
    notes: d > hoyStr
      ? `[PROGRAMADO] ${notasFinales || 'Tratamiento previsto.'}`
      : notasFinales,
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

  // Insert future events if any, sin pasarse del límite del producto
  if (futureEventsToInsert.length > 0) {
    const tarea = { type, plant_id: plant_id || null, product_id: product_id || null };
    const cupo = await cupoDeAplicaciones(supabase, jardin.id, tarea);
    const permitidos = cupo ? Math.min(futureEventsToInsert.length, cupo.restantes) : futureEventsToInsert.length;
    if (permitidos > 0) {
      await supabase.from('events').insert(futureEventsToInsert.slice(0, permitidos));
    }
    if (cupo && cupo.restantes === 0) {
      await cerrarPorLimite(supabase, jardin.id, tarea, cupo);
    }
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

  const jardin = await jardinDe(supabase, user);

  const today = new Date().toISOString().split('T')[0];

  // Delete all future PROGRAMADO events for this plant
  let query = supabase.from('events').delete()
    .eq('user_id', jardin.id)
    .eq('plant_id', plant_id)
    .gt('date', today)
    .like('notes', '%[PROGRAMADO]%');
    
  if (product_id) {
    query = query.eq('product_id', product_id);
  }

  await query;
  
  // Add a "Planta Curada" historical record
  await supabase.from('events').insert({
    user_id: jardin.id,
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

  const jardin = await jardinDe(supabase, user);

  const type = formData.get('type') as string;
  const date = formData.get('date') as string;
  const notes = formData.get('notes') as string;
  const plant_id = formData.get('plant_id') as string;
  const product_id = formData.get('product_id') as string;

  if (!type || !date) {
    throw new Error('Tipo y fecha son obligatorios');
  }

  // Las etiquetas de estado no pueden perderse al editar. El formulario enseña
  // la nota en crudo, así que basta con que el usuario borre el "[PROGRAMADO]"
  // que le afea el texto para que el aviso deje de contar como pendiente y se
  // entierre solo en el historial en cuanto pase su fecha.
  const { data: previo } = await supabase
    .from('events')
    .select('notes, date, frequency_days')
    .match({ id, user_id: jardin.id })
    .single();

  let notasFinales = notes?.trim() || '';
  const etiquetasPrevias = (previo?.notes || '').match(/\[(PROGRAMADO|POSPUESTO|HECHO|FIN)\]/g) || [];
  for (const etiqueta of etiquetasPrevias) {
    if (!notasFinales.includes(etiqueta)) {
      notasFinales = notasFinales ? `${etiqueta} ${notasFinales}` : etiqueta;
    }
  }

  const { error } = await supabase.from('events').update({
    type,
    date,
    notes: notasFinales || null,
    plant_id: plant_id || null,
    product_id: product_id || null
  }).match({ id, user_id: jardin.id });

  if (error) {
    console.error("Error al actualizar evento:", error);
    throw new Error('Error al actualizar el evento en la base de datos');
  }

  // Mover una fecha descolocaba la pauta: el resto de avisos se quedaban donde
  // estaban y entre uno y otro ya no había los días que tocaban. Si la tarea
  // tiene pauta y la fecha ha cambiado, los siguientes se recolocan a partir
  // de la nueva.
  const pauta = previo ? leerFrecuencia(previo) : 0;
  if (pauta > 0 && previo?.date && previo.date !== date) {
    let borrar = supabase.from('events').delete()
      .eq('user_id', jardin.id)
      .eq('type', type)
      .neq('id', id)
      .gt('date', date)
      .like('notes', '%[PROGRAMADO]%')
      .not('notes', 'like', '%[HECHO]%');

    if (plant_id) borrar = borrar.eq('plant_id', plant_id);
    else borrar = borrar.is('plant_id', null);
    if (product_id) borrar = borrar.eq('product_id', product_id);
    else borrar = borrar.is('product_id', null);

    await borrar;

    const enTexto = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const [aa, mm, dd] = date.split('-').map(Number);
    const siguiente = new Date(aa, mm - 1, dd);

    const cupoEd = await cupoDeAplicaciones(supabase, jardin.id, { type, plant_id: plant_id || null, product_id: product_id || null });
    const nuevos = [];
    for (let i = 0; i < (cupoEd ? Math.min(3, cupoEd.restantes) : 3); i++) {
      siguiente.setDate(siguiente.getDate() + pauta);
      nuevos.push({
        user_id: jardin.id,
        type,
        date: enTexto(siguiente),
        notes: `[PROGRAMADO] Tarea programada cada ${pauta} días.`,
        frequency_days: pauta,
        plant_id: plant_id || null,
        product_id: product_id || null,
      });
    }
    await supabase.from('events').insert(nuevos);
  }

  revalidatePath('/');
  revalidatePath('/calendar');
  if (plant_id) {
    revalidatePath(`/plants/${plant_id}`);
  }
  redirect('/');
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuario no autenticado');

  const jardin = await jardinDe(supabase, user);

  const { error } = await supabase.from('events').delete().match({ id, user_id: jardin.id });
  
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

  const jardin = await jardinDe(supabase, user);

  const { error } = await supabase.from('events').delete().eq('user_id', jardin.id);
  
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

  const jardin = await jardinDe(supabase, user);

  // Recuperamos el evento completo para saber qué se ha pospuesto
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('type, date, notes, plants(name), products(name)')
    .eq('id', id)
    .single();
    
  if (fetchError || !event) {
    throw new Error('No se pudo recuperar el evento');
  }

  // Un día más tarde de lo que ya estaba, nunca hacia atrás. Antes se ponía
  // siempre "mañana": en un aviso de dentro de diez días, "+1 día" lo
  // adelantaba nueve en lugar de posponerlo.
  const aFecha = (t: string) => { const [a, m, d] = t.split('-').map(Number); return new Date(a, m - 1, d); };
  const enTexto = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const hoyObj = new Date();
  hoyObj.setHours(0, 0, 0, 0);
  const partida = event.date && aFecha(event.date) > hoyObj ? aFecha(event.date) : hoyObj;
  partida.setDate(partida.getDate() + 1);
  const tomorrowStr = enTexto(partida);

  const currentNotes = event.notes || '';
  const newNotes = currentNotes.includes('[POSPUESTO]') ? currentNotes : `${currentNotes} [POSPUESTO]`.trim();

  const { error } = await supabase
    .from('events')
    .update({ date: tomorrowStr, notes: newNotes })
    .match({ id, user_id: jardin.id });

  if (error) {
    console.error("Error al posponer evento:", error);
    throw new Error('Error al posponer el evento en la base de datos');
  }

  // Aviso inmediato por WhatsApp de que la tarea se ha aplazado.
  const productName = (event.products as unknown as { name: string } | null)?.name || event.type;
  const plantName = (event.plants as unknown as { name: string } | null)?.name || 'General';
  const alertText = `🕒 *Pospuesto a mañana:*\nSe ha aplazado la tarea de ${productName} en ${plantName}.`;
  
  const { data: contacts } = await supabase.from('notification_contacts').select('phone_number, api_key').eq('user_id', jardin.id);
  
  for (const contact of contacts || []) {
    if (contact.phone_number && contact.api_key) {
      // Sin esperar a que termine, para no retener la interfaz.
      enviarWhatsApp(contact.phone_number, contact.api_key, alertText)
        .catch(e => console.error('Error enviando aviso de posponer:', e));
    }
  }

  revalidatePath('/');
  revalidatePath('/calendar');
}

export async function completeEvent(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuario no autenticado');

  const jardin = await jardinDe(supabase, user);

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
      .match({ id, user_id: jardin.id });
      
    // Si la tarea tenía una frecuencia, debemos re-programar los próximos eventos a partir de HOY
    if (frequency_days > 0) {
      // 1. Borrar los eventos futuros programados para esta misma tarea
      let deleteQuery = supabase.from('events').delete()
        .eq('user_id', jardin.id)
        .eq('type', event.type)
        .like('notes', '%[PROGRAMADO]%');
        
      if (event.plant_id) deleteQuery = deleteQuery.eq('plant_id', event.plant_id);
      else deleteQuery = deleteQuery.is('plant_id', null);
      
      if (event.product_id) deleteQuery = deleteQuery.eq('product_id', event.product_id);
      else deleteQuery = deleteQuery.is('product_id', null);
      
      await deleteQuery;
      
      // 2. Crear los 3 próximos eventos calculados desde HOY
      const nextDate = new Date(todayObj);
      nextDate.setDate(nextDate.getDate() + frequency_days);
      
      // Cuántas quedan antes del límite del producto. Se cuenta DESPUÉS de
      // haber marcado ésta como hecha, así que ya va incluida.
      const tarea = { type: event.type, plant_id: event.plant_id || null, product_id: event.product_id || null };
      const cupo = await cupoDeAplicaciones(supabase, jardin.id, tarea);
      const aProgramar = cupo ? Math.min(3, cupo.restantes) : 3;

      if (cupo && cupo.restantes === 0) {
        await cerrarPorLimite(supabase, jardin.id, tarea, cupo);
      }

      const futureEventsToInsert = [];
      for (let i = 0; i < aProgramar; i++) {
        futureEventsToInsert.push({
          user_id: jardin.id,
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
  dosage?: string | null;
}): Promise<{ product?: { id: string; name: string; type: string | null; description: string | null; dosage: string | null; frequency_days: number | null }; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Usuario no autenticado' };

  const jardin = await jardinDe(supabase, user);

  const { name, type } = identificado;
  if (!name || !type) return { error: 'La identificación llegó incompleta' };

  // La pauta leída de la etiqueta manda; si no se pudo leer, se deduce igual
  // que al dar de alta un producto a mano.
  const frequency_days = identificado.frequency_days
    ?? (await deducirFrecuencia(name, type, identificado.description)).frequency_days;

  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: jardin.id,
      name,
      type,
      description: identificado.description || null,
      dosage: identificado.dosage || null,
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
 * Eventos de la misma tarea: la combinación tipo + planta + producto, la misma
 * que usa addEvent para reemplazar avisos programados.
 */
type ClaveTarea = { type: string; plant_id: string | null; product_id: string | null };

export type CupoAplicaciones = { limite: number; periodo: string; hechas: number; restantes: number };

/**
 * Cuántas aplicaciones más admite un tratamiento antes de tocar el límite
 * anotado en su producto. Devuelve null si no hay límite — o si la migración
 * 009 aún no está aplicada, para que nada se rompa mientras tanto.
 *
 * Cuenta solo la TANDA en curso, no el historial entero: un tope de «3 en
 * total» significa tres aplicaciones seguidas de tratamiento, no tres en la
 * vida del jardín. Si hace más de un corte que no se trata, la cuenta arranca
 * de cero, porque eso ya es una tanda nueva.
 */
async function cupoDeAplicaciones(
  supabase: SupabaseClient,
  userId: string,
  tarea: ClaveTarea,
): Promise<CupoAplicaciones | null> {
  if (!tarea.product_id) return null;

  try {
    const { data: producto, error } = await supabase
      .from('products')
      .select('max_aplicaciones, limite_periodo, frequency_days')
      .match({ id: tarea.product_id, user_id: userId })
      .maybeSingle();

    if (error || !producto) return null;

    const limite = Number(producto.max_aplicaciones);
    if (!limite || limite < 1) return null;

    const periodo = producto.limite_periodo === 'total' ? 'total' : 'anual';
    const corte = cortePorInactividad(Number(producto.frequency_days) || 0);

    let consulta = supabase
      .from('events')
      .select('date, notes')
      .eq('user_id', userId)
      .eq('type', tarea.type)
      .eq('product_id', tarea.product_id)
      .order('date', { ascending: false })
      .limit(60);
    consulta = tarea.plant_id ? consulta.eq('plant_id', tarea.plant_id) : consulta.is('plant_id', null);

    const { data: todos } = await consulta;

    // Aplicación real es la que ya no es un aviso pendiente: o se registró a
    // mano, o se marcó como hecha.
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    const reales = (todos || [])
      .filter((e: { notes: string | null; date: string }) => !e.notes?.includes('[PROGRAMADO]') && e.date <= hoy)
      .map((e: { date: string }) => e.date);

    const hechas = aplicacionesDeLaTanda(reales, hoy, corte, periodo);
    return { limite, periodo, hechas, restantes: Math.max(0, limite - hechas) };
  } catch {
    return null;
  }
}

/**
 * Cierra un tratamiento que ha agotado su cupo: marca la última aplicación
 * real con [FIN] y deja dicho por qué. Sin esto el tratamiento se quedaría sin
 * avisos y sin explicación, que es justo como se pierden las cosas de vista.
 */
async function cerrarPorLimite(supabase: SupabaseClient, userId: string, tarea: ClaveTarea, cupo: CupoAplicaciones) {
  let consulta = supabase
    .from('events')
    .select('id, notes')
    .eq('user_id', userId)
    .eq('type', tarea.type)
    .eq('product_id', tarea.product_id)
    .order('date', { ascending: false })
    .limit(20);
  consulta = tarea.plant_id ? consulta.eq('plant_id', tarea.plant_id) : consulta.is('plant_id', null);

  const { data: todos } = await consulta;
  const ultima = (todos || []).find((e: { notes: string | null }) => !e.notes?.includes('[PROGRAMADO]'));
  if (!ultima || ultima.notes?.includes('[FIN]')) return;

  const cierre = cupo.periodo === 'total'
    ? `Límite alcanzado: ${cupo.limite} aplicaciones en esta tanda.`
    : `Límite alcanzado: ${cupo.limite} aplicaciones en un año.`;

  await supabase
    .from('events')
    .update({ notes: `${ultima.notes || ''} ${cierre} [FIN]`.trim() })
    .match({ id: ultima.id, user_id: userId });
}

function claveDeTarea(e: { type: string; plant_id?: string | null; product_id?: string | null }): string {
  return `${e.type}|${e.plant_id || ''}|${e.product_id || ''}`;
}

function esMismaTarea(a: { type: string; plant_id?: string | null; product_id?: string | null }, b: { type: string; plant_id?: string | null; product_id?: string | null }): boolean {
  return claveDeTarea(a) === claveDeTarea(b);
}

function agrupaPorTarea(programados: EventoFila[]): EventoFila[][] {
  const grupos = new Map<string, EventoFila[]>();
  for (const e of programados) {
    const clave = claveDeTarea(e);
    grupos.set(clave, [...(grupos.get(clave) || []), e]);
  }
  return [...grupos.values()];
}

/** El modo de aplicación que los eventos nuevos llevan escrito en las notas. */
function metodoDeLasNotas(notes?: string | null): string | null {
  return notes?.match(/\(aplicación ([^)]+)\)/)?.[1] || null;
}

/** La condición de parada que los avisos llevan escrita en las notas. */
function hastaDeLasNotas(notes?: string | null): string | null {
  return notes?.match(/Revisar hasta: (.+?)\.(?:\s|$)/)?.[1] || null;
}

/**
 * Deja una tarea con 3 avisos [PROGRAMADO] a la pauta indicada, borrando antes
 * los que hubiera. El primer aviso se ancla en la última aplicación real; si
 * nunca la hubo, conserva la próxima cita y solo reespacia las siguientes.
 */
async function reprogramarTarea(
  supabase: SupabaseClient,
  userId: string,
  tarea: EventoFila,
  idsABorrar: string[],
  todos: EventoFila[],
  dias: number,
  metodo: string | null,
  hasta: string | null,
): Promise<boolean> {
  const fechaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const reales = todos.filter(e => esMismaTarea(e, tarea) && !e.notes?.includes('[PROGRAMADO]'));
  const ultimaReal = reales.length ? reales[reales.length - 1].date : null;

  let siguiente: Date;
  if (ultimaReal) {
    siguiente = new Date(ultimaReal);
    siguiente.setDate(siguiente.getDate() + dias);
  } else {
    siguiente = new Date(tarea.date);
  }
  if (siguiente < hoy) siguiente = new Date(hoy);

  if (idsABorrar.length > 0) {
    const { error: errorBorrado } = await supabase.from('events').delete().in('id', idsABorrar);
    if (errorBorrado) {
      console.error('Error borrando los avisos antiguos:', errorBorrado);
      return false;
    }
  }

  // El recálculo de pautas tampoco puede pasarse del límite del producto.
  const claveTarea = { type: tarea.type, plant_id: tarea.plant_id || null, product_id: tarea.product_id || null };
  const cupoTarea = await cupoDeAplicaciones(supabase, userId, claveTarea);
  if (cupoTarea && cupoTarea.restantes === 0) {
    await cerrarPorLimite(supabase, userId, claveTarea, cupoTarea);
    return false;
  }

  const nuevos = [];
  for (let i = 0; i < (cupoTarea ? Math.min(3, cupoTarea.restantes) : 3); i++) {
    nuevos.push({
      user_id: userId,
      type: tarea.type,
      date: fechaLocal(siguiente),
      notes: `[PROGRAMADO] Tarea programada cada ${dias} días${metodo ? ` (aplicación ${metodo})` : ''}.${hasta ? ` Revisar hasta: ${hasta}.` : ''}`,
      frequency_days: dias,
      plant_id: tarea.plant_id || null,
      product_id: tarea.product_id || null,
    });
    siguiente.setDate(siguiente.getDate() + dias);
  }

  const { error: errorInsercion } = await supabase.from('events').insert(nuevos);
  if (errorInsercion) {
    console.error('Error reprogramando los avisos:', errorInsercion);
    return false;
  }
  return true;
}

/**
 * Al cambiar la pauta de un producto, sus avisos programados se reprograman
 * solos con la nueva frecuencia, sin pasos extra.
 */
async function propagarFrecuenciaDeProducto(supabase: SupabaseClient, userId: string, productId: string, dias: number) {
  const { data: events } = await supabase
    .from('events')
    .select('id, type, date, notes, frequency_days, plant_id, product_id')
    .order('date', { ascending: true });
  if (!events) return;

  const programados = (events as unknown as EventoFila[]).filter(e =>
    e.product_id === productId && e.notes?.includes('[PROGRAMADO]') && !e.notes?.includes('[HECHO]'));

  for (const grupo of agrupaPorTarea(programados)) {
    if (leerFrecuencia(grupo[0]) === dias) continue;
    await reprogramarTarea(supabase, userId, grupo[0], grupo.map(g => g.id), events, dias, metodoDeLasNotas(grupo[0].notes), hastaDeLasNotas(grupo[0].notes));
  }
}

/**
 * Repasa las tareas programadas (todas, o solo las de un producto) y les
 * recalcula la pauta con la IA según su caso: producto + planta + modo si
 * consta en las notas. Además reactiva las tareas apagadas: las que tienen
 * producto con pauta y aplicaciones reales pero se quedaron sin avisos
 * pendientes (por completarse sin frecuencia o por una limpieza), que hasta
 * ahora desaparecían del radar sin que nadie volviera a avisar.
 */
export async function recalcularPautasProgramadas(productId?: string): Promise<{
  cambios?: { tarea: string; antes: number; ahora: number; motivo: string; hasta: string | null }[];
  reactivadas?: { tarea: string; dias: number; ultima: string; motivo: string; hasta: string | null }[];
  yaCorrectas?: string[];
  sinProducto?: number;
  sinPauta?: string[];
  sinRegistrar?: string[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Usuario no autenticado' };

  const jardin = await jardinDe(supabase, user);

  const { data: eventsData, error } = await supabase
    .from('events')
    .select('id, type, date, notes, frequency_days, plant_id, product_id, products(name, type, description, frequency_days), plants(name, species)')
    .order('date', { ascending: true });

  if (error || !eventsData) {
    console.error('Error leyendo los eventos para recalcular pautas:', error);
    return { error: 'No se pudieron leer los eventos' };
  }
  // El generador de tipos de Supabase ve los joins a-uno como arrays; aquí
  // llegan como objeto. Se fija en esta frontera y el resto queda tipado.
  const events = eventsData as unknown as EventoFila[];

  const programados = events.filter(e =>
    e.notes?.includes('[PROGRAMADO]') && !e.notes?.includes('[HECHO]') &&
    (!productId || e.product_id === productId));

  const cambios: { tarea: string; antes: number; ahora: number; motivo: string; hasta: string | null }[] = [];
  const reactivadas: { tarea: string; dias: number; ultima: string; motivo: string; hasta: string | null }[] = [];
  const yaCorrectas: string[] = [];
  const sinPauta: string[] = [];
  let sinProducto = 0;

  for (const grupo of agrupaPorTarea(programados)) {
    const muestra = grupo[0];
    const producto = muestra.products ?? null;
    const planta = muestra.plants ?? null;

    if (!producto?.name) {
      sinProducto += 1;
      continue;
    }

    const tarea = `${producto.name}${planta?.name ? ` en ${planta.name}` : ''}`;
    const metodo = metodoDeLasNotas(muestra.notes);
    const pauta = await frecuenciaSegunCaso({
      producto: { nombre: producto.name, tipo: producto.type, descripcion: producto.description },
      planta: planta ? { nombre: planta.name, especie: planta.species } : null,
      metodo,
    });
    if (!pauta) continue;

    const antes = leerFrecuencia(muestra);
    const ahora = pauta.frequency_days;
    if (ahora === antes) {
      yaCorrectas.push(`${tarea} (cada ${antes} días)`);
      continue;
    }

    if (await reprogramarTarea(supabase, jardin.id, muestra, grupo.map(g => g.id), events, ahora, metodo, pauta.hasta ?? hastaDeLasNotas(muestra.notes))) {
      cambios.push({ tarea, antes, ahora, motivo: pauta.motivo, hasta: pauta.hasta });
    }
  }

  // Tareas apagadas: la última aplicación real de cada tarea con producto,
  // para resucitar las que no tengan ya ningún aviso pendiente.
  const clavesPendientes = new Set(programados.map(claveDeTarea));
  const ultimaRealPorTarea = new Map<string, EventoFila>();
  for (const e of events) {
    if (e.notes?.includes('[PROGRAMADO]')) continue;
    if (!e.product_id) continue;
    if (productId && e.product_id !== productId) continue;
    ultimaRealPorTarea.set(claveDeTarea(e), e); // ordenados por fecha: queda la última
  }

  for (const [clave, ultimo] of ultimaRealPorTarea) {
    if (clavesPendientes.has(clave)) continue;
    // [FIN] marca un tratamiento dado por terminado a propósito: no se
    // resucita hasta que el usuario vuelva a registrarlo.
    if (ultimo.notes?.includes('[FIN]')) continue;
    const producto = ultimo.products ?? null;
    const planta = ultimo.plants ?? null;
    if (!producto?.name) continue;
    // Un sustrato o una herramienta no se aplican cada X días.
    if (producto.type && ['Sustrato', 'Herramienta'].includes(producto.type)) continue;

    const metodo = metodoDeLasNotas(ultimo.notes);
    const pauta = await frecuenciaSegunCaso({
      producto: { nombre: producto.name, tipo: producto.type, descripcion: producto.description },
      planta: planta ? { nombre: planta.name, especie: planta.species } : null,
      metodo,
    });
    // La pauta del caso manda; la guardada del producto es el respaldo. Los
    // productos de antes de que existiera la columna la tienen vacía, y por
    // eso no pueden ser requisito: se rellena aquí con lo que diga la IA.
    const dias = pauta?.frequency_days ?? producto.frequency_days;
    if (!dias) {
      sinPauta.push(`${producto.name}${planta?.name ? ` en ${planta.name}` : ''}`);
      continue;
    }

    if (!producto.frequency_days && ultimo.product_id) {
      await supabase
        .from('products')
        .update({ frequency_days: dias, frequency_source: 'ia' })
        .match({ id: ultimo.product_id, user_id: jardin.id });
    }

    if (await reprogramarTarea(supabase, jardin.id, ultimo, [], events, dias, metodo, pauta?.hasta ?? null)) {
      reactivadas.push({
        tarea: `${producto.name}${planta?.name ? ` en ${planta.name}` : ''}`,
        dias,
        ultima: ultimo.date,
        motivo: pauta?.motivo || 'Se retoma con la pauta guardada del producto.',
        hasta: pauta?.hasta ?? null,
      });
    }
  }

  const { data: productos } = await supabase
    .from('products')
    .select('id, name, type, frequency_days');
  const usados = new Set(events.map(e => e.product_id).filter(Boolean));
  const sinRegistrar = (productos || [])
    .filter(pr =>
      !['Sustrato', 'Herramienta'].includes(pr.type) &&
      !usados.has(pr.id) &&
      (!productId || pr.id === productId))
    .map(pr => pr.name);

  revalidatePath('/');
  revalidatePath('/calendar');
  return { cambios, reactivadas, yaCorrectas, sinProducto, sinPauta, sinRegistrar };
}

/**
 * Da por terminado un tratamiento: borra los avisos [PROGRAMADO] pendientes de
 * su misma tarea y marca la última aplicación real con [FIN] para que la
 * revisión de pautas no lo resucite. El historial se conserva, y registrar de
 * nuevo el tratamiento lo reabre con normalidad.
 */
export async function terminarTratamiento(eventId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuario no autenticado');

  const jardin = await jardinDe(supabase, user);

  const { data: evento } = await supabase
    .from('events')
    .select('type, plant_id, product_id')
    .match({ id: eventId, user_id: jardin.id })
    .single();
  if (!evento) return;

  let borrado = supabase.from('events').delete()
    .eq('user_id', jardin.id)
    .eq('type', evento.type)
    .like('notes', '%[PROGRAMADO]%')
    .not('notes', 'like', '%[HECHO]%');
  borrado = evento.plant_id ? borrado.eq('plant_id', evento.plant_id) : borrado.is('plant_id', null);
  borrado = evento.product_id ? borrado.eq('product_id', evento.product_id) : borrado.is('product_id', null);
  await borrado;

  // Marcar la última aplicación real con [FIN]. El or() cubre las notas nulas:
  // NOT LIKE sobre NULL las dejaría fuera y son aplicaciones válidas.
  let consulta = supabase
    .from('events')
    .select('id, notes')
    .eq('user_id', jardin.id)
    .eq('type', evento.type)
    .or('notes.is.null,notes.not.like.*[PROGRAMADO]*')
    .order('date', { ascending: false })
    .limit(1);
  consulta = evento.plant_id ? consulta.eq('plant_id', evento.plant_id) : consulta.is('plant_id', null);
  consulta = evento.product_id ? consulta.eq('product_id', evento.product_id) : consulta.is('product_id', null);
  const { data: ultimas } = await consulta;
  const ultima = ultimas?.[0];
  if (ultima && !ultima.notes?.includes('[FIN]')) {
    await supabase
      .from('events')
      .update({ notes: `${ultima.notes || ''} [FIN]`.trim() })
      .match({ id: ultima.id, user_id: jardin.id });
  }

  revalidatePath('/');
  revalidatePath('/calendar');
}

/**
 * Guarda el resultado de un recorrido con cámara por el jardín. Cada detección
 * crea una planta nueva (con su foto y su posición GPS si la hay) o completa
 * una ya registrada: a las existentes se les rellena lo que les falte (foto,
 * posición) y, solo si el usuario lo marca, se les sustituye la foto por la
 * captura del recorrido.
 */
export async function guardarRecorrido(detecciones: {
  nombre: string;
  especie: string;
  descripcion: string | null;
  foto: string | null; // dataURL JPEG capturado durante el recorrido
  lat: number | null;
  lng: number | null;
  plantaExistenteId: string | null;
  actualizarFoto?: boolean; // en las ya registradas: sustituir su foto por esta captura
}[]): Promise<{ creadas: string[]; actualizadas: string[]; errores: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { creadas: [], actualizadas: [], errores: ['Usuario no autenticado'] };

  const jardin = await jardinDe(supabase, user);

  const creadas: string[] = [];
  const actualizadas: string[] = [];
  const errores: string[] = [];

  const subirFoto = async (dataUrl: string): Promise<string | null> => {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const buffer = Buffer.from(base64, 'base64');
    const filePath = `${user.id}/${Math.random().toString(36).substring(2, 15)}.jpg`;
    const { error } = await supabase.storage
      .from('plant_images')
      .upload(filePath, buffer, { contentType: 'image/jpeg' });
    if (error) {
      console.error('Error subiendo la foto del recorrido:', error);
      return null;
    }
    return supabase.storage.from('plant_images').getPublicUrl(filePath).data.publicUrl;
  };

  for (const d of detecciones.slice(0, 60)) {
    const nombre = d.nombre?.trim() || d.especie?.trim();
    if (!nombre) {
      errores.push('Una detección venía sin nombre ni especie y se ha saltado.');
      continue;
    }

    try {
      if (d.plantaExistenteId) {
        // Completar la planta ya registrada sin pisar lo que ya tiene.
        const { data: existente } = await supabase
          .from('plants')
          .select('id, name, image_url, lat, lng, path')
          .match({ id: d.plantaExistenteId, user_id: jardin.id })
          .single();
        if (!existente) {
          errores.push(`${nombre}: la planta registrada a la que apuntaba ya no existe.`);
          continue;
        }
        const cambios: Record<string, unknown> = {};
        // La captura se sube siempre: alimenta el historial de evolución.
        const urlFoto = d.foto ? await subirFoto(d.foto) : null;
        // La foto de portada se sustituye solo si falta o si el usuario lo pidió.
        if (urlFoto && (d.actualizarFoto || !existente.image_url)) {
          cambios.image_url = urlFoto;
        }
        if (existente.lat == null && !existente.path && d.lat != null && d.lng != null) {
          cambios.lat = d.lat;
          cambios.lng = d.lng;
        }
        if (Object.keys(cambios).length > 0) {
          await supabase.from('plants').update(cambios).match({ id: existente.id, user_id: jardin.id });
        }
        if (urlFoto) {
          // Si la tabla del historial aún no existe, este insert falla sin más.
          await supabase.from('plant_photos').insert({
            user_id: jardin.id,
            plant_id: existente.id,
            url: urlFoto,
            note: d.descripcion?.slice(0, 400) || 'Captura del recorrido',
          });
        }
        actualizadas.push(existente.name);
      } else {
        const image_url = d.foto ? await subirFoto(d.foto) : null;
        const icon_category = await resolverCategoria(d.especie, nombre);
        const { data: creada, error } = await supabase.from('plants').insert({
          user_id: jardin.id,
          name: nombre,
          species: d.especie?.trim() || null,
          description: d.descripcion?.trim() || null,
          icon_category,
          image_url,
          lat: d.lat,
          lng: d.lng,
        }).select('id').single();
        if (error) {
          console.error('Error guardando planta del recorrido:', error);
          errores.push(`${nombre}: no se pudo guardar.`);
        } else {
          creadas.push(nombre);
          if (image_url && creada?.id) {
            // Primera entrada del historial de evolución (si la tabla existe).
            await supabase.from('plant_photos').insert({
              user_id: jardin.id,
              plant_id: creada.id,
              url: image_url,
              note: d.descripcion?.slice(0, 400) || 'Captura del recorrido',
            });
          }
        }
      }
    } catch (e) {
      console.error('Error procesando detección del recorrido:', e);
      errores.push(`${nombre}: error inesperado.`);
    }
  }

  revalidatePath('/');
  revalidatePath('/plants');
  return { creadas, actualizadas, errores };
}

/**
 * Genera la propuesta de plan preventivo anual: la IA mira plantas, inventario,
 * historial y lo ya programado, más las plagas que el usuario declare (fuente
 * de máxima autoridad: nada de inventar plagas). No inserta nada — devuelve
 * las propuestas para que el usuario elija.
 */
export async function prepararPlanAnual(indicaciones: string): Promise<{ propuestas?: PropuestaPlan[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Usuario no autenticado' };

  const jardin = await jardinDe(supabase, user);

  const { data: plants } = await supabase.from('plants').select('name, species, lat, lng').eq('user_id', jardin.id);
  const { data: products } = await supabase.from('products').select('name, type, description').eq('user_id', jardin.id);
  const { data: events } = await supabase.from('events')
    .select('type, date, notes, products(name), plants(name)')
    .order('date', { ascending: false })
    .limit(120);

  const linea = (e: EventoFila) => {
    const producto = e.products?.name || e.type;
    const planta = e.plants?.name;
    const nota = e.notes ? ` — ${e.notes.replace(/\[[A-Z]+\]/g, '').trim().slice(0, 80)}` : '';
    return `- ${e.date}: ${producto}${planta ? ` en ${planta}` : ''}${nota}`;
  };
  const reales = ((events || []) as unknown as EventoFila[]).filter(e => !e.notes?.includes('[PROGRAMADO]')).slice(0, 40);
  const programados = ((events || []) as unknown as EventoFila[]).filter(e => e.notes?.includes('[PROGRAMADO]') && !e.notes?.includes('[HECHO]')).slice(0, 30);

  const { data: parcelas } = await supabase.from('parcels').select('geojson').eq('user_id', jardin.id).limit(1);
  const conPos = (plants || []).find((p: { lat: number | null; lng: number | null }) => p.lat != null && p.lng != null);
  const coordenadas = centroDeGeojson(parcelas?.[0]?.geojson)
    || (conPos ? { lat: conPos.lat, lng: conPos.lng } : null);

  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

  const propuestas = await generarPlanAnual({
    hoy,
    coordenadas,
    plantas: (plants || []).map((p: { name: string; species: string | null }) => ({ nombre: p.name, especie: p.species })),
    inventario: (products || []).map((p: { name: string; type: string; description: string | null }) => ({ nombre: p.name, tipo: p.type, descripcion: p.description })),
    historial: reales.map(linea),
    programado: programados.map(linea),
    indicaciones: indicaciones?.slice(0, 600) || null,
  });

  if (!propuestas) return { error: 'La IA no pudo generar el plan. Inténtalo de nuevo en un momento.' };
  return { propuestas };
}

/**
 * Programa las propuestas del plan anual que el usuario haya elegido, como
 * avisos [PROGRAMADO] normales: entran en la agenda, el WhatsApp y el ciclo
 * de hecho/pospuesto como cualquier otro.
 */
export async function aplicarPlanAnual(seleccion: PropuestaPlan[]): Promise<{ creadas: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { creadas: 0, error: 'Usuario no autenticado' };

  const jardin = await jardinDe(supabase, user);

  const { data: plants } = await supabase.from('plants').select('id, name').eq('user_id', jardin.id);
  const { data: products } = await supabase.from('products').select('id, name').eq('user_id', jardin.id);
  const limpia = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  let creadas = 0;
  for (const p of seleccion.slice(0, 12)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) continue;
    const plant_id = p.planta ? (plants || []).find(x => limpia(x.name) === limpia(p.planta!))?.id ?? null : null;
    const product_id = p.producto ? (products || []).find(x => limpia(x.name) === limpia(p.producto!))?.id ?? null : null;
    const texto = `${p.titulo}. ${p.motivo}`.replace(/[\[\]]/g, '').slice(0, 380);
    const { error } = await supabase.from('events').insert({
      user_id: jardin.id,
      type: p.tipo,
      date: p.fecha,
      notes: `[PROGRAMADO] Plan anual: ${texto}${p.hasta ? ` Revisar hasta: ${p.hasta.replace(/[\[\]]/g, '').slice(0, 120)}.` : ''}`,
      frequency_days: p.frequency_days,
      plant_id,
      product_id,
    });
    if (!error) creadas += 1;
  }

  revalidatePath('/');
  revalidatePath('/calendar');
  return { creadas };
}

export type RespuestaAsistente = {
  respuesta: string;
  hechos: string[];
  enlaces: { href: string; etiqueta: string }[];
  error?: string;
};

const ENLACES_ASISTENTE: Record<EnlaceAsistente, { href: string; etiqueta: string }> = {
  inventario: { href: '/products', etiqueta: 'Ver inventario' },
  nuevo_producto: { href: '/products/new', etiqueta: 'Añadir producto (escanea la etiqueta)' },
  nueva_planta: { href: '/plants/new', etiqueta: 'Añadir planta con foto' },
  nuevo_tratamiento: { href: '/calendar/new', etiqueta: 'Registrar tratamiento' },
  recorrido: { href: '/recorrido', etiqueta: 'Iniciar recorrido' },
  ajustes: { href: '/settings', etiqueta: 'Abrir ajustes' },
};

/**
 * El asistente de la home: recibe la petición en lenguaje natural, la
 * interpreta la IA con el jardín como contexto, y aquí se ejecutan los
 * registros que decida (eventos, productos, plantas) con los mismos campos
 * que usan los formularios. Devuelve la contestación, la lista de lo que ha
 * quedado registrado y los enlaces a pantallas que convenga abrir.
 */
export async function consultarAsistente(
  texto: string,
  previas: { pregunta: string; respuesta: string }[],
): Promise<RespuestaAsistente> {
  const vacio = { respuesta: '', hechos: [], enlaces: [] };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...vacio, error: 'Usuario no autenticado' };

  const jardin = await jardinDe(supabase, user);

  const peticion = texto?.trim().slice(0, 600);
  if (!peticion) return { ...vacio, error: 'Cuéntame algo primero.' };

  const [{ data: plants }, { data: products }, { data: events }] = await Promise.all([
    supabase.from('plants').select('id, name, species, description').eq('user_id', jardin.id),
    supabase.from('products').select('id, name, type, description').eq('user_id', jardin.id),
    supabase.from('events').select('type, date, notes, plants(name), products(name)').order('date', { ascending: false }).limit(25),
  ]);

  // Fecha del dueño, no del servidor: el jardín vive en España.
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });

  type EventoCtx = { type: string; date: string; notes: string | null; plants: { name: string } | null; products: { name: string } | null };
  const agenda = ((events || []) as unknown as EventoCtx[]).map(e => {
    const nota = e.notes ? ` — ${e.notes.replace(/\[[A-Z]+\]/g, '').trim().slice(0, 60)}` : '';
    return `- ${e.date}: ${e.products?.name || e.type}${e.plants?.name ? ` en ${e.plants.name}` : ''}${nota}`;
  });

  const r = await interpretarPeticion(peticion, {
    hoy,
    plantas: (plants || []).map(p => ({ nombre: p.name as string, especie: (p.species as string | null) })),
    inventario: (products || []).map(p => ({ nombre: p.name as string, tipo: (p.type as string) || 'Otro' })),
    agenda,
    previas: (previas || []).slice(-4).map(t => ({ pregunta: String(t.pregunta).slice(0, 300), respuesta: String(t.respuesta).slice(0, 300) })),
  });

  if (!r) return { ...vacio, error: 'No he podido pensarlo ahora mismo. Inténtalo de nuevo en un momento.' };

  const limpia = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const fechaCorta = (iso: string) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };
  const hechos: string[] = [];

  for (const ev of (r.eventos || []).slice(0, 5)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.fecha)) continue;
    const plant_id = ev.planta ? (plants || []).find(x => limpia(x.name) === limpia(ev.planta!))?.id ?? null : null;
    const product_id = ev.producto ? (products || []).find(x => limpia(x.name) === limpia(ev.producto!))?.id ?? null : null;
    const nota = ev.nota.replace(/[\[\]]/g, '').trim().slice(0, 380);
    const esFuturo = ev.fecha > hoy;
    const { error } = await supabase.from('events').insert({
      user_id: jardin.id,
      type: ev.tipo,
      date: ev.fecha,
      notes: esFuturo ? `[PROGRAMADO] ${nota}` : nota,
      frequency_days: ev.frequency_days && ev.frequency_days >= 1 && ev.frequency_days <= 365 ? Math.round(ev.frequency_days) : null,
      plant_id,
      product_id,
    });
    if (!error) hechos.push(`${esFuturo ? 'Programado' : 'Anotado'} el ${fechaCorta(ev.fecha)}: ${nota.slice(0, 90)}`);
  }

  // Los enlaces a lo recién creado se construyen aquí, no los elige la IA:
  // así apuntan a la ficha concreta y no a «nuevo», que duplicaría el alta.
  const enlacesCreados: { href: string; etiqueta: string }[] = [];

  for (const pr of (r.productos || []).slice(0, 2)) {
    const nombre = pr.nombre?.trim().slice(0, 120);
    if (!nombre) continue;
    if ((products || []).some(x => limpia(x.name) === limpia(nombre))) continue;
    const tipo = pr.tipo?.trim().slice(0, 60) || 'Otro';
    const pauta = await deducirFrecuencia(nombre, tipo, pr.descripcion || '');
    const { data: creado } = await supabase.from('products').insert({
      user_id: jardin.id,
      name: nombre,
      type: tipo,
      description: pr.descripcion?.slice(0, 400) || null,
      frequency_days: pauta.frequency_days,
      frequency_source: 'ia',
    }).select('id').single();
    if (creado?.id) {
      hechos.push(`Producto en el inventario: ${nombre} (${tipo})${pauta.frequency_days ? `, pauta orientativa de ${pauta.frequency_days} días` : ''}`);
      enlacesCreados.push({ href: `/products/${creado.id}/edit`, etiqueta: `Completar ficha de ${nombre}` });
    }
  }

  for (const pl of (r.plantas || []).slice(0, 2)) {
    const nombre = pl.nombre?.trim().slice(0, 120);
    if (!nombre) continue;
    if ((plants || []).some(x => limpia(x.name) === limpia(nombre))) continue;
    const { data: creada } = await supabase.from('plants').insert({
      user_id: jardin.id,
      name: nombre,
      species: pl.especie?.slice(0, 120) || null,
      icon_category: categoriaDeEspecie(pl.especie || null, nombre),
    }).select('id').single();
    if (creada?.id) {
      hechos.push(`Planta registrada: ${nombre}${pl.especie ? ` (${pl.especie})` : ''} — ubícala en el mapa`);
      enlacesCreados.push({ href: `/plants/${creada.id}/edit`, etiqueta: `Completar ficha de ${nombre}` });
    }
  }

  // Datos sobre lo que ya tiene: van a la ficha, no a la agenda. La descripción
  // del producto la lee luego el motor de pautas, así que un «solo 3 veces en
  // total» acaba pesando en lo que la app propone.
  for (const nota of (r.notas || []).slice(0, 3)) {
    const texto = nota.nota?.trim().slice(0, 200);
    if (!texto || !nota.nombre) continue;
    const tabla = nota.sobre === 'planta' ? 'plants' : 'products';
    const fichas: { id: string; name: string; description?: string | null }[] =
      nota.sobre === 'planta' ? (plants || []) : (products || []);
    const ficha = fichas.find(x => limpia(x.name) === limpia(nota.nombre));
    if (!ficha) continue;

    const previa = (ficha.description || '').trim();
    if (limpia(previa).includes(limpia(texto))) continue;
    const descripcion = previa ? `${previa}
${texto}` : texto;

    const cambios: Record<string, unknown> = { description: descripcion.slice(0, 1500) };
    // Un tope de aplicaciones no se queda en texto: guardado como número, la
    // app deja de programar avisos al alcanzarlo.
    const tope = nota.sobre === 'producto' && nota.max_aplicaciones && nota.max_aplicaciones >= 1 && nota.max_aplicaciones <= 50
      ? Math.round(nota.max_aplicaciones)
      : null;
    if (tope) {
      cambios.max_aplicaciones = tope;
      cambios.limite_periodo = nota.limite_periodo === 'total' ? 'total' : 'anual';
    }

    let { error } = await supabase.from(tabla)
      .update(cambios)
      .match({ id: ficha.id, user_id: jardin.id });

    // Si la migración 009 aún no está aplicada, al menos que la nota se guarde.
    if (error && tope) {
      ({ error } = await supabase.from(tabla)
        .update({ description: descripcion.slice(0, 1500) })
        .match({ id: ficha.id, user_id: jardin.id }));
    }

    if (!error) {
      hechos.push(tope
        ? `Anotado en ${ficha.name}: ${texto} — la app dejará de programar avisos al llegar a ${tope}`
        : `Anotado en ${ficha.name}: ${texto}`);
    }
  }

  if (hechos.length > 0) {
    revalidatePath('/');
    revalidatePath('/calendar');
    revalidatePath('/plants');
    revalidatePath('/products');
  }

  // Si ya se ha creado la ficha, el enlace genérico de «nueva planta / nuevo
  // producto» sobra: sustituirlo por el de la ficha concreta evita el duplicado.
  const creoPlanta = (r.plantas?.length ?? 0) > 0;
  const creoProducto = (r.productos?.length ?? 0) > 0;
  const sugeridos = [...new Set((r.enlaces || []).filter(e => ENLACES_ASISTENTE[e]))]
    .filter(e => !(e === 'nueva_planta' && creoPlanta) && !(e === 'nuevo_producto' && creoProducto))
    .map(e => ENLACES_ASISTENTE[e]);

  const enlaces = [...enlacesCreados, ...sugeridos].slice(0, 3);
  return { respuesta: r.respuesta?.trim().slice(0, 900) || 'Hecho.', hechos, enlaces };
}

/**
 * Devuelve a la lista de pendientes un evento que se había archivado en el
 * historial. Hace falta porque hasta ahora una fecha futura registrada a mano
 * se guardaba sin marca de aviso y, al pasar el día, la agenda la daba por
 * hecha sola. El dueño dice si se hizo o no; aquí no se adivina.
 */
export async function reabrirEvento(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const jardin = await jardinDe(supabase, user);

  const { data: evento } = await supabase
    .from('events')
    .select('notes')
    .match({ id, user_id: jardin.id })
    .single();

  let notas = (evento?.notes || '').replace(/\[(HECHO|FIN)\]/g, '').trim();
  if (!notas.includes('[PROGRAMADO]')) {
    notas = notas ? `[PROGRAMADO] ${notas}` : '[PROGRAMADO]';
  }

  await supabase.from('events').update({ notes: notas }).match({ id, user_id: jardin.id });

  revalidatePath('/');
  revalidatePath('/calendar');
}

/**
 * Mueve un aviso a hoy sin darlo por hecho: es lo que hace falta cuando algo
 * se quedó atrasado y se piensa hacer hoy mismo. «+1 día» servía para
 * aplazarlo, pero no había forma de traerlo al día de hoy.
 */
export async function pasarAHoy(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const jardin = await jardinDe(supabase, user);

  const { data: evento } = await supabase
    .from('events')
    .select('notes')
    .match({ id, user_id: jardin.id })
    .single();

  // Sigue pendiente, y deja de estar pospuesto: la intención es la contraria.
  let notas = (evento?.notes || '').replace(/\[POSPUESTO\]/g, '').replace(/\s+/g, ' ').trim();
  if (!notas.includes('[PROGRAMADO]')) {
    notas = notas ? `[PROGRAMADO] ${notas}` : '[PROGRAMADO]';
  }

  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  await supabase.from('events').update({ date: hoy, notes: notas }).match({ id, user_id: jardin.id });

  revalidatePath('/');
  revalidatePath('/calendar');
}

/**
 * Quién cuida este jardín. El creador no tiene fila propia en la tabla: se
 * añade aquí para que la lista se lea como lo que es, la gente de la casa.
 */
export async function miembrosDelJardin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Usuario no autenticado' };

  const jardin = await jardinDe(supabase, user);

  const { data, error } = await supabase
    .from('garden_members')
    .select('id, email, member_id, rol, created_at, owner_email')
    .eq('owner_id', jardin.id)
    .order('created_at', { ascending: true });

  if (error) {
    return { error: 'Comparte el jardín ejecutando antes la migración 010.' };
  }

  const dueno = jardin.esDueno ? (user.email || 'Tú') : (data?.[0]?.owner_email || 'el creador');

  return {
    jardin: { esDueno: jardin.esDueno, esAdmin: jardin.esAdmin, rol: jardin.rol, dueno },
    miembros: (data || []).map(m => ({
      id: m.id as string,
      email: m.email as string,
      rol: (m.rol as string) === 'admin' ? 'admin' : 'colaborador',
      aceptada: Boolean(m.member_id),
      soyYo: m.member_id === user.id,
    })),
  };
}

/**
 * Invita a alguien a cuidar este jardín. Basta el correo: la invitación queda
 * esperando y se activa sola cuando esa persona entra, se registre antes o
 * después.
 */
export async function invitarAlJardin(email: string, rol: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Usuario no autenticado' };

  const jardin = await jardinDe(supabase, user);
  if (!jardin.esAdmin) return { error: 'Solo el creador y los administradores pueden invitar.' };

  const correo = (email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return { error: 'Ese correo no parece válido.' };
  if (correo === (user.email || '').toLowerCase()) return { error: 'Ese eres tú.' };

  // Nombrar administradores es cosa del creador; un admin invita colaboradores.
  const rolFinal = rol === 'admin' && jardin.esDueno ? 'admin' : 'colaborador';

  const { error } = await supabase.from('garden_members').insert({
    owner_id: jardin.id,
    owner_email: jardin.esDueno ? user.email : null,
    email: correo,
    rol: rolFinal,
  });

  if (error) {
    if (error.code === '23505') return { error: 'Esa persona ya está invitada.' };
    return { error: 'No se pudo invitar. ¿Está aplicada la migración 010?' };
  }

  revalidatePath('/settings');
  return { ok: `${correo} ya puede entrar con su cuenta y verá este mismo jardín.` };
}

/** Cambia el rol de un miembro. Solo el creador reparte administraciones. */
export async function cambiarRolDelMiembro(id: string, rol: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Usuario no autenticado' };

  const jardin = await jardinDe(supabase, user);
  if (!jardin.esDueno) return { error: 'Solo el creador del jardín puede cambiar roles.' };

  const { error } = await supabase
    .from('garden_members')
    .update({ rol: rol === 'admin' ? 'admin' : 'colaborador' })
    .match({ id, owner_id: jardin.id });

  if (error) return { error: 'No se pudo cambiar el rol.' };
  revalidatePath('/settings');
  return { ok: 'Rol actualizado.' };
}

/** Saca a alguien del jardín. Sus registros se quedan: son del jardín, no suyos. */
export async function quitarDelJardin(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Usuario no autenticado' };

  const jardin = await jardinDe(supabase, user);
  if (!jardin.esAdmin) return { error: 'Solo el creador y los administradores pueden hacer esto.' };

  const { error } = await supabase.from('garden_members').delete().match({ id, owner_id: jardin.id });
  if (error) return { error: 'No se pudo quitar a esa persona.' };

  revalidatePath('/settings');
  return { ok: 'Ya no tiene acceso al jardín.' };
}
