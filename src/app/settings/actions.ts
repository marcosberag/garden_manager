'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { jardinDe } from '@/lib/jardin';

export async function addContact(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Un <form action> de servidor no puede devolver valores: si no hay
  // sesión, simplemente no se guarda nada.
  if (!user) return

  const jardin = await jardinDe(supabase, user)

  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const apikey = formData.get('apikey') as string

  const { error } = await supabase
    .from('notification_contacts')
    .insert([{ user_id: jardin.id, name, phone_number: phone, api_key: apikey }])

  if (!error) {
    revalidatePath('/settings')
  } else {
    console.error("Error al guardar contacto:", error);
  }
}

export async function deleteContact(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notification_contacts')
    .delete()
    .eq('id', id)

  if (!error) {
    revalidatePath('/settings')
  }
}
