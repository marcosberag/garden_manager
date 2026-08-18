'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addPlant, updatePlant } from '@/app/actions';
import AutocompleteInput from '@/components/AutocompleteInput';

interface PlantData {
  id?: string;
  name?: string;
  species?: string;
  description?: string;
  location?: string;
  size?: string;
  age?: string;
  icon_emoji?: string;
  image_url?: string;
}

export default function PlantFormClient({ initialData, isEdit = false }: { initialData?: PlantData, isEdit?: boolean }) {
  const router = useRouter();
  const [speciesValue, setSpeciesValue] = useState(initialData?.species || '');

  const handleIdentified = (species: string) => {
    setSpeciesValue(species);
  };

  const formAction = isEdit && initialData?.id 
    ? updatePlant.bind(null, initialData.id) 
    : addPlant;

  return (
    <div style={{ flex: '1', maxWidth: '600px' }}>
        <button type="button" onClick={() => router.push('/')} style={{ background: 'none', border: 'none', padding: 0, margin: '0 0 20px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', textDecoration: 'none', cursor: 'pointer' }}>
          &larr; Inicio
        </button>

      <h1 className="heading-text suisse" style={{ color: 'var(--color-ink-black)', marginBottom: '30px' }}>
        {isEdit ? <React.Fragment>editar<br/>planta.</React.Fragment> : <React.Fragment>añadir nueva<br/>planta.</React.Fragment>}
      </h1>
      
      {!isEdit && (
        <p className="body-text" style={{ marginBottom: '20px' }}>
          Registra una nueva planta en tu jardín escribiendo su nombre.
        </p>
      )}
      
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: isEdit ? '0' : '20px' }}>
        
        {/* ESPECIE (Principal) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', zIndex: 50 }}>
          <label htmlFor="species" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Especie de la Planta *</label>
          <AutocompleteInput 
            id="species" 
            name="species" 
            required 
            placeholder="Ej: Monstera Deliciosa, Palmera Phoenix..."
            defaultValue={speciesValue}
            key={speciesValue} // Force re-render when AI updates the value
          />
        </div>

        {/* NOMBRE / APODO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', zIndex: 40 }}>
          <label htmlFor="name" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Apodo (Opcional)</label>
          <AutocompleteInput 
            id="name" 
            name="name" 
            placeholder="Ej: Palmerita del salón, Bonsai de la abuela"
            defaultValue={initialData?.name || ''}
          />
        </div>

        {/* UBICACION Y TAMAÑO EN DOS COLUMNAS */}
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <label htmlFor="location" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Ubicación (Opcional)</label>
            <input 
              type="text" 
              id="location" 
              name="location" 
              defaultValue={initialData?.location || ''}
              placeholder="Ej: Salón, Terraza..."
              style={{
                padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
                borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <label htmlFor="size" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Tamaño / Maceta (Opcional)</label>
            <input 
              type="text" 
              id="size" 
              name="size" 
              defaultValue={initialData?.size || ''}
              placeholder="Ej: Maceta 20cm, 1.5m alto"
              style={{
                padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
                borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none'
              }}
            />
          </div>
        </div>

        {/* EDAD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label htmlFor="age" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Edad / Tiempo contigo</label>
          <input 
            type="text" 
            id="age" 
            name="age" 
            defaultValue={initialData?.age || ''}
            placeholder="Ej: 2 años, Recién comprada..."
            style={{
              padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
              borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none'
            }}
          />
        </div>

        {/* DESCRIPCION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label htmlFor="description" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Otras Notas</label>
          <textarea 
            id="description" 
            name="description" 
            defaultValue={initialData?.description || ''}
            rows={3}
            style={{
              padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
              borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none', resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginTop: '10px' }}>
          <button type="submit" className="btn-solid" style={{ width: '100%' }}>
            {isEdit ? 'GUARDAR CAMBIOS' : 'GUARDAR PLANTA'} <span>&rarr;</span>
          </button>
        </div>

      </form>
    </div>
  );
}
