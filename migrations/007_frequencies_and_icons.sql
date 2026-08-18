-- Frecuencias de uso e iconos de planta.
--
-- Hasta ahora la frecuencia de repetición de una tarea vivía como texto
-- "[FREQ:15]" dentro de events.notes y se parseaba con expresiones regulares en
-- cuatro sitios distintos. Pasa a columna propia, y cada producto guarda además
-- su pauta recomendada para no tener que teclearla en cada tratamiento.

-- Pauta recomendada del producto. frequency_source distingue si la dedujo la IA
-- ('ia') o la escribió el usuario ('manual'); una frecuencia manual no se pisa.
ALTER TABLE products ADD COLUMN IF NOT EXISTS frequency_days INT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS frequency_source TEXT;

-- Frecuencia real con la que se programó cada tarea.
ALTER TABLE events ADD COLUMN IF NOT EXISTS frequency_days INT;

-- Categoría de icono de la planta (arbol, palmera, arbusto, flor, hortaliza,
-- citrico, suculenta, aromatica, generica). Se deduce de la especie al guardar.
ALTER TABLE plants ADD COLUMN IF NOT EXISTS icon_category TEXT;

-- Rescatar las frecuencias que hoy están dentro del texto de las notas.
UPDATE events
SET frequency_days = (regexp_match(notes, '\[FREQ:(\d+)\]'))[1]::int
WHERE notes ~ '\[FREQ:\d+\]'
  AND frequency_days IS NULL;
