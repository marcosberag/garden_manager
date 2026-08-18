-- Añadir campos de coordenadas para el mapa interactivo
ALTER TABLE plants ADD COLUMN lat FLOAT8;
ALTER TABLE plants ADD COLUMN lng FLOAT8;
