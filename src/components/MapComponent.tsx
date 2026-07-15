'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, GeoJSON, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Next.js + Leaflet
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

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
  image_url?: string;
  path?: [number, number][];
}

interface MapComponentProps {
  plants: Plant[];
  parcel?: any;
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
  const [center, setCenter] = useState<[number, number]>([40.4168, -3.7038]);
  const [zoom, setZoom] = useState(6);
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
  const parcelStyle = {
    fillColor: '#2B5329', // Elegante verde oscuro (eucalyptus)
    fillOpacity: 0.15,
    color: '#2B5329', // Borde sólido y nítido
    weight: 2,
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
          backgroundColor: parcel ? 'var(--color-pure-canvas, #F9F8F6)' : '#ddd'
        }}
        ref={mapRef}
        whenReady={() => setMapReady(true)}
        maxZoom={21} // Allow deep zoom for small parcels
      >
        {!parcel && (
          <>
            {/* Satélite (Esri World Imagery) */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='Tiles &copy; Esri'
              maxZoom={21}
              maxNativeZoom={19}
            />

            {/* Nombres de Calles y Lugares encima del Satélite */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution=""
              maxZoom={21}
              maxNativeZoom={19}
            />
          </>
        )}

        {parcel && (
          <GeoJSON data={parcel} style={parcelStyle} />
        )}

        {drawingPath && drawingPath.length > 1 && (
          <Polyline positions={drawingPath} color="var(--color-eucalyptus)" weight={4} dashArray="5, 10" />
        )}

        {parcel && plants.filter(p => (p.lat && p.lng) || (p.path && p.path.length > 0)).map(plant => {
          
          let iconHtml = '';
          
          if (plant.image_url) {
            // Foto Real (Borde Verde)
            iconHtml = `<div style="width: 36px; height: 36px; border-radius: 50%; border: 3px solid var(--color-eucalyptus); box-shadow: 0 4px 6px rgba(0,0,0,0.3); overflow: hidden; background-color: white;">
              <img src="${plant.image_url}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>`;
          } else {
            // Icono Genérico (Borde Gris)
            const emoji = plant.icon_emoji || '🌱';
            iconHtml = `<div style="background-color: white; width: 32px; height: 32px; border-radius: 50%; border: 2px solid #aaa; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; font-size: 18px; color: #333;">${emoji}</div>`;
          }

          const plantIcon = L.divIcon({
            className: 'custom-plant-icon',
            html: iconHtml,
            iconSize: plant.image_url ? [36, 36] : [32, 32],
            iconAnchor: plant.image_url ? [18, 18] : [16, 16],
            popupAnchor: [0, -18]
          });
          
          let centerLat = plant.lat;
          let centerLng = plant.lng;
          
          if (plant.path && plant.path.length > 0) {
            const midIndex = Math.floor(plant.path.length / 2);
            centerLat = plant.path[midIndex][0];
            centerLng = plant.path[midIndex][1];
          }

          // Leaflet fails to render Polylines with 1 point.
          const hasValidPath = plant.path && plant.path.length > 1;

          return (
            <React.Fragment key={plant.id}>
              {hasValidPath && (
                <Polyline positions={plant.path!} color="var(--color-eucalyptus)" weight={4} />
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
                    {plant.location && <span style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', color: '#333' }}>📍 {plant.location}</span>}
                    {plant.age && <span style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', color: '#333' }}>⏳ {plant.age}</span>}
                    {plant.size && <span style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', color: '#333' }}>📏 {plant.size}</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <a 
                      href={`/plants/${plant.id}/edit`}
                      className="btn-solid"
                      style={{ display: 'block', textAlign: 'center', backgroundColor: 'var(--color-ink-black)', color: 'white', padding: '8px', textDecoration: 'none', fontSize: '12px', width: '100%' }}
                    >
                      ABRIR FICHA
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
                        MOVER
                      </button>
                      <button 
                        onClick={() => {
                          mapRef.current?.closePopup();
                          if (onRemoveRequest) onRemoveRequest(plant.id);
                        }}
                        className="btn-outline"
                        style={{ flex: 1, padding: '6px', fontSize: '11px', borderColor: 'var(--color-alert)', color: 'var(--color-alert)' }}
                      >
                        QUITAR
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
