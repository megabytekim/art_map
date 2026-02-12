export interface Exhibition {
  id: string;
  title: string;
  place: string;
  address: string;
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
  thumbnail: string;
  category: string;
  blogCount: number | null;
}

export type PopularityLevel = "hot" | "warm" | "mild" | "cold";

export function getPopularityLevel(blogCount: number | null): PopularityLevel {
  if (blogCount === null) return "cold";
  if (blogCount >= 100) return "hot";
  if (blogCount >= 30) return "warm";
  if (blogCount >= 10) return "mild";
  return "cold";
}

export function getPopularityColor(level: PopularityLevel): string {
  switch (level) {
    case "hot":
      return "#ef4444";
    case "warm":
      return "#f97316";
    case "mild":
      return "#eab308";
    case "cold":
      return "#9ca3af";
  }
}

export function getPopularityLabel(level: PopularityLevel): string {
  switch (level) {
    case "hot":
      return "인기 높음 (100+)";
    case "warm":
      return "보통 (30-99)";
    case "mild":
      return "관심 적음 (10-29)";
    case "cold":
      return "거의 없음 (0-9)";
  }
}
