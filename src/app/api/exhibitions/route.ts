import { NextResponse } from "next/server";
import { Exhibition } from "@/lib/types";
import exhibitionsData from "@/lib/exhibitions-data.json";

interface RawExhibition {
  id: string;
  title: string;
  place: string;
  address: string;
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
  thumbnail: string;
  blogCount: number | null;
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const exhibitions: Exhibition[] = (exhibitionsData as RawExhibition[])
    .filter((item) => !item.endDate || item.endDate >= today)
    .map((item) => ({
      ...item,
      category: "전시",
    }));

  return NextResponse.json(exhibitions);
}
