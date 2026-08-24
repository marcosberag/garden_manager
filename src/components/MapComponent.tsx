'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, GeoJSON, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pinDePlanta, svgDePlanta, TAMANO_PIN, ANCLA_PIN } from '@/lib/plant-icons';
import type { GeoJsonObject } from 'geojson';

// Todas las plantas usan un pin propio (ver más abajo). Se sustituye también el
// marcador por defecto de Leaflet, que se descargaba de unpkg.com, para no
// depender de un CDN externo por un icono que nunca se llega a ver.
L.Marker.prototype.options.icon = L.divIcon({
  className: 'custom-plant-icon',
  html: pinDePlanta('generica'),
  iconSize: TAMANO_PIN,
  iconAnchor: ANCLA_PIN,
});

interface Plant {
  id: string;
  name: string;
  species?: string;
  lat?: number;
  lng?: number;
  location?: string;
  description?: string;
  size?: string;
  age?: string;
  health?: string;
  icon_emoji?: string;
  icon_category?: string;
  image_url?: string;
  species_image_url?: string;
  path?: [number, number][];
}

const VERDE_APP = '#117025';

interface MapComponentProps {
  plants: Plant[];
  parcel?: GeoJsonObject | null;
  onLocationSelect?: (lat: number, lng: number) => void;
  selectingMode?: boolean;
  drawingPath?: [number, number][];
  onMoveRequest?: (plantId: string) => void;
  onRemoveRequest?: (plantId: string) => void;
}

function LocationPicker({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapComponent({ plants, parcel, onLocationSelect, selectingMode = false, drawingPath, onMoveRequest, onRemoveRequest }: MapComponentProps) {
  // Default center (Spain)
  const [center] = useState<[number, number]>([40.4168, -3.7038]);
  const [zoom] = useState(6);
  const mapRef = useRef<L.Map>(null);
  const [mapReady, setMapReady] = useState(false);
  const hasInitializedGeolocation = useRef(false);

  useEffect(() => {
    if (parcel && mapRef.current) {
      // Create a temporary GeoJSON layer to calculate bounds
      const geoJsonLayer = L.geoJSON(parcel);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 21 });
      }
    } else if (!parcel && !hasInitializedGeolocation.current) {
      hasInitializedGeolocation.current = true;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          if (mapRef.current) {
            mapRef.current.setView([position.coords.latitude, position.coords.longitude], 12);
          }
        });
      }
    }
  }, [parcel, mapReady]);

  // Si hay parcela, el estilo del polígono
  // La parcela va sobre la imagen real de satélite, así que el borde es una
  // línea de finca al estilo Google Earth: trazo blanco nítido con una sombra
  // oscura debajo para que se lea sobre cualquier vegetación.
  const parcelUnderStyle = {
    fill: false,
    color: '#09352e',
    weight: 5,
    opacity: 0.45,
  };
  const parcelStyle = {
    fillColor: '#85c093',
    fillOpacity: 0.05,
    color: '#ffffff',
    weight: 2.5,
    opacity: 0.95,
  };

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {selectingMode && parcel && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          backgroundColor: 'var(--color-eucalyptus)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '20px',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          pointerEvents: 'none'
        }}>
          Haz clic dentro de tu parcela para colocar la planta
        </div>
      )}
      
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ 
          height: '100%', 
          width: '100%', 
          cursor: onLocationSelect && !parcel ? 'crosshair' : (selectingMode && parcel ? 'crosshair' : 'grab'),
          backgroundColor: 'var(--color-sage-paper, #e7eae6)'
        }}
        ref={mapRef}
        whenReady={() => setMapReady(true)}
        maxZoom={21} // Allow deep zoom for small parcels
      >
        {/* Imagen real de satélite (Esri World Imagery) siempre debajo: el
            jardín de verdad, no un esquema sobre blanco. */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles &copy; Esri'
          maxZoom={21}
          maxNativeZoom={19}
        />

        {/* Nombres de calles y lugares, solo mientras se busca la parcela */}
        {!parcel && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            attribution=""
            maxZoom={21}
            maxNativeZoom={19}
          />
        )}

        {parcel && (
          <>
            <GeoJSON data={parcel} style={parcelUnderStyle} />
            <GeoJSON data={parcel} style={parcelStyle} />
          </>
        )}

        {drawingPath && drawingPath.length > 1 && (
          <Polyline positions={drawingPath} color="var(--color-eucalyptus)" weight={4} dashArray="5, 10" />
        )}

        {plants.filter(p => (p.lat && p.lng) || (p.path && p.path.length > 0)).map(plant => {

          // Colocada como línea = seto: banda sobre el satélite y una chapa
          // redonda centrada como etiqueta — nunca un pin de árbol clavado en
          // mitad de la hilera.
          const esSeto = !!(plant.path && plant.path.length > 1);
          // La foto real manda; si no hay, la foto de la especie; si tampoco,
          // el dibujo de la categoría.
          const foto = plant.image_url || plant.species_image_url;

          const iconHtml = esSeto
            ? `<div style="width: 34px; height: 34px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.4); overflow: hidden; background: white; display: flex; align-items: center; justify-content: center;">${
                foto
                  ? `<img src="${foto}" style="width: 100%; height: 100%; object-fit: cover;" />`
                  : svgDePlanta(plant.icon_category, 22)
              }</div>`
            : foto
              ? `<div style="position: relative; width: 42px; height: 42px;">
                   <div style="width: 42px; height: 42px; border-radius: 50%; border: 3px solid ${plant.image_url ? VERDE_APP : '#77aa83'}; box-shadow: 0 3px 6px rgba(0,0,0,0.35); overflow: hidden; background-color: white;">
                     <img src="${foto}" style="width: 100%; height: 100%; object-fit: cover;" />
                   </div>
                   <div style="position: absolute; right: -5px; bottom: -5px; width: 20px; height: 20px; border-radius: 50%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
                     ${svgDePlanta(plant.icon_category, 14)}
                   </div>
                 </div>`
              : pinDePlanta(plant.icon_category);

          const plantIcon = L.divIcon({
            className: 'custom-plant-icon',
            html: iconHtml,
            // La chapa del seto y los círculos de foto se centran en la
            // coordenada; el pin apoya su punta en ella.
            iconSize: esSeto ? [34, 34] : (foto ? [42, 42] : TAMANO_PIN),
            iconAnchor: esSeto ? [17, 17] : (foto ? [21, 21] : ANCLA_PIN),
            popupAnchor: esSeto ? [0, -19] : (foto ? [0, -22] : [0, -46])
          });
          
          let centerLat = plant.lat;
          let centerLng = plant.lng;
          
          if (plant.path && plant.path.length > 0) {
            const midIndex = Math.floor(plant.path.length / 2);
            centerLat = plant.path[midIndex][0];
            centerLng = plant.path[midIndex][1];
          }

          // Leaflet fails to render Polylines with 1 point.
          const hasValidPath = esSeto;

          return (
            <React.Fragment key={plant.id}>
              {hasValidPath && (
                <>
                  {/* Banda de seto: sombra oscura debajo y salvia encima */}
                  <Polyline positions={plant.path!} color="#09352e" weight={9} opacity={0.5} lineCap="round" lineJoin="round" />
                  <Polyline positions={plant.path!} color="#77aa83" weight={5} opacity={0.9} lineCap="round" lineJoin="round" />
                </>
              )}
              {centerLat !== null && centerLat !== undefined && centerLng !== null && centerLng !== undefined && (
                <Marker 
                  position={[centerLat, centerLng]}
                  icon={plantIcon}
                >
              <Popup>
                <div style={{ padding: '5px', minWidth: '200px' }}>
                  <h3 className="suisse" style={{ margin: '0 0 5px 0', fontSize: '20px', color: 'var(--color-ink-black)' }}>
                    {plant.name || plant.species}
                  </h3>
                  {plant.name && plant.species && plant.name !== plant.species && (
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--color-graphite)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {plant.species}
                    </p>
                  )}
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '15px' }}>
                    {plant.location && <span style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: 'var(--color-ash-gray)', borderRadius: '4px', color: 'var(--color-forest-ink)' }}>📍 {plant.location}</span>}
                    {plant.age && <span style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: 'var(--color-ash-gray)', borderRadius: '4px', color: 'var(--color-forest-ink)' }}>⏳ {plant.age}</span>}
                    {plant.size && <span style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: 'var(--color-ash-gray)', borderRadius: '4px', color: 'var(--color-forest-ink)' }}>📏 {plant.size}</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <a 
                      href={`/plants/${plant.id}/edit`}
                      className="btn-solid"
                      style={{ display: 'block', textAlign: 'center', backgroundColor: 'var(--color-ink-black)', color: 'white', padding: '8px', textDecoration: 'none', fontSize: '12px', width: '100%' }}
                    >
                      Abrir ficha
                    </a>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => {
                          mapRef.current?.closePopup();
                          if (onMoveRequest) onMoveRequest(plant.id);
                        }}
                        className="btn-outline"
                        style={{ flex: 1, padding: '6px', fontSize: '11px', borderColor: 'var(--color-graphite)', color: 'var(--color-ink-black)' }}
                      >
                        Mover
                      </button>
                      <button 
                        onClick={() => {
                          mapRef.current?.closePopup();
                          if (onRemoveRequest) onRemoveRequest(plant.id);
                        }}
                        className="btn-outline"
                        style={{ flex: 1, padding: '6px', fontSize: '11px', borderColor: 'var(--color-alert)', color: 'var(--color-alert)' }}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
            )}
          </React.Fragment>
          );
        })}

        {onLocationSelect && (
          <LocationPicker onSelect={onLocationSelect} />
        )}
      </MapContainer>

      {/* Dim the rest of the world if we have a parcel? We can't easily mask the tile layer, but drawing the polygon is clear enough */}
    </div>
  );
}
