-- El código guarda plants.icon_emoji desde hace tiempo, pero la migración
-- correspondiente nunca se escribió. Se añade aquí para que el esquema del
-- repositorio refleje la base de datos real.
ALTER TABLE plants ADD COLUMN IF NOT EXISTS icon_emoji TEXT;
