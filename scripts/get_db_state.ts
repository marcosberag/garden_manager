import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: events } = await supabase.from('events').select(`
    id, type, date, notes, plant_id, product_id,
    plants(name, species), products(name, type)
  `);
  
  const { data: plants } = await supabase.from('plants').select('*');
  const { data: products } = await supabase.from('products').select('*');
  
  console.log("=== EVENTS ===");
  console.log(JSON.stringify(events, null, 2));
  
  console.log("\n=== PLANTS ===");
  console.log(JSON.stringify(plants, null, 2));
  
  console.log("\n=== PRODUCTS ===");
  console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error);
