-- Límite de aplicaciones de un producto.
--
-- Hay tratamientos que no se pueden repetir indefinidamente: un fungicida
-- sistémico suele traer en la etiqueta un máximo de aplicaciones, y pasarse
-- no solo no ayuda, sino que genera resistencias. Hasta ahora la app avisaba
-- del límite en texto, pero seguía programando avisos para siempre.

ALTER TABLE products ADD COLUMN max_aplicaciones INT;

-- 'total'  = ese máximo es para toda la vida del tratamiento
-- 'anual'  = se reinicia cada año (lo habitual en las etiquetas)
ALTER TABLE products ADD COLUMN limite_periodo TEXT;
