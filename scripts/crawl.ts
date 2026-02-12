// Crawl opengallery.co.kr for ongoing exhibition data
// Usage: npx tsx scripts/crawl.ts

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
}

async function getExhibitionIds(): Promise<string[]> {
  const ids: string[] = [];
  // Fetch first 2 pages of ongoing exhibitions
  for (const page of [1, 2, 3]) {
    const res = await fetch(
      `https://www.opengallery.co.kr/exhibition/?status=ongoing&p=${page}`
    );
    const html = await res.text();
    const matches = html.matchAll(/href="\/exhibition\/(\d+)\/"/g);
    for (const m of matches) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    }
  }
  return ids;
}

async function getExhibitionDetail(id: string): Promise<RawExhibition | null> {
  try {
    const res = await fetch(`https://www.opengallery.co.kr/exhibition/${id}/`);
    const html = await res.text();

    // Title from og:title meta tag (most reliable)
    const ogTitle = extract(html, /<meta property="og:title" content="([^"]*)"/);
    const title = ogTitle
      ? ogTitle.replace(/ 전시 정보 :: 오픈갤러리$/, "").replace(/^'|'$/g, "")
      : "";

    // GPS from djContext variables
    const lat = parseFloat(extract(html, /djContext\.locationLatitude\s*=\s*([0-9.]+)/) || "0");
    const lng = parseFloat(extract(html, /djContext\.locationLongitude\s*=\s*([0-9.]+)/) || "0");

    // Place name from djContext
    const place = (extract(html, /djContext\.locationName\s*=\s*'([^']*)'/) || "").trim();

    // Address: use place as address (opengallery doesn't expose street address easily)
    const address = place;

    // Dates from og:description: "[서울] 장소 | 2025-12-20 ~ 2026-03-29"
    const ogDesc = extract(html, /<meta property="og:description" content="([^"]*)"/) || "";
    const dateMatch = ogDesc.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
    const startDate = dateMatch ? dateMatch[1] : "";
    const endDate = dateMatch ? dateMatch[2] : "";

    const thumbnail = extract(html, /<meta property="og:image" content="([^"]*)"/) || "";

    if (!title) return null;

    return {
      id,
      title: cleanText(title),
      place: cleanText(place),
      address: cleanText(address),
      lat,
      lng,
      startDate,
      endDate,
      thumbnail,
    };
  } catch (e) {
    console.error(`Failed to fetch ${id}:`, e);
    return null;
  }
}

function extract(html: string, regex: RegExp): string | null {
  const m = regex.exec(html);
  return m ? m[1] : null;
}

function extractMeta(html: string, name: string): string | null {
  const regex = new RegExp(`<meta[^>]*(?:name|property)=["'](?:[^"']*:)?${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const m = regex.exec(html);
  if (m) return m[1];
  const regex2 = new RegExp(`content=["']([^"']*)["'][^>]*(?:name|property)=["'](?:[^"']*:)?${name}["']`, "i");
  const m2 = regex2.exec(html);
  return m2 ? m2[1] : null;
}

function cleanText(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

async function main() {
  console.log("Fetching exhibition IDs...");
  const ids = await getExhibitionIds();
  console.log(`Found ${ids.length} exhibitions`);

  const results: RawExhibition[] = [];
  const batchSize = 5;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const details = await Promise.all(batch.map(getExhibitionDetail));
    for (const d of details) {
      if (d) results.push(d);
    }
    console.log(`Progress: ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
  }

  // Filter out entries without valid coordinates
  const withCoords = results.filter((r) => r.lat !== 0 && r.lng !== 0);
  const withoutCoords = results.filter((r) => r.lat === 0 || r.lng === 0);

  console.log(`\nResults: ${withCoords.length} with GPS, ${withoutCoords.length} without GPS`);

  if (withoutCoords.length > 0) {
    console.log("\nWithout GPS:");
    withoutCoords.forEach((e) => console.log(`  - ${e.title} @ ${e.place}`));
  }

  // Write to JSON
  const outputPath = new URL("../src/lib/exhibitions-data.json", import.meta.url);
  const fs = await import("fs");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(withCoords, null, 2),
    "utf-8"
  );
  console.log(`\nSaved ${withCoords.length} exhibitions to src/lib/exhibitions-data.json`);
}

main();
