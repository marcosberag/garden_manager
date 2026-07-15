import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';

export async function GET() {
  const serverSupabase = await createServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const { data: events, error } = await serverSupabase.from('events').select('*');

  const { data: contacts, error: contactsError } = await serverSupabase.from('notification_contacts').select('*');

  if (error) return NextResponse.json({ error: error.message });

  return NextResponse.json({
    todayStr: (() => {
      const d = new Date();
      d.setHours(0,0,0,0);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })(),
    contacts,
    events
  });
}
