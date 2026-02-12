"use client";

import { Exhibition, getPopularityLevel, getPopularityColor } from "@/lib/types";

interface Props {
  exhibitions: Exhibition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
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
                  <span
                    className="mt-1.5 w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {ex.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{ex.place}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">
                        {ex.startDate} ~ {ex.endDate}
                      </p>
                      {ex.blogCount !== null && (
                        <span className="text-xs font-medium" style={{ color }}>
                          블로그 {ex.blogCount.toLocaleString()}건
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
