'use client';

import React, { useState } from 'react';
import AutocompleteInput from '@/components/AutocompleteInput';
import ProductScanner from '@/components/ProductScanner';
import type { ProductoIdentificado } from '@/lib/identificar-producto';

type Defaults = {
  name?: string | null;
  type?: string | null;
  description?: string | null;
  frequency_days?: number | null;
  barcode?: string | null;
  dosage?: string | null;
  max_aplicaciones?: number | null;
  limite_periodo?: string | null;
};

/**
 * Ficha de producto, compartida por "añadir" y "editar". El escáner rellena
 * nombre, tipo, descripción y pauta a partir de una foto de la etiqueta; todo
 * queda editable antes de guardar.
 */
export default function ProductForm({ action, defaults, textoBoton }: {
  action: (formData: FormData) => void;
  defaults?: Defaults;
  textoBoton: string;
}) {
  const [nombre, setNombre] = useState(defaults?.name || '');
  const [tipo, setTipo] = useState(defaults?.type || '');
  const [descripcion, setDescripcion] = useState(defaults?.description || '');
  const [frecuencia, setFrecuencia] = useState(defaults?.frequency_days ? String(defaults.frequency_days) : '');
  const [dosis, setDosis] = useState(defaults?.dosage || '');
  const [maxAplicaciones, setMaxAplicaciones] = useState(defaults?.max_aplicaciones ? String(defaults.max_aplicaciones) : '');
  const [limitePeriodo, setLimitePeriodo] = useState(defaults?.limite_periodo === 'total' ? 'total' : 'anual');
  const [lectura, setLectura] = useState<string | null>(null);

  const handleIdentificado = (p: ProductoIdentificado) => {
    setNombre(p.name);
    setTipo(p.type);
    setDescripcion(p.description);
    if (p.frequency_days) setFrecuencia(String(p.frequency_days));
    if (p.dosage) setDosis(p.dosage);
    setLectura(p.frequency_days
      ? `${p.name}. Pauta: cada ${p.frequency_days} días. ${p.motivo || ''}`.trim()
      : `${p.name}. La pauta no se lee en la etiqueta: se calculará al guardar.`);
  };

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <ProductScanner onIdentified={handleIdentificado} />
        {lectura && (
          <div>
            <p className="eyebrow" style={{ marginBottom: '4px' }}>Leído de la etiqueta</p>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-black)', margin: 0, lineHeight: '1.45' }}>{lectura}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="name" className="field-label">Nombre / Marca *</label>
        <AutocompleteInput
          id="name"
          name="name"
          required
          placeholder="Ej: Aceite de Neem, Jabón Potásico..."
          apiEndpoint="/api/products/suggest"
          value={nombre}
          onChange={setNombre}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="type" className="field-label">Tipo de producto *</label>
        <select
          id="type"
          name="type"
          required
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="input-field"
          style={{ appearance: 'none', cursor: 'pointer' }}
        >
          <option value="" disabled>Selecciona un tipo...</option>
          <option value="Abono Universal">Abono Universal</option>
          <option value="Abono Específico">Abono Específico</option>
          <option value="Insecticida">Insecticida</option>
          <option value="Fungicida">Fungicida</option>
          <option value="Sustrato">Sustrato</option>
          <option value="Herramienta">Herramienta</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="description" className="field-label">Notas / Uso</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Ej: Para usar cada 15 días en primavera..."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="input-field"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="frequency_days" className="field-label">Cada cuántos días se aplica</label>
        <input
          type="number"
          id="frequency_days"
          name="frequency_days"
          min="1"
          max="365"
          placeholder="Déjalo vacío y lo deduzco por ti"
          value={frecuencia}
          onChange={(e) => setFrecuencia(e.target.value)}
          className="input-field"
        />
        <p className="field-hint">
          Propone la repetición al registrar un tratamiento con este producto. Si cambia,
          los avisos ya programados se reprograman solos. Vacío, se calcula al guardar.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="dosage" className="field-label">Dosis (opcional)</label>
        <input
          type="text"
          id="dosage"
          name="dosage"
          placeholder="Ej: 3 ml por litro de agua"
          value={dosis}
          onChange={(e) => setDosis(e.target.value)}
          className="input-field"
        />
        <p className="field-hint">
          Si la sabes — de la etiqueta o porque te la dijo el vivero — apúntala:
          mandará sobre lo que calcule la IA al preparar el caldo.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="max_aplicaciones" className="field-label">Máximo de aplicaciones (opcional)</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="number"
            min="1"
            max="50"
            id="max_aplicaciones"
            name="max_aplicaciones"
            placeholder="Ej: 3"
            value={maxAplicaciones}
            onChange={(e) => setMaxAplicaciones(e.target.value)}
            className="input-field"
            style={{ flex: '0 0 110px' }}
          />
          <select
            name="limite_periodo"
            aria-label="Periodo del límite"
            value={limitePeriodo}
            onChange={(e) => setLimitePeriodo(e.target.value)}
            className="input-field"
            style={{ flex: 1 }}
          >
            <option value="anual">al año</option>
            <option value="total">en total</option>
          </select>
        </div>
        <p className="field-hint">
          Muchos sistémicos traen un tope en la etiqueta. Si lo pones, la app deja de
          programar avisos al alcanzarlo. Cuenta solo la tanda en curso: si dejas de
          tratar una temporada larga, la cuenta vuelve a empezar.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="barcode" className="field-label">Código de barras (opcional)</label>
        <input
          type="text"
          id="barcode"
          name="barcode"
          placeholder="Ej: 8411000123456"
          defaultValue={defaults?.barcode || ''}
          className="input-field"
        />
      </div>

      <div style={{ marginTop: '20px' }}>
        <button type="submit" className="btn-solid" style={{ width: '100%' }}>
          {textoBoton} <span>&rarr;</span>
        </button>
      </div>

    </form>
  );
}
