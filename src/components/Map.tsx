"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import {
  Exhibition,
  getPopularityLevel,
  getPopularityColor,
} from "@/lib/types";
import SlideUpCard from "./SlideUpCard";

function createCircleIcon(color: string, radius: number, isSelected: boolean): L.DivIcon {
  const size = radius * 2;
  const border = isSelected ? "3px solid #1d4ed8" : "1.5px solid #fff";
  const opacity = isSelected ? 1 : 0.8;

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [radius, radius],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};opacity:${opacity};
      border:${border};box-sizing:border-box;
    "></div>`,
  });
}

function MapController({
  exhibitions,
  selectedId,
}: {
  exhibitions: Exhibition[];
  selectedId: string | null;
}) {
  const map = useMap();
  const fitted = useRef(false);
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (exhibitions.length === 0 || fitted.current) return;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    const bounds = L.latLngBounds(
      exhibitions.map((e) => L.latLng(e.lat, e.lng))
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    fitted.current = true;
  }, [map, exhibitions]);

  useEffect(() => {
    if (!selectedId || selectedId === prevId.current) return;
    prevId.current = selectedId;
    const ex = exhibitions.find((e) => e.id === selectedId);
    if (!ex) return;

    // Offset the target so the marker appears above the slide-up card
    // Card covers roughly the bottom 40% of the map on mobile
    const flyToWithOffset = () => {
      const size = map.getSize();
      const targetPoint = map.project([ex.lat, ex.lng], 15);
      const offsetY = size.y * 0.2; // shift marker to upper portion
      const offsetPoint = L.point(targetPoint.x, targetPoint.y + offsetY);
      const offsetLatLng = map.unproject(offsetPoint, 15);
      map.flyTo(offsetLatLng, 15, { duration: 0.8 });
    };

    const size = map.getSize();
    if (size.x === 0 || size.y === 0) {
      const onResize = () => {
        flyToWithOffset();
        map.off("resize", onResize);
      };
      map.on("resize", onResize);
      return () => {
        map.off("resize", onResize);
      };
    }
    flyToWithOffset();
  }, [map, exhibitions, selectedId]);

  return null;
}

function ClusterLayer({
  exhibitions,
  selectedId,
  onSelect,
}: {
  exhibitions: Exhibition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<globalThis.Map<string, L.Marker>>(new globalThis.Map());
  const prevSelectedRef = useRef<string | null>(null);

  // Build markers only when exhibitions change
  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        let clusterColor = "#9ca3af";
        const markers = c.getAllChildMarkers();
        for (const m of markers) {
          const mc = (m as L.Marker & { _color?: string })._color;
          if (mc === "#ef4444") { clusterColor = "#ef4444"; break; }
          if (mc === "#f97316" && clusterColor !== "#ef4444") clusterColor = "#f97316";
          if (mc === "#eab308" && clusterColor === "#9ca3af") clusterColor = "#eab308";
        }
        return L.divIcon({
          className: "",
          iconSize: [36, 36],
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:${clusterColor};color:#fff;
            display:flex;align-items:center;justify-content:center;
            font-size:12px;font-weight:bold;
            border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
          ">${count}</div>`,
        });
      },
    });

    const newMarkers = new globalThis.Map<string, L.Marker>();

    for (const ex of exhibitions) {
      const level = getPopularityLevel(ex.blogCount);
      const color = getPopularityColor(level);
      const radius =
        ex.blogCount !== null
          ? Math.min(6 + Math.sqrt(ex.blogCount) * 0.8, 20)
          : 6;

      const marker = L.marker([ex.lat, ex.lng], {
        icon: createCircleIcon(color, radius, false),
      });
      (marker as L.Marker & { _color?: string })._color = color;
      (marker as L.Marker & { _radius?: number })._radius = radius;

      marker.on("click", () => onSelect(ex.id));
      cluster.addLayer(marker);
      newMarkers.set(ex.id, marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;
    markersRef.current = newMarkers;
    prevSelectedRef.current = null;

    return () => {
      map.removeLayer(cluster);
    };
  }, [map, exhibitions, onSelect]);

  // Update only the affected marker icons when selection changes
  useEffect(() => {
    const markers = markersRef.current;
    const prev = prevSelectedRef.current;

    // Deselect previous
    if (prev && markers.has(prev)) {
      const m = markers.get(prev)!;
      const color = (m as L.Marker & { _color?: string })._color || "#9ca3af";
      const radius = (m as L.Marker & { _radius?: number })._radius || 6;
      m.setIcon(createCircleIcon(color, radius, false));
    }

    // Select new
    if (selectedId && markers.has(selectedId)) {
      const m = markers.get(selectedId)!;
      const color = (m as L.Marker & { _color?: string })._color || "#9ca3af";
      const radius = (m as L.Marker & { _radius?: number })._radius || 6;
      m.setIcon(createCircleIcon(color, radius + 3, true));
    }

    prevSelectedRef.current = selectedId;
  }, [selectedId]);

  return null;
}

interface MapProps {
  exhibitions: Exhibition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Map({ exhibitions, selectedId, onSelect }: MapProps) {
  const selectedExhibition = exhibitions.find((e) => e.id === selectedId) || null;

  const handleClose = useCallback(() => {
    onSelect("");
  }, [onSelect]);

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[36.5, 127.5]}
        zoom={7}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapController exhibitions={exhibitions} selectedId={selectedId} />
        <ClusterLayer
          exhibitions={exhibitions}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </MapContainer>
      <SlideUpCard
        exhibition={selectedExhibition}
        onClose={handleClose}
      />
    </div>
  );
}
