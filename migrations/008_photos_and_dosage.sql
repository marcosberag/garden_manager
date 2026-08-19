-- Evolución fotográfica por planta y dosis propia por producto.

-- Historial de fotos: cada diagnóstico o recorrido puede dejar una foto con
-- fecha, nota (el diagnóstico) y veredicto de evolución frente a la anterior.
CREATE TABLE plant_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    note TEXT,
    verdict TEXT,
    evolution TEXT, -- 'mejora' | 'igual' | 'empeora' | null
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE plant_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plant photos"
ON plant_photos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plant photos"
ON plant_photos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plant photos"
ON plant_photos FOR DELETE
USING (auth.uid() = user_id);

-- Dosis del producto. La fuente puede ser la etiqueta o lo que diga el vivero
-- (hay dosis que no vienen en el bote); si está rellena, manda sobre el
-- conocimiento general de la IA.
ALTER TABLE products ADD COLUMN dosage TEXT;
