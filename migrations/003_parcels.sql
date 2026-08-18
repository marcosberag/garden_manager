-- Create a table to store the user's parcel geometry
CREATE TABLE parcels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    geojson TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own parcel" 
ON parcels FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own parcel" 
ON parcels FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own parcel" 
ON parcels FOR DELETE 
USING (auth.uid() = user_id);
