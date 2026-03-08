# UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ending-soon badges, map clustering, and slide-up blog card to the art map app.

**Architecture:** Add utility for date checks, a new API route for blog search, a SlideUpCard component with CSS animations, and swap CircleMarkers for clustered DivIcon Markers.

**Tech Stack:** Next.js 16, React 19, react-leaflet 5, leaflet.markercluster, Naver Blog Search API, Tailwind CSS 4.

---

### Task 1: Install dependencies

**Step 1: Install leaflet.markercluster**

```bash
cd /Users/michael/art_map
npm install leaflet.markercluster @types/leaflet.markercluster
```

**Step 2: Verify install**

```bash
ls node_modules/leaflet.markercluster/dist/leaflet.markercluster.js
```

Expected: file exists

---

### Task 2: Add `isEndingSoon` utility

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add function to `src/lib/types.ts`**

Append after `getPopularityLabel`:

```typescript
export function isEndingSoon(endDate: string, withinDays = 14): boolean {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return diff >= 0 && diff <= withinDays * 24 * 60 * 60 * 1000;
}
```

**Step 2: Verify**

```bash
cd /Users/michael/art_map && npx tsx -e "
const { isEndingSoon } = require('./src/lib/types');
const future = new Date(); future.setDate(future.getDate() + 7);
const far = new Date(); far.setDate(far.getDate() + 30);
console.log('7 days:', isEndingSoon(future.toISOString().slice(0,10)));
console.log('30 days:', isEndingSoon(far.toISOString().slice(0,10)));
"
```

Expected: `7 days: true`, `30 days: false`

---

### Task 3: Create `/api/blog-search` route

**Files:**
- Create: `src/app/api/blog-search/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";

function extractSearchTitle(title: string): string {
  let cleaned = title.replace(/[《》〈〉<>≪≫〔〕【】『』「」()]/g, " ").replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\s+(개인전|단체전|특별전|기획전|상설전|소장품전|회고전|초대전|귀국전)$/, "").trim();
  const separators = [" : ", ": ", ", ", " - "];
  let changed = true;
  while (changed) {
    changed = false;
    for (const sep of separators) {
      const idx = cleaned.indexOf(sep);
      if (idx > 0) {
        const before = cleaned.slice(0, idx).trim();
        const after = cleaned.slice(idx + sep.length).trim();
        const candidate = after.length >= before.length ? after : before;
        if (candidate.length <= 4) continue;
        cleaned = candidate;
        changed = true;
        break;
      }
    }
  }
  return cleaned;
}

function buildQuery(searchTitle: string, shortPlace: string): string {
  const hasLatin = /[a-zA-Z]{2,}/.test(searchTitle);
  const hasKorean = /[가-힣]{2,}/.test(searchTitle);
  let titlePart: string;
  if (hasLatin && hasKorean) {
    const parts = searchTitle
      .split(/(?<=[a-zA-Z])\s+(?=[가-힣])|(?<=[가-힣])\s+(?=[a-zA-Z])/)
      .map((p) => p.trim())
      .filter((p) => p.length > 1);
    titlePart = parts.map((p) => `"${p}"`).join(" ");
  } else {
    titlePart = `"${searchTitle}"`;
  }
  return shortPlace ? `${titlePart} ${shortPlace}` : titlePart;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "";
  const place = searchParams.get("place") || "";

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ items: [] });
  }

  const searchTitle = extractSearchTitle(title);
  const shortPlace = place ? place.split(" ")[0] : "";
  const query = buildQuery(searchTitle, shortPlace);

  const url = new URL("https://openapi.naver.com/v1/search/blog.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "5");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "sim");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });
    if (!res.ok) return NextResponse.json({ items: [] });

    const data = await res.json();
    const items = (data.items || []).map((item: Record<string, string>) => ({
      title: item.title?.replace(/<\/?b>/g, "") || "",
      link: item.link || "",
      description: item.description?.replace(/<\/?b>/g, "") || "",
      bloggername: item.bloggername || "",
      postdate: item.postdate || "",
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
```

**Step 2: Verify**

```bash
cd /Users/michael/art_map && npm run dev &
sleep 3
curl -s "http://localhost:3000/api/blog-search?title=test&place=test" | head -c 200
kill %1
```

Expected: JSON with `items` array

---

### Task 4: Create `SlideUpCard` component

**Files:**
- Create: `src/components/SlideUpCard.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState, useEffect } from "react";
import { Exhibition, isEndingSoon, getPopularityLevel, getPopularityColor } from "@/lib/types";

interface BlogPost {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  postdate: string;
}

interface Props {
  exhibition: Exhibition | null;
  onClose: () => void;
}

export default function SlideUpCard({ exhibition, onClose }: Props) {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loadingBlogs, setLoadingBlogs] = useState(false);

  useEffect(() => {
    if (!exhibition) {
      setBlogs([]);
      return;
    }

    setLoadingBlogs(true);
    fetch(
      `/api/blog-search?title=${encodeURIComponent(exhibition.title)}&place=${encodeURIComponent(exhibition.place)}`
    )
      .then((res) => res.json())
      .then((data) => setBlogs(data.items || []))
      .catch(() => setBlogs([]))
      .finally(() => setLoadingBlogs(false));
  }, [exhibition]);

  if (!exhibition) return null;

  const level = getPopularityLevel(exhibition.blogCount);
  const color = getPopularityColor(level);
  const endingSoon = isEndingSoon(exhibition.endDate);

  const naverSearchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(
    `"${exhibition.title}" ${exhibition.place.split(" ")[0]}`
  )}`;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1001] animate-slide-up">
      <div className="bg-white rounded-t-2xl shadow-2xl max-h-[60vh] overflow-y-auto">
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-gray-900 leading-snug">
                  {exhibition.title}
                </h3>
                {endingSoon && (
                  <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    마감 임박
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{exhibition.place}</p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-gray-400">
                  {exhibition.startDate} ~ {exhibition.endDate}
                </p>
                {exhibition.blogCount !== null && (
                  <span className="text-xs font-medium flex items-center gap-1" style={{ color }}>
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    {exhibition.blogCount.toLocaleString()}건
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Blog posts */}
        <div className="px-4 pb-4">
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">관련 블로그</p>

            {loadingBlogs ? (
              <div className="flex items-center gap-2 py-3">
                <div className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full" />
                <span className="text-xs text-gray-400">불러오는 중...</span>
              </div>
            ) : blogs.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">블로그 글이 없습니다</p>
            ) : (
              <div className="space-y-2.5">
                {blogs.map((blog, i) => (
                  <a
                    key={i}
                    href={blog.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {blog.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {blog.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">{blog.bloggername}</span>
                      <span className="text-[10px] text-gray-300">
                        {blog.postdate
                          ? `${blog.postdate.slice(0, 4)}.${blog.postdate.slice(4, 6)}.${blog.postdate.slice(6, 8)}`
                          : ""}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Naver search link */}
            <a
              href={naverSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 mt-3 py-2 text-xs text-green-600 hover:text-green-700 font-medium"
            >
              네이버에서 더 보기
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add slide-up animation to global CSS**

Modify: `src/app/globals.css` — add at the end:

```css
@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
```

---

### Task 5: Add clustering to Map + integrate SlideUpCard

**Files:**
- Modify: `src/components/Map.tsx`

**Step 1: Rewrite Map.tsx with clustering and slide-up card**

Replace entire file with:

```typescript
"use client";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
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
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) {
      const onResize = () => {
        map.flyTo([ex.lat, ex.lng], 15, { duration: 0.8 });
        map.off("resize", onResize);
      };
      map.on("resize", onResize);
      return () => {
        map.off("resize", onResize);
      };
    }
    map.flyTo([ex.lat, ex.lng], 15, { duration: 0.8 });
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
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

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

    const newMarkers = new Map<string, L.Marker>();

    for (const ex of exhibitions) {
      const level = getPopularityLevel(ex.blogCount);
      const color = getPopularityColor(level);
      const isSelected = ex.id === selectedId;
      const radius =
        ex.blogCount !== null
          ? Math.min(6 + Math.sqrt(ex.blogCount) * 0.8, 20)
          : 6;

      const marker = L.marker([ex.lat, ex.lng], {
        icon: createCircleIcon(color, isSelected ? radius + 3 : radius, isSelected),
      });
      (marker as L.Marker & { _color?: string })._color = color;

      marker.on("click", () => onSelect(ex.id));
      cluster.addLayer(marker);
      newMarkers.set(ex.id, marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;
    markersRef.current = newMarkers;

    return () => {
      map.removeLayer(cluster);
    };
  }, [map, exhibitions, selectedId, onSelect]);

  return null;
}

interface MapProps {
  exhibitions: Exhibition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Map({ exhibitions, selectedId, onSelect }: MapProps) {
  const selectedExhibition = exhibitions.find((e) => e.id === selectedId) || null;

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
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
        onClose={() => onSelect("")}
      />
    </div>
  );
}
```

Note: Remove the `Popup` import and all `<Popup>` JSX — replaced by SlideUpCard.

---

### Task 6: Update ExhibitionPanel with 마감 임박 badge

**Files:**
- Modify: `src/components/ExhibitionPanel.tsx`

**Step 1: Add import and badge**

Add `isEndingSoon` to the import:

```typescript
import { Exhibition, getPopularityLevel, getPopularityColor, isEndingSoon } from "@/lib/types";
```

Inside the `sorted.map` callback, after `const isSelected = ...`, add:

```typescript
const endingSoon = isEndingSoon(ex.endDate);
```

After the `<p>` tag containing `ex.title` (line-clamp-2), add:

```tsx
{endingSoon && (
  <span className="inline-block text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full mt-0.5">
    마감 임박
  </span>
)}
```

---

### Task 7: Update page.tsx — handle card close

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update handleSelect to handle empty string (close)**

In the `handleSelect` function, add early return for empty id:

```typescript
const handleSelect = (id: string) => {
  if (id === "") {
    setSelectedId(null);
    return;
  }
  setSelectedId(id);
  if (window.innerWidth < 768) {
    setPanelOpen(false);
  }
};
```

---

### Task 8: Verify and commit

**Step 1: Run dev server and verify**

```bash
cd /Users/michael/art_map && npm run dev
```

Check:
- [ ] Exhibition list shows "마감 임박" badge on exhibitions ending within 14 days
- [ ] Map clusters markers when zoomed out, shows individual markers when zoomed in
- [ ] Clicking a marker/list item shows slide-up card with blog posts
- [ ] "네이버에서 더 보기" link opens Naver search
- [ ] Close button on card works

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: UX improvements - ending-soon badge, map clustering, slide-up blog card"
```
