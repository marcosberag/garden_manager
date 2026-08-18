'use client';

import React, { useEffect, useRef, useState } from 'react';
import { addEvent, addProductFromScan } from '@/app/actions';
import ProductScanner from '@/components/ProductScanner';
import type { ProductoIdentificado } from '@/lib/identificar-producto';

type Sugerencia = {
  frequency_days: number;
  min_days: number | null;
  max_days: number | null;
  motivo: string;
};

const normaliza = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const estiloCampo: React.CSSProperties = {
  padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
  borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none',
};

const estiloEtiqueta: React.CSSProperties = {
  fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)',
};

export default function NewEventForm({ plants, products, today }: { plants: any[], products: any[], today: string }) {
  const [dates, setDates] = useState<string[]>([today]);
  const [loading, setLoading] = useState(false);

  // Copia local del inventario: el escáner puede dar de alta un producto nuevo
  // y hay que poder seleccionarlo sin recargar la página.
  const [inventario, setInventario] = useState<any[]>(products || []);
  const [productoId, setProductoId] = useState('');
  const [plantaId, setPlantaId] = useState('');
  const [metodo, setMetodo] = useState('');
  const [avisoEscaner, setAvisoEscaner] = useState<string | null>(null);

  const [frecuencia, setFrecuencia] = useState('');
  // Si el usuario escribe la frecuencia a mano, ninguna sugerencia se la pisa.
  const frecuenciaTocada = useRef(false);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [tic, setTic] = useState(0);
  const notasRef = useRef<HTMLTextAreaElement>(null);

  const productoElegido = inventario.find(p => p.id === productoId) || null;

  const elegirProducto = (producto: any | null) => {
    setProductoId(producto?.id || '');
    frecuenciaTocada.current = false;
    setSugerencia(null);
    setFrecuencia(producto?.frequency_days ? String(producto.frequency_days) : '');
  };

  // Pauta para el caso concreto: el mismo producto no se repite igual foliar
  // que en la raíz, ni en cualquier planta, ni con la plaga muy avanzada. Se
  // recalcula al cambiar producto, planta o modo (con un pequeño debounce).
  useEffect(() => {
    // Al deseleccionar el producto no hay nada que limpiar aquí:
    // elegirProducto ya deja la sugerencia a null.
    if (!productoElegido) return;
    const controlador = new AbortController();
    const temporizador = setTimeout(async () => {
      setCalculando(true);
      try {
        const planta = plants?.find(p => p.id === plantaId) || null;
        const res = await fetch('/api/events/frequency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controlador.signal,
          body: JSON.stringify({
            producto: { nombre: productoElegido.name, tipo: productoElegido.type, descripcion: productoElegido.description },
            planta: planta ? { nombre: planta.name, especie: planta.species } : null,
            metodo: metodo || null,
            notas: notasRef.current?.value || null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.frequency_days) {
            setSugerencia(data);
            if (!frecuenciaTocada.current) setFrecuencia(String(data.frequency_days));
          }
        }
      } catch {
        // Sin sugerencia el campo se queda con la pauta general del producto.
      } finally {
        if (!controlador.signal.aborted) setCalculando(false);
      }
    }, 500);
    return () => {
      controlador.abort();
      clearTimeout(temporizador);
      setCalculando(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, plantaId, metodo, tic]);

  // Producto identificado por foto: si ya está en el inventario se selecciona;
  // si no, se da de alta al momento con lo leído en la etiqueta.
  const handleIdentificado = async (identificado: ProductoIdentificado) => {
    const objetivo = normaliza(identificado.name);
    const existente = inventario.find(p => {
      const nombre = normaliza(p.name || '');
      return nombre && (nombre.includes(objetivo) || objetivo.includes(nombre));
    });

    if (existente) {
      elegirProducto(existente);
      setAvisoEscaner(`Identificado: ${existente.name} (ya estaba en tu inventario).`);
      return;
    }

    const resultado = await addProductFromScan({
      name: identificado.name,
      type: identificado.type,
      description: identificado.description,
      frequency_days: identificado.frequency_days,
    });

    if (!resultado.product) {
      setAvisoEscaner(resultado.error || 'No se pudo guardar el producto identificado.');
      return;
    }

    setInventario(prev => [...prev, resultado.product]);
    elegirProducto(resultado.product);
    setAvisoEscaner(`Identificado y añadido al inventario: ${resultado.product.name}.`);
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
          <label style={estiloEtiqueta}>Fechas *</label>
          {dates.map((date, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => handleDateChange(idx, e.target.value)}
                style={{ ...estiloCampo, flex: 1 }}
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
          <label htmlFor="type" style={estiloEtiqueta}>Tipo de Tarea *</label>
          <select id="type" name="type" required style={{ ...estiloCampo, appearance: 'none' }}>
            <option value="Fumigación">Fumigación</option>
            <option value="Poda">Poda</option>
            <option value="Abono">Abono</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="plant_id" style={estiloEtiqueta}>Planta Afectada (Opcional)</label>
        <select id="plant_id" name="plant_id" value={plantaId} onChange={(e) => setPlantaId(e.target.value)} style={estiloCampo}>
          <option value="">Todas / General</option>
          {plants?.map(p => (
            <option key={p.id} value={p.id}>{p.name || p.species}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="product_id" style={estiloEtiqueta}>Producto Utilizado (Opcional)</label>
        <select
          id="product_id"
          name="product_id"
          value={productoId}
          onChange={(e) => elegirProducto(inventario.find(p => p.id === e.target.value) || null)}
          style={estiloCampo}
        >
          <option value="">Ninguno / No aplica</option>
          {inventario.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
          ))}
        </select>
        <ProductScanner onIdentified={handleIdentificado} />
        {avisoEscaner && (
          <p style={{ fontSize: '12px', color: 'var(--color-eucalyptus)', margin: 0 }}>{avisoEscaner}</p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="application_method" style={estiloEtiqueta}>Modo de aplicación (Opcional)</label>
        <select id="application_method" name="application_method" value={metodo} onChange={(e) => setMetodo(e.target.value)} style={estiloCampo}>
          <option value="">Sin especificar</option>
          <option value="foliar">Foliar (pulverizando las hojas)</option>
          <option value="raiz">En la raíz (con el riego)</option>
          <option value="suelo">Al suelo (incorporado)</option>
        </select>
        <p style={{ fontSize: '11px', color: 'var(--color-graphite)', margin: 0 }}>
          El mismo producto no se repite igual foliar que en la raíz: esto afina la pauta propuesta.
        </p>
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
            onChange={(e) => {
              frecuenciaTocada.current = true;
              setFrecuencia(e.target.value);
            }}
          />
          <span style={{ fontSize: '14px' }}>días</span>
        </div>
        {calculando && (
          <p style={{ fontSize: '11px', color: 'var(--color-graphite)', marginTop: '10px', marginBottom: 0 }}>
            Calculando la pauta para este caso…
          </p>
        )}
        {!calculando && sugerencia && (
          <p style={{ fontSize: '11px', color: 'var(--color-eucalyptus)', marginTop: '10px', marginBottom: 0 }}>
            Para este caso: cada {sugerencia.frequency_days} días
            {sugerencia.min_days && sugerencia.max_days ? ` (lo habitual es ${sugerencia.min_days}–${sugerencia.max_days})` : ''}. {sugerencia.motivo}
          </p>
        )}
        {!calculando && !sugerencia && productoElegido?.frequency_days && (
          <p style={{ fontSize: '11px', color: 'var(--color-eucalyptus)', marginTop: '10px', marginBottom: 0 }}>
            Pauta habitual de {productoElegido.name}: cada {productoElegido.frequency_days} días. Cámbiala si lo prefieres.
          </p>
        )}
        <p style={{ fontSize: '11px', color: '#666', marginTop: '10px', marginBottom: 0 }}>
          Si estableces una frecuencia, se programarán automáticamente 3 futuras aplicaciones para que te lleguen avisos de WhatsApp.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="notes" style={estiloEtiqueta}>Notas adicionales</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          ref={notasRef}
          placeholder="Ej: Vi bastante oidio en las ramas bajas..."
          style={{ ...estiloCampo, resize: 'vertical' }}
        />
        {productoElegido && (
          <button
            type="button"
            onClick={() => setTic(t => t + 1)}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--color-eucalyptus)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
          >
            Recalcular la frecuencia teniendo en cuenta mis notas
          </button>
        )}
      </div>

      <div style={{ marginTop: '10px' }}>
        <button type="submit" className="btn-solid" style={{ width: '100%', opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'GUARDANDO...' : 'REGISTRAR TRATAMIENTO'} <span>&rarr;</span>
        </button>
      </div>

    </form>
  );
}
