'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { setPlantLocation, saveUserParcel, removePlantLocation, setPlantPath } from '@/app/actions';

const MapComponent = dynamic(
  () => import('./MapComponent'),
  { 
    ssr: false,
    loading: () => (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-pure-canvas)' }}>
        <p style={{ color: 'var(--color-graphite)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>
          Cargando Mapa Satelital...
        </p>
      </div>
    )
  }
);

interface Plant {
  id: string;
  name: string;
  species?: string;
  lat?: number;
  lng?: number;
  location?: string;
  icon_category?: string;
  image_url?: string;
  species_image_url?: string;
  path?: [number, number][];
}

export default function MapWrapper({ plants, initialParcel }: { plants: Plant[], initialParcel: any }) {
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [placementType, setPlacementType] = useState<'point' | 'line'>('point');
  const [drawingPath, setDrawingPath] = useState<[number, number][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [parcel, setParcel] = useState<any>(initialParcel);
  
  const [ciudad, setCiudad] = useState('');
  const [calle, setCalle] = useState('');
  const [numero, setNumero] = useState('');
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'ciudad' | 'calle' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hideSearchForm, setHideSearchForm] = useState(false);
  
  const [modal, setModal] = useState<{
    type: 'alert' | 'confirm';
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null>(null);
  
  const ciudadRef = useRef<HTMLInputElement>(null);
  const calleRef = useRef<HTMLInputElement>(null);
  const numeroRef = useRef<HTMLInputElement>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Plantas sin ubicación
  const unplacedPlants = plants.filter(p => (!p.lat || !p.lng) && (!p.path || p.path.length === 0));

  // Auto-completado mientras escribe
  useEffect(() => {
    if (ciudad.length < 3 && calle.length < 3) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        let q = '';
        let url = '';
        if (focusedInput === 'calle' && ciudad.length >= 3 && calle.length >= 2) {
          q = `${calle} ${ciudad}`;
          url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=-9.4,36.0,4.5,44.0&osm_tag=highway&limit=10`;
        } else if (focusedInput === 'ciudad' && ciudad.length >= 2) {
          q = ciudad;
          url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=-9.4,36.0,4.5,44.0&osm_tag=place:city&osm_tag=place:town&osm_tag=place:village&limit=15`;
        } else if (ciudad.length >= 3 && calle.length >= 3) {
          q = `${calle} ${ciudad}`;
          url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=-9.4,36.0,4.5,44.0&osm_tag=highway&limit=10`;
        } else {
          return;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.features && data.features.length > 0) {
          // Filtrar resultados a España
          let features = data.features.filter((f: any) => f.properties.countrycode === 'ES' || f.properties.country === 'España' || f.properties.country === 'Spain');
          
          if (focusedInput === 'ciudad') {
            // Quitar duplicados por nombre
            const unique = [];
            const seen = new Set();
            for (const f of features) {
              if (!seen.has(f.properties.name)) {
                seen.add(f.properties.name);
                unique.push(f);
              }
            }
            features = unique;
          }

          const mapped = features.map((f: any) => ({
            name: f.properties.name,
            display_name: `${f.properties.name}${f.properties.city && f.properties.city !== f.properties.name ? ', ' + f.properties.city : ''}${f.properties.state ? ', ' + f.properties.state : ''}`,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0]
          }));

          setSearchResults(mapped);
          setShowSuggestions(mapped.length > 0);
          setSelectedIndex(-1);
        } else {
          setSearchResults([]);
          setShowSuggestions(false);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error("Error fetching address suggestions", err);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [calle, ciudad]);

  const handleLocationSelect = async (lat: number, lng: number) => {
    if (!selectedPlantId) {
      return;
    }
    
    if (placementType === 'line') {
      setDrawingPath(prev => [...prev, [lat, lng]]);
      return;
    }

    setIsSaving(true);
    try {
      await setPlantLocation(selectedPlantId, lat, lng);
      setSelectedPlantId(null);
    } catch (err: any) {
      setModal({ type: 'alert', message: `Error al guardar la ubicación: ${err.message}`, onConfirm: () => setModal(null) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePlantFromMap = async (plantId: string) => {
    setIsSaving(true);
    try {
      await removePlantLocation(plantId);
    } catch (err: any) {
      setModal({ type: 'alert', message: `Error al quitar del mapa: ${err.message}`, onConfirm: () => setModal(null) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMovePlant = (plantId: string) => {
    setSelectedPlantId(plantId);
    setPlacementType('point'); // Default to point when moving, unless we add UI to change it
  };

  const handleFinishDrawing = async () => {
    if (!selectedPlantId || drawingPath.length < 2) return;
    setIsSaving(true);
    try {
      await setPlantPath(selectedPlantId, drawingPath);
      setSelectedPlantId(null);
      setDrawingPath([]);
      setPlacementType('point');
    } catch (err: any) {
      setModal({ type: 'alert', message: `Error al guardar la línea: ${err.message}`, onConfirm: () => setModal(null) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelDrawing = () => {
    setDrawingPath([]);
    setSelectedPlantId(null);
    setPlacementType('point');
  };

  const pedirCambioParcela = () => {
    setModal({
      type: 'confirm',
      message: "¿Estás seguro de que quieres borrar el plano de la parcela actual?",
      onConfirm: () => {
        setParcel(null);
        setHideSearchForm(true);
        setModal(null);
      },
      onCancel: () => setModal(null)
    });
  };

  const executeCatastroExtraction = async (lat: number, lon: number, refcat?: string) => {
    setIsSearching(true);
    try {
      let apiUrl = `/api/parcel?lat=${lat}&lng=${lon}`;
      if (refcat) {
        apiUrl += `&refcat=${refcat}`;
      }
      const parcelRes = await fetch(apiUrl);
      if (!parcelRes.ok) {
        throw new Error("No se pudo extraer la parcela del Catastro en esta ubicación.");
      }

      const parcelGeojson = await parcelRes.json();
      
      await saveUserParcel(JSON.stringify(parcelGeojson));
      setParcel(parcelGeojson);
      setSearchResults([]);
      
    } catch (err: any) {
      console.error(err);
      setModal({ type: 'alert', message: err.message || "Error al extraer la parcela", onConfirm: () => setModal(null) });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchParcel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!calle || !ciudad || !numero) return;
    
    setIsSearching(true);
    setShowSuggestions(false);
    setSearchResults([]);
    setSelectedIndex(-1);
    
    try {
      // Cartociudad es el geocodificador oficial de España y ubica los portales perfectamente en el Catastro
      const query = encodeURIComponent(`${calle} ${numero}, ${ciudad}`);
      const cartoRes = await fetch(`https://www.cartociudad.es/geocoder/api/geocoder/findJsonp?q=${query}`);
      const cartoText = await cartoRes.text();
      
      let cartoData = null;
      try {
        const jsonStr = cartoText.replace(/^callback\(/, '').replace(/\)$/, '');
        cartoData = JSON.parse(jsonStr);
      } catch (e) {}

      if (!cartoData || cartoData.state === -1 || (!cartoData.lat && !cartoData.lng && !cartoData.refCatastral)) {
        setModal({
          type: 'alert',
          message: 'No se encontró la dirección exacta. Revisa que el nombre de la calle, el número y la ciudad sean correctos.',
          onConfirm: () => setModal(null)
        });
        setIsSearching(false);
        return;
      }
      
      const lat = cartoData.lat || 0;
      const lon = cartoData.lng || 0;
      const refcat = cartoData.refCatastral;
      await executeCatastroExtraction(lat, lon, refcat);
      
    } catch (err: any) {
      console.error(err);
      setModal({ type: 'alert', message: err.message || "Error al realizar la búsqueda.", onConfirm: () => setModal(null) });
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: 'ciudad' | 'calle') => {
    if (!showSuggestions || searchResults.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        e.preventDefault();
        const res = searchResults[selectedIndex];
        if (type === 'ciudad') {
          setCiudad(res.name || res.display_name.split(',')[0]);
          setShowSuggestions(false);
          setSearchResults([]);
          setSelectedIndex(-1);
          setFocusedInput('calle');
          setTimeout(() => calleRef.current?.focus(), 10);
        } else if (type === 'calle') {
          setCalle(res.name);
          setShowSuggestions(false);
          setSearchResults([]);
          setSelectedIndex(-1);
          setTimeout(() => numeroRef.current?.focus(), 10);
        }
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
      
      {modal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white', padding: '30px', borderRadius: '12px',
            width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: 'var(--color-graphite)', lineHeight: '1.5' }}>
              {modal.message}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              {modal.type === 'confirm' && (
                <button 
                  onClick={modal.onCancel}
                  className="btn-outline"
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  Cancelar
                </button>
              )}
              <button 
                onClick={modal.onConfirm}
                className="btn-solid"
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                {modal.type === 'confirm' ? 'Aceptar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!parcel && !hideSearchForm && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 2000, backgroundColor: 'white', padding: '30px', borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '90%', maxWidth: '450px',
          textAlign: 'center'
        }}>
          <h2 className="heading-text suisse" style={{ fontSize: '20px', marginBottom: '15px', color: 'var(--color-ink-black)' }}>
            Encuentra tu parcela
          </h2>
          <p className="body-text" style={{ fontSize: '14px', marginBottom: '20px' }}>
            Rellena los datos de tu dirección en España para extraer el plano oficial del Catastro.
          </p>
          
          <form onSubmit={handleSearchParcel} style={{ display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative' }}>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-graphite)', marginBottom: '4px' }}>Ciudad / Municipio</label>
              <input 
                ref={ciudadRef}
                type="text" 
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                onFocus={() => {
                  if (focusedInput !== 'ciudad') {
                    setSearchResults([]);
                    setShowSuggestions(false);
                  }
                  setFocusedInput('ciudad');
                  setSelectedIndex(-1);
                }}
                onKeyDown={(e) => handleKeyDown(e, 'ciudad')}
                required
                style={{
                  padding: '12px', border: '1px solid var(--color-mist)', borderRadius: '4px',
                  fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box'
                }}
              />
              {focusedInput === 'ciudad' && showSuggestions && searchResults.length > 0 && (
                <ul style={{
                  backgroundColor: 'white', border: '1px solid var(--color-mist)',
                  borderRadius: '4px', margin: 0, padding: 0,
                  listStyle: 'none', maxHeight: '150px', overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'left',
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 3000
                }}>
                  {searchResults.map((res, idx) => (
                    <li 
                      key={idx}
                      onClick={() => {
                        setCiudad(res.name || res.display_name.split(',')[0]);
                        setShowSuggestions(false);
                        setSearchResults([]);
                        setSelectedIndex(-1);
                        setFocusedInput('calle');
                        setTimeout(() => calleRef.current?.focus(), 10);
                      }}
                      style={{
                        padding: '10px 15px', fontSize: '12px', borderBottom: '1px solid var(--color-lichen)',
                        cursor: 'pointer', color: 'var(--color-graphite)',
                        backgroundColor: idx === selectedIndex ? 'var(--color-mist)' : 'transparent'
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onMouseLeave={() => setSelectedIndex(-1)}
                    >
                      {res.name || res.display_name.split(',')[0]}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative' }}>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-graphite)', marginBottom: '4px' }}>Calle / Avenida</label>
              <input 
                ref={calleRef}
                type="text" 
                value={calle}
                onChange={(e) => setCalle(e.target.value)}
                onFocus={() => {
                  if (focusedInput !== 'calle') {
                    setSearchResults([]);
                    setShowSuggestions(false);
                  }
                  setFocusedInput('calle');
                  setSelectedIndex(-1);
                }}
                onKeyDown={(e) => handleKeyDown(e, 'calle')}
                required
                style={{
                  padding: '12px', border: '1px solid var(--color-mist)', borderRadius: '4px',
                  fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box'
                }}
              />
              
              {focusedInput === 'calle' && showSuggestions && searchResults.length > 0 && (
                <ul style={{
                  backgroundColor: 'white', border: '1px solid var(--color-mist)',
                  borderRadius: '4px', margin: 0, padding: 0,
                  listStyle: 'none', maxHeight: '150px', overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'left',
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 3000
                }}>
                  {searchResults.map((res, idx) => (
                    <li 
                      key={idx}
                      onClick={() => {
                        setCalle(res.name);
                        setShowSuggestions(false);
                        setSearchResults([]);
                        setSelectedIndex(-1);
                        setTimeout(() => numeroRef.current?.focus(), 10);
                      }}
                      style={{
                        padding: '10px 15px', fontSize: '12px', borderBottom: '1px solid var(--color-lichen)',
                        cursor: 'pointer', color: 'var(--color-graphite)',
                        backgroundColor: idx === selectedIndex ? 'var(--color-mist)' : 'transparent'
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onMouseLeave={() => setSelectedIndex(-1)}
                    >
                      {res.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-graphite)', marginBottom: '4px' }}>Número</label>
              <input 
                ref={numeroRef}
                type="text" 
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                required
                style={{
                  padding: '12px', border: '1px solid var(--color-mist)', borderRadius: '4px',
                  fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box'
                }}
              />
            </div>

            <button type="submit" disabled={isSearching} className="btn-solid" style={{ width: '100%', marginTop: '10px' }}>
              {isSearching ? 'BUSCANDO...' : 'EXTRAER PARCELA'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <p style={{ fontSize: '12px', color: 'var(--color-slate-smoke)', margin: '0 0 10px 0' }}>¿No encuentras tu dirección exacta?</p>
              <button 
                type="button"
                onClick={() => setHideSearchForm(true)}
                className="btn-outline"
                style={{ width: '100%', padding: '8px', fontSize: '12px' }}
              >
                SELECCIONAR MANUALMENTE EN EL MAPA
              </button>
            </div>
          </form>
        </div>
      )}

      {!parcel && hideSearchForm && (
        <div style={{
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, backgroundColor: 'rgba(255,255,255,0.95)', padding: '10px 20px',
          borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '15px'
        }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: 'var(--color-leaf)' }}>
            👇 Haz clic sobre tu casa en el mapa para extraerla
          </p>
          <button 
            onClick={() => setHideSearchForm(false)}
            style={{ background: 'none', border: '1px solid var(--color-lichen)', borderRadius: '4px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}
          >
            Volver al buscador
          </button>
        </div>
      )}

      {parcel && unplacedPlants.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 1000,
          backgroundColor: 'rgba(255,255,255,0.9)',
          padding: '10px 15px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(10px)',
          width: '220px'
        }}>
          {unplacedPlants.length > 0 ? (
            <>
              <h3 style={{ fontSize: '12px', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>
                Plantas sin ubicar ({unplacedPlants.length})
              </h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
                {unplacedPlants.map(p => (
                  <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <button
                      onClick={() => setSelectedPlantId(p.id)}
                      disabled={isSaving}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        width: '100%',
                        padding: '10px',
                        backgroundColor: selectedPlantId === p.id ? 'var(--color-mist)' : 'white',
                        border: `1px solid ${selectedPlantId === p.id ? 'var(--color-eucalyptus)' : 'var(--color-lichen)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedPlantId === p.id ? '0 2px 8px rgba(43,83,41,0.15)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-ink-black)' }}>
                        {p.name || p.species}
                      </span>
                      {p.name && p.species && p.name !== p.species && (
                        <span style={{ fontSize: '11px', color: 'var(--color-graphite)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
                          {p.species}
                        </span>
                      )}
                    </button>
                    {selectedPlantId === p.id && (
                      <div style={{ display: 'flex', gap: '5px', paddingLeft: '5px' }}>
                        <button 
                          onClick={() => { setPlacementType('point'); setDrawingPath([]); }}
                          style={{ flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px', border: '1px solid', borderColor: placementType === 'point' ? 'var(--color-eucalyptus)' : 'var(--color-lichen)', backgroundColor: placementType === 'point' ? 'var(--color-eucalyptus)' : 'white', color: placementType === 'point' ? 'white' : 'var(--color-slate-smoke)', cursor: 'pointer' }}
                        >
                          PUNTO
                        </button>
                        <button 
                          onClick={() => { setPlacementType('line'); setDrawingPath([]); }}
                          style={{ flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px', border: '1px solid', borderColor: placementType === 'line' ? 'var(--color-eucalyptus)' : 'var(--color-lichen)', backgroundColor: placementType === 'line' ? 'var(--color-eucalyptus)' : 'white', color: placementType === 'line' ? 'white' : 'var(--color-slate-smoke)', cursor: 'pointer' }}
                        >
                          LÍNEA
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {placementType === 'point' && selectedPlantId && (
                <p style={{ fontSize: '11px', color: 'var(--color-graphite)', marginTop: '5px', lineHeight: 1.3, textAlign: 'center' }}>
                  👆 Haz clic en el mapa para ubicarla.
                </p>
              )}
              {placementType === 'line' && selectedPlantId && (
                <div style={{ marginTop: '5px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: 'var(--color-graphite)', margin: '0 0 5px 0', lineHeight: 1.3 }}>
                    Haz múltiples clics para dibujar la línea.
                  </p>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button 
                      onClick={handleCancelDrawing}
                      className="btn-outline" 
                      style={{ flex: 1, padding: '4px', fontSize: '10px' }}
                    >
                      CANCELAR
                    </button>
                    <button 
                      onClick={handleFinishDrawing}
                      disabled={drawingPath.length < 2 || isSaving}
                      className="btn-solid" 
                      style={{ flex: 1, padding: '4px', fontSize: '10px', opacity: drawingPath.length < 2 ? 0.5 : 1 }}
                    >
                      FINALIZAR
                    </button>
                  </div>
                </div>
              )}
              {!selectedPlantId && (
                <p style={{ fontSize: '11px', color: 'var(--color-graphite)', marginTop: '5px', lineHeight: 1.3, textAlign: 'center' }}>
                  👇 Selecciona una para ubicarla.
                </p>
              )}
              <button
                onClick={pedirCambioParcela}
                style={{
                  display: 'block', margin: '8px auto 0', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--color-slate-smoke)', padding: 0,
                }}
              >
                Cambiar parcela
              </button>
            </>
          ) : null}
        </div>
      )}

      {/* Con todo ubicado, el mapa queda limpio: solo dos chips discretos. */}
      {parcel && unplacedPlants.length === 0 && (
        <div style={{ position: 'absolute', bottom: '20px', left: '12px', zIndex: 1000, display: 'flex', gap: '6px' }}>
          <Link
            href="/plants/new"
            className="chip-btn"
            style={{ backgroundColor: 'rgba(255,255,255,0.92)', boxShadow: '0 2px 8px rgba(9,53,46,0.18)' }}
          >
            + Planta
          </Link>
          <button
            onClick={pedirCambioParcela}
            className="chip-btn"
            style={{ backgroundColor: 'rgba(255,255,255,0.92)', boxShadow: '0 2px 8px rgba(9,53,46,0.18)', color: 'var(--color-slate-smoke)' }}
          >
            Cambiar parcela
          </button>
        </div>
      )}

      <MapComponent 
        plants={plants} 
        parcel={parcel}
        selectingMode={!!selectedPlantId} 
        drawingPath={drawingPath}
        onLocationSelect={handleLocationSelect} 
        onMoveRequest={handleMovePlant}
        onRemoveRequest={handleRemovePlantFromMap}
      />
    </div>
  );
}
