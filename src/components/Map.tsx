"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Exhibition, getPopularityLevel, getPopularityColor } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function MapController({ exhibitions, selectedId }: { exhibitions: Exhibition[]; selectedId: string | null }) {
  const map = useMap();
  const fitted = useRef(false);
  const prevId = useRef<string | null>(null);

  // 컨테이너 사이즈 변경 감지 → invalidateSize
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  // 초기 로드: 전체 전시 범위로 맞추기
  useEffect(() => {
    if (exhibitions.length === 0 || fitted.current) return;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return; // 아직 보이지 않음
    const bounds = L.latLngBounds(exhibitions.map((e) => L.latLng(e.lat, e.lng)));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    fitted.current = true;
  }, [map, exhibitions]);

  // 전시 선택 시 해당 위치로 이동
  useEffect(() => {
    if (!selectedId || selectedId === prevId.current) return;
    prevId.current = selectedId;
    const ex = exhibitions.find((e) => e.id === selectedId);
    if (!ex) return;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) {
      // 맵이 아직 hidden → visible 되면 이동
      const onResize = () => {
        map.flyTo([ex.lat, ex.lng], 15, { duration: 0.8 });
        map.off("resize", onResize);
      };
      map.on("resize", onResize);
      return () => { map.off("resize", onResize); };
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
      center={[36.5, 127.5]}
      zoom={7}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <MapController exhibitions={exhibitions} selectedId={selectedId} />
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
