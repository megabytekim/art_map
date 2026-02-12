import { NextResponse } from "next/server";
import { Exhibition } from "@/lib/types";
import exhibitionsData from "@/lib/exhibitions-data.json";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const exhibitions: Exhibition[] = exhibitionsData
    .filter((item) => !item.endDate || item.endDate >= today)
    .map((item) => ({
      id: item.id,
      title: item.title,
      place: item.place,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      startDate: item.startDate,
      endDate: item.endDate,
      thumbnail: item.thumbnail,
      category: "전시",
      blogCount: null,
    }));

  return NextResponse.json(exhibitions);
}
