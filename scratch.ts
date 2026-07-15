import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkEvents() {
  const { data, error } = await supabase.from('events').select('*');
  console.log(data);
}

checkEvents();
