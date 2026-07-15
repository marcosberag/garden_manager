'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addContact(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'No autorizado' }

  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const apikey = formData.get('apikey') as string

  const { error } = await supabase
    .from('notification_contacts')
    .insert([{ user_id: user.id, name, phone_number: phone, api_key: apikey }])

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
