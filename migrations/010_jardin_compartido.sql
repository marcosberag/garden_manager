-- Jardín compartido: varias personas, un mismo jardín, con roles.
--
-- Hasta ahora cada fila pertenecía a un usuario y las políticas decían
-- "auth.uid() = user_id". Eso hacía imposible que dos personas de la misma
-- casa cuidaran el mismo jardín: quien se registraba obtenía uno vacío.
--
-- El dueño sigue siendo el user_id de cada fila. Lo que cambia es quién puede
-- verlo: además del dueño, las personas a las que haya invitado.
--
-- Roles:
--   dueño (el creador, no tiene fila aquí) — todo, y manda sobre los demás.
--   admin        — todo en el jardín, y puede invitar y quitar colaboradores.
--   colaborador  — todo en el jardín, pero no gestiona a nadie.

CREATE TABLE garden_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Dueño del jardín que se comparte.
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Correo del dueño, para que el invitado sepa en qué jardín está sin tener
    -- que consultar la tabla de usuarios, que no es accesible desde la app.
    owner_email TEXT,
    -- A quién se invitó. Se guarda el correo porque al invitar puede que esa
    -- persona todavía no se haya registrado.
    email TEXT NOT NULL,
    -- Se rellena solo cuando esa persona entra y reclama la invitación.
    member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rol TEXT NOT NULL DEFAULT 'colaborador' CHECK (rol IN ('admin', 'colaborador')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (owner_id, email)
);

ALTER TABLE garden_members ENABLE ROW LEVEL SECURITY;

-- Qué jardines puede ver quien pregunta: el suyo y aquellos a los que le han
-- invitado. Va en SECURITY DEFINER a propósito: si la consulta se hiciera con
-- los permisos del que llama, la propia RLS de garden_members la filtraría y
-- las políticas de abajo no verían nada.
CREATE OR REPLACE FUNCTION public.jardines_visibles()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid()
  UNION
  SELECT owner_id FROM public.garden_members
  WHERE member_id = auth.uid();
$$;

-- Si quien pregunta manda en ese jardín: o es su dueño, o es admin invitado.
CREATE OR REPLACE FUNCTION public.es_admin_de(jardin UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jardin = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.garden_members
        WHERE owner_id = jardin AND member_id = auth.uid() AND rol = 'admin'
      );
$$;

REVOKE ALL ON FUNCTION public.jardines_visibles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_admin_de(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jardines_visibles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_de(UUID) TO authenticated;

-- El dueño manda sobre todas las invitaciones de su jardín, admins incluidos.
CREATE POLICY "El dueño gestiona su jardín" ON garden_members
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Un admin ve la lista y puede invitar o quitar colaboradores, pero no tocar a
-- otros admins: nombrar y destituir admins es cosa del creador.
CREATE POLICY "Un admin ve a los miembros" ON garden_members
  FOR SELECT USING (public.es_admin_de(owner_id));

CREATE POLICY "Un admin invita colaboradores" ON garden_members
  FOR INSERT WITH CHECK (public.es_admin_de(owner_id) AND rol = 'colaborador');

CREATE POLICY "Un admin quita colaboradores" ON garden_members
  FOR DELETE USING (public.es_admin_de(owner_id) AND rol = 'colaborador');

-- El invitado ve la suya y puede reclamarla, poniéndose como miembro.
CREATE POLICY "El invitado ve su invitación" ON garden_members
  FOR SELECT USING (lower(email) = lower(auth.jwt() ->> 'email') OR auth.uid() = member_id);

-- La reclamación NO se hace con una política de UPDATE. RLS no sabe restringir
-- por columna, así que dejar que el invitado se escriba su member_id le
-- dejaría también ponerse rol = 'admin' de paso. Va por una función que solo
-- toca lo que debe: quién manda lo decide el creador, nunca el invitado.
CREATE OR REPLACE FUNCTION public.reclamar_invitacion()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jardin UUID;
BEGIN
  UPDATE public.garden_members
     SET member_id = auth.uid()
   WHERE id = (
     SELECT id FROM public.garden_members
      WHERE member_id IS NULL
        AND lower(email) = lower(auth.jwt() ->> 'email')
        AND owner_id <> auth.uid()
      ORDER BY created_at
      LIMIT 1
   )
  RETURNING owner_id INTO jardin;

  RETURN jardin;
END;
$$;

REVOKE ALL ON FUNCTION public.reclamar_invitacion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reclamar_invitacion() TO authenticated;

-- Las políticas de las seis tablas pasan de "es mío" a "es de un jardín que
-- puedo ver". Para el dueño no cambia nada: jardines_visibles() siempre
-- incluye su propio id. El rol no interviene aquí: cualquier miembro cuida el
-- jardín entero; lo que distingue a un admin es mandar sobre las personas.
DROP POLICY IF EXISTS "Users can manage their own plants" ON plants;
CREATE POLICY "Miembros del jardín gestionan las plantas" ON plants
  FOR ALL USING (user_id IN (SELECT public.jardines_visibles()))
  WITH CHECK (user_id IN (SELECT public.jardines_visibles()));

DROP POLICY IF EXISTS "Users can manage their own products" ON products;
CREATE POLICY "Miembros del jardín gestionan los productos" ON products
  FOR ALL USING (user_id IN (SELECT public.jardines_visibles()))
  WITH CHECK (user_id IN (SELECT public.jardines_visibles()));

DROP POLICY IF EXISTS "Users can manage their own events" ON events;
CREATE POLICY "Miembros del jardín gestionan los eventos" ON events
  FOR ALL USING (user_id IN (SELECT public.jardines_visibles()))
  WITH CHECK (user_id IN (SELECT public.jardines_visibles()));

DROP POLICY IF EXISTS "Users can manage their own contacts" ON notification_contacts;
CREATE POLICY "Miembros del jardín gestionan los contactos" ON notification_contacts
  FOR ALL USING (user_id IN (SELECT public.jardines_visibles()))
  WITH CHECK (user_id IN (SELECT public.jardines_visibles()));

DROP POLICY IF EXISTS "Users can view their own parcel" ON parcels;
DROP POLICY IF EXISTS "Users can insert their own parcel" ON parcels;
DROP POLICY IF EXISTS "Users can delete their own parcel" ON parcels;
CREATE POLICY "Miembros del jardín gestionan la parcela" ON parcels
  FOR ALL USING (user_id IN (SELECT public.jardines_visibles()))
  WITH CHECK (user_id IN (SELECT public.jardines_visibles()));

DROP POLICY IF EXISTS "Users can view their own plant photos" ON plant_photos;
DROP POLICY IF EXISTS "Users can insert their own plant photos" ON plant_photos;
DROP POLICY IF EXISTS "Users can delete their own plant photos" ON plant_photos;
CREATE POLICY "Miembros del jardín gestionan las fotos" ON plant_photos
  FOR ALL USING (user_id IN (SELECT public.jardines_visibles()))
  WITH CHECK (user_id IN (SELECT public.jardines_visibles()));
