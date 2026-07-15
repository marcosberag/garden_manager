'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?message=Error de autenticación')
  }

  revalidatePath('/', 'layout')
  redirect('/plants')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error, data: signupData } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/register?message=Error al registrarse: ' + error.message)
  }

  // If user is created but session is null, email confirmation is required.
  if (signupData.user && !signupData.session) {
    redirect('/register?message=Revisa tu correo para confirmar tu cuenta (o desactiva la confirmación en Supabase).')
  }

  revalidatePath('/', 'layout')
  redirect('/plants')
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
