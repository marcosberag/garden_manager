'use client';

import React, { useState } from 'react';
import { addEvent } from '@/app/actions';

export default function NewEventForm({ plants, products, today }: { plants: any[], products: any[], today: string }) {
  const [dates, setDates] = useState<string[]>([today]);
  const [loading, setLoading] = useState(false);
  const [frecuencia, setFrecuencia] = useState('');
  const [productoElegido, setProductoElegido] = useState<any | null>(null);

  // Cada producto guarda cada cuántos días se aplica. Al elegirlo rellenamos la
  // repetición para no tener que saberse la pauta de memoria; sigue siendo
  // editable, y lo que escriba el usuario manda.
  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const producto = products?.find(p => p.id === e.target.value) || null;
    setProductoElegido(producto);
    setFrecuencia(producto?.frequency_days ? String(producto.frequency_days) : '');
  };

  const handleAddDate = () => setDates([...dates, today]);
  const handleRemoveDate = (index: number) => setDates(dates.filter((_, i) => i !== index));
  const handleDateChange = (index: number, value: string) => {
    const newDates = [...dates];
    newDates[index] = value;
    setDates(newDates);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.delete('date'); // Remove default if any
    dates.forEach(d => formData.append('dates[]', d));
    
    await addEvent(formData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Fechas *</label>
          {dates.map((date, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="date" 
                required 
                value={date}
                onChange={(e) => handleDateChange(idx, e.target.value)}
                style={{
                  flex: 1, padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
                  borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none'
                }}
              />
              {dates.length > 1 && (
                <button type="button" onClick={() => handleRemoveDate(idx)} style={{ padding: '0 15px', backgroundColor: '#FDEDEC', color: '#E74C3C', border: 'none', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleAddDate} style={{ background: 'none', border: '1px dashed var(--color-mist)', padding: '10px', color: 'var(--color-graphite)', cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase' }}>
            + Añadir otra fecha
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          <label htmlFor="type" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Tipo de Tarea *</label>
          <select 
            id="type" 
            name="type" 
            required 
            style={{
              padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
              borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none', appearance: 'none'
            }}
          >
            <option value="Fumigación">Fumigación</option>
            <option value="Poda">Poda</option>
            <option value="Abono">Abono</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="plant_id" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Planta Afectada (Opcional)</label>
        <select 
          id="plant_id" 
          name="plant_id" 
          style={{
            padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
            borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none'
          }}
        >
          <option value="">Todas / General</option>
          {plants?.map(p => (
            <option key={p.id} value={p.id}>{p.name || p.species}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="product_id" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Producto Utilizado (Opcional)</label>
        <select 
          id="product_id" 
          name="product_id" 
          onChange={handleProductChange}
          style={{
            padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
            borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none'
          }}
        >
          <option value="">Ninguno / No aplica</option>
          {products?.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: 'var(--color-mist)', borderRadius: '4px' }}>
        <label style={{ display: 'block', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', marginBottom: '8px' }}>
          Frecuencia de repetición (opcional)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px' }}>Repetir cada</span>
          <input 
            type="number" 
            name="frequency_days" 
            className="input-field" 
            style={{ width: '80px', marginBottom: 0, padding: '10px' }} 
            placeholder="Ej: 15"
            min="1"
            value={frecuencia}
            onChange={(e) => setFrecuencia(e.target.value)}
          />
          <span style={{ fontSize: '14px' }}>días</span>
        </div>
        {productoElegido?.frequency_days && (
          <p style={{ fontSize: '11px', color: 'var(--color-eucalyptus)', marginTop: '10px', marginBottom: 0 }}>
            Pauta habitual de {productoElegido.name}: cada {productoElegido.frequency_days} días. Cámbiala si lo prefieres.
          </p>
        )}
        <p style={{ fontSize: '11px', color: '#666', marginTop: '10px', marginBottom: 0 }}>
          Si estableces una frecuencia, se programarán automáticamente 3 futuras aplicaciones para que te lleguen avisos de WhatsApp.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="notes" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Notas adicionales</label>
        <textarea 
          id="notes" 
          name="notes" 
          rows={3}
          placeholder="Ej: Apliqué aceite de neem en el envés de las hojas porque vi algo de mosca blanca..."
          style={{
            padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
            borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none', resize: 'vertical'
          }}
        />
      </div>

      <div style={{ marginTop: '10px' }}>
        <button type="submit" className="btn-solid" style={{ width: '100%', opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'GUARDANDO...' : 'REGISTRAR TRATAMIENTO'} <span>&rarr;</span>
        </button>
      </div>

    </form>
  );
}
