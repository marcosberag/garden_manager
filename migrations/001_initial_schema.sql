-- Eliminar tablas si existen para empezar limpio (opcional)
-- DROP TABLE IF EXISTS events;
-- DROP TABLE IF EXISTS plants;
-- DROP TABLE IF EXISTS products;
-- DROP TABLE IF EXISTS notification_contacts;

-- Crear tabla de contactos de WhatsApp
CREATE TABLE notification_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear tabla de plantas
CREATE TABLE plants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  species TEXT,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear tabla de productos (Inventario)
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- Ej: Insecticida, Fungicida, Abono
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear tabla de eventos (Calendario)
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- Ej: Fumigación, Poda, Riego
  date DATE NOT NULL,
  notes TEXT,
  plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurar Políticas de Seguridad de Filas (Row Level Security - RLS)
-- Esto asegura que ningún usuario pueda ver o editar las plantas de otra persona.

ALTER TABLE notification_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Políticas para Contacts
CREATE POLICY "Users can manage their own contacts" ON notification_contacts
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para Plants
CREATE POLICY "Users can manage their own plants" ON plants
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para Products
CREATE POLICY "Users can manage their own products" ON products
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para Events
CREATE POLICY "Users can manage their own events" ON events
  FOR ALL USING (auth.uid() = user_id);
