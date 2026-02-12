"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Exhibition } from "@/lib/types";
import ExhibitionPanel from "@/components/ExhibitionPanel";
import Legend from "@/components/Legend";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Home() {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const fetchBlogCounts = useCallback(async (exs: Exhibition[]) => {
    const updated = [...exs];

    const batchSize = 5;
    for (let i = 0; i < updated.length; i += batchSize) {
      const batch = updated.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (ex) => {
          try {
            const params = new URLSearchParams({ title: ex.title });
            if (ex.place) params.set("place", ex.place);
            const res = await fetch(`/api/blog-count?${params}`);
            const data = await res.json();
            return data.total as number | null;
          } catch {
            return null;
          }
        })
      );

      results.forEach((count, idx) => {
        updated[i + idx] = { ...updated[i + idx], blogCount: count };
      });

      setExhibitions([...updated]);
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/exhibitions");
        const data: Exhibition[] = await res.json();
        setExhibitions(data);
        setLoading(false);

        const needsBlogCount = data.some((e) => e.blogCount === null);
        if (needsBlogCount) {
          fetchBlogCounts(data);
        }
      } catch {
        setLoading(false);
      }
    }
    load();
  }, [fetchBlogCounts]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ART MAP</h1>
          <p className="text-xs text-gray-500">서울 전시 지도 + 블로그 인기도</p>
        </div>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="md:hidden px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
        >
          {panelOpen ? "지도 보기" : "목록 보기"}
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Exhibition list panel */}
        <div
          className={`${
            panelOpen ? "block" : "hidden"
          } md:block w-full md:w-[380px] flex-shrink-0 border-r border-gray-200 overflow-hidden`}
        >
          <ExhibitionPanel
            exhibitions={exhibitions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
          />
        </div>

        {/* Map */}
        <div
          className={`${
            panelOpen ? "hidden" : "block"
          } md:block flex-1 relative`}
        >
          <Map
            exhibitions={exhibitions}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <Legend />
        </div>
      </div>
    </div>
  );
}
