"use client";

import { useState, useEffect } from "react";
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

  // 모바일: 목록에서 전시 선택 시 자동으로 지도 뷰로 전환
  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (window.innerWidth < 768) {
      setPanelOpen(false);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/exhibitions");
        const data: Exhibition[] = await res.json();
        setExhibitions(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">무하한</h1>
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
            onSelect={handleSelect}
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
            onSelect={handleSelect}
          />
          <Legend />
        </div>
      </div>
    </div>
  );
}
