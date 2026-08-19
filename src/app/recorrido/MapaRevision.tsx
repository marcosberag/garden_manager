'use client';

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pinDePlanta, TAMANO_PIN, ANCLA_PIN } from '@/lib/plant-icons';

export type MarcadorRevision = {
  key: string;
  nombre: string;
  lat: number | null;
  lng: number | null;
  categoria: string | null;
};

type Props = {
  parcel: object | null;
  marcadores: MarcadorRevision[];
  colocando: string | null; // key de la detección pendiente de colocar con un toque
  onMover: (key: string, lat: number, lng: number) => void;
};

/** Encuadra la parcela (o los pins) al montar el mapa. */
function AjusteInicial({ parcel, marcadores }: { parcel: object | null; marcadores: MarcadorRevision[] }) {
  const map = useMap();
  useEffect(() => {
    if (parcel) {
      const bounds = L.geoJSON(parcel as GeoJSON.GeoJsonObject).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 21 });
        return;
      }
    }
    const conPos = marcadores.filter(m => m.lat != null && m.lng != null);
    if (conPos.length > 0) {
      const bounds = L.latLngBounds(conPos.map(m => [m.lat!, m.lng!] as [number, number]));
      map.fitBounds(bounds.pad(0.4), { maxZoom: 19 });
    }
    // Solo al montar: después manda el usuario con el zoom y el arrastre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Un toque en el mapa coloca la detección seleccionada. */
function ColocadorPorToque({ colocando, onMover }: { colocando: string | null; onMover: Props['onMover'] }) {
  useMapEvents({
    click(e) {
      if (colocando) onMover(colocando, e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapaRevision({ parcel, marcadores, colocando, onMover }: Props) {
  const estiloParcela = useMemo(() => ({
    fillColor: '#77aa83',
    fillOpacity: 0.18,
    color: '#09352e',
    weight: 2,
  }), []);

  return (
    <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-lichen)', cursor: colocando ? 'crosshair' : undefined }}>
      <MapContainer
        center={[40.4168, -3.7038]}
        zoom={parcel ? 18 : 6}
        maxZoom={21}
        style={{ height: '100%', width: '100%', backgroundColor: '#ffffff' }}
      >
        {/* Sin parcela dibujada, el satélite ayuda a orientarse */}
        {!parcel && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            maxZoom={21}
            maxNativeZoom={19}
          />
        )}
        {parcel && <GeoJSON data={parcel as GeoJSON.GeoJsonObject} style={estiloParcela} />}

        <AjusteInicial parcel={parcel} marcadores={marcadores} />
        <ColocadorPorToque colocando={colocando} onMover={onMover} />

        {marcadores.filter(m => m.lat != null && m.lng != null).map(m => (
          <Marker
            key={m.key}
            position={[m.lat!, m.lng!]}
            draggable
            icon={L.divIcon({
              className: 'custom-plant-icon',
              html: pinDePlanta(m.categoria),
              iconSize: TAMANO_PIN,
              iconAnchor: ANCLA_PIN,
            })}
            eventHandlers={{
              dragend: (e) => {
                const pos = (e.target as L.Marker).getLatLng();
                onMover(m.key, pos.lat, pos.lng);
              },
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
