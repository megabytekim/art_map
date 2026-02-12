"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Exhibition, getPopularityLevel, getPopularityColor } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function FitBounds({ exhibitions }: { exhibitions: Exhibition[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (exhibitions.length === 0 || fitted.current) return;

    const bounds = L.latLngBounds(
      exhibitions.map((e) => L.latLng(e.lat, e.lng))
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    fitted.current = true;
  }, [map, exhibitions]);

  return null;
}

interface MapProps {
  exhibitions: Exhibition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Map({ exhibitions, selectedId, onSelect }: MapProps) {
  return (
    <MapContainer
      center={[37.5665, 126.978]}
      zoom={12}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds exhibitions={exhibitions} />
      {exhibitions.map((ex) => {
        const level = getPopularityLevel(ex.blogCount);
        const color = getPopularityColor(level);
        const isSelected = ex.id === selectedId;
        const radius = ex.blogCount !== null
          ? Math.min(6 + Math.sqrt(ex.blogCount) * 0.8, 20)
          : 6;

        return (
          <CircleMarker
            key={ex.id}
            center={[ex.lat, ex.lng]}
            radius={isSelected ? radius + 3 : radius}
            pathOptions={{
              fillColor: color,
              fillOpacity: isSelected ? 1 : 0.8,
              color: isSelected ? "#1d4ed8" : "#fff",
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{
              click: () => onSelect(ex.id),
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <p className="font-bold text-sm mb-1">{ex.title}</p>
                <p className="text-xs text-gray-600">{ex.place}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {ex.startDate} ~ {ex.endDate}
                </p>
                {ex.blogCount !== null && (
                  <p className="text-xs mt-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: color }}
                    />
                    블로그 {ex.blogCount.toLocaleString()}건
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
