"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Exhibition, getPopularityLevel, getPopularityColor } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function InvalidateOnVisible() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  });

  return null;
}

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

function FlyToSelected({ exhibitions, selectedId }: { exhibitions: Exhibition[]; selectedId: string | null }) {
  const map = useMap();
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedId || selectedId === prevId.current) return;
    prevId.current = selectedId;
    const ex = exhibitions.find((e) => e.id === selectedId);
    if (!ex) return;

    // 이미 보이는 위치면 flyTo 스킵
    const point = map.latLngToContainerPoint([ex.lat, ex.lng]);
    const size = map.getSize();
    if (point.x >= 0 && point.x <= size.x && point.y >= 0 && point.y <= size.y && map.getZoom() >= 14) {
      return;
    }
    map.flyTo([ex.lat, ex.lng], 15, { duration: 0.8 });
  }, [map, exhibitions, selectedId]);

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
        attribution='&copy; <a href="https://www.vworld.kr/">VWorld</a>'
        url={`https://api.vworld.kr/req/wmts/1.0.0/${process.env.NEXT_PUBLIC_VWORLD_API_KEY}/Base/{z}/{y}/{x}.png`}
      />
      <InvalidateOnVisible />
      <FitBounds exhibitions={exhibitions} />
      <FlyToSelected exhibitions={exhibitions} selectedId={selectedId} />
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
