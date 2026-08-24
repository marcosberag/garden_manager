'use client';

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pinDePlanta, TAMANO_PIN, ANCLA_PIN } from '@/lib/plant-icons';

export type MarcadorRevision = {
  key: string;
  nombre: string;
  numero: number; // el mismo número que la tarjeta de revisión
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

/**
 * El pin de la revisión lleva el número de su tarjeta: sin él era imposible
 * saber qué pin correspondía a qué detección. El seleccionado brilla.
 */
function iconoNumerado(categoria: string | null, numero: number, resaltado: boolean): L.DivIcon {
  const halo = resaltado ? 'filter: drop-shadow(0 0 6px rgba(133,192,147,0.95));' : '';
  const fondoBadge = resaltado ? '#007010' : '#09352e';
  return L.divIcon({
    className: 'custom-plant-icon',
    html: `<div style="position:relative;width:${TAMANO_PIN[0]}px;height:${TAMANO_PIN[1]}px;${halo}">
      ${pinDePlanta(categoria)}
      <span style="position:absolute;top:-7px;right:-9px;background:${fondoBadge};color:#fff;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;font-weight:600;line-height:1;padding:3px 6.5px;border-radius:9999px;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);">${numero}</span>
    </div>`,
    iconSize: TAMANO_PIN,
    iconAnchor: ANCLA_PIN,
  });
}

export default function MapaRevision({ parcel, marcadores, colocando, onMover }: Props) {
  // Línea de finca sobre el satélite: trazo blanco con sombra oscura debajo,
  // igual que en el mapa principal.
  const estiloParcelaBajo = useMemo(() => ({
    fill: false,
    color: '#09352e',
    weight: 5,
    opacity: 0.45,
  }), []);
  const estiloParcela = useMemo(() => ({
    fillColor: '#85c093',
    fillOpacity: 0.05,
    color: '#ffffff',
    weight: 2.5,
    opacity: 0.95,
  }), []);

  return (
    <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-lichen)', cursor: colocando ? 'crosshair' : undefined }}>
      <MapContainer
        center={[40.4168, -3.7038]}
        zoom={parcel ? 18 : 6}
        maxZoom={21}
        style={{ height: '100%', width: '100%', backgroundColor: '#ffffff' }}
      >
        {/* Imagen real de satélite siempre debajo, con la parcela como contorno */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={21}
          maxNativeZoom={19}
        />
        {parcel && (
          <>
            <GeoJSON data={parcel as GeoJSON.GeoJsonObject} style={estiloParcelaBajo} />
            <GeoJSON data={parcel as GeoJSON.GeoJsonObject} style={estiloParcela} />
          </>
        )}

        <AjusteInicial parcel={parcel} marcadores={marcadores} />
        <ColocadorPorToque colocando={colocando} onMover={onMover} />

        {marcadores.filter(m => m.lat != null && m.lng != null).map(m => (
          <Marker
            key={`${m.key}-${m.numero}-${colocando === m.key}`}
            position={[m.lat!, m.lng!]}
            draggable
            icon={iconoNumerado(m.categoria, m.numero, colocando === m.key)}
            eventHandlers={{
              dragend: (e) => {
                const pos = (e.target as L.Marker).getLatLng();
                onMover(m.key, pos.lat, pos.lng);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -TAMANO_PIN[1]]}>
              {m.numero}. {m.nombre}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
