"use client";

import {
  PopularityLevel,
  getPopularityColor,
  getPopularityLabel,
} from "@/lib/types";

const LEVELS: PopularityLevel[] = ["hot", "warm", "mild", "cold"];

export default function Legend() {
  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">
        블로그 인기도
      </p>
      <div className="space-y-1.5">
        {LEVELS.map((level) => (
          <div key={level} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getPopularityColor(level) }}
            />
            <span className="text-xs text-gray-600">
              {getPopularityLabel(level)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
