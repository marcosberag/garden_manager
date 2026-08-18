-- Añadir nuevos campos de contexto a la tabla de plantas
ALTER TABLE plants ADD COLUMN location TEXT;
ALTER TABLE plants ADD COLUMN size TEXT;
ALTER TABLE plants ADD COLUMN age TEXT;
