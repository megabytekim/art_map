"use client";

import { useState } from "react";
import { Exhibition, getPopularityLevel, getPopularityColor } from "@/lib/types";

interface Props {
  exhibitions: Exhibition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className="w-16 h-16 rounded-md bg-gray-100 flex-shrink-0 flex items-center justify-center">
        <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className="w-16 h-16 rounded-md object-cover flex-shrink-0 bg-gray-100"
      loading="lazy"
    />
  );
}

export default function ExhibitionPanel({
  exhibitions,
  selectedId,
  onSelect,
  loading,
}: Props) {
  const sorted = [...exhibitions].sort(
    (a, b) => (b.blogCount ?? -1) - (a.blogCount ?? -1)
  );

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">
          진행중 전시
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? "불러오는 중..." : `${exhibitions.length}개 전시`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full" />
          </div>
        ) : (
          sorted.map((ex) => {
            const level = getPopularityLevel(ex.blogCount);
            const color = getPopularityColor(level);
            const isSelected = ex.id === selectedId;

            return (
              <button
                key={ex.id}
                onClick={() => onSelect(ex.id)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <Thumbnail src={ex.thumbnail} alt={ex.title} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-gray-900 line-clamp-2 leading-snug">
                      {ex.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{ex.place}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-400">
                        {ex.startDate} ~ {ex.endDate}
                      </p>
                      {ex.blogCount !== null && (
                        <span
                          className="text-xs font-medium flex items-center gap-1"
                          style={{ color }}
                        >
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          {ex.blogCount.toLocaleString()}건
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
