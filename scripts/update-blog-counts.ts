// Update blog counts for existing exhibition data (without re-crawling art-map.co.kr)
// Usage: npx tsx scripts/update-blog-counts.ts

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

interface Exhibition {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Extract the most searchable part of the title
// e.g. "한국 근현대미술 : 붓으로 빚은 한국의 서정" → "붓으로 빚은 한국의 서정"
// e.g. "《지구울림 - 헤르츠앤도우》" → "지구울림 - 헤르츠앤도우"
function extractSearchTitle(title: string): string {
  // Replace brackets with spaces, then collapse multiple spaces
  let cleaned = title.replace(/[《》〈〉<>≪≫〔〕【】『』「」()]/g, " ").replace(/\s+/g, " ").trim();
  // Remove common exhibition suffixes
  cleaned = cleaned.replace(/\s+(개인전|단체전|특별전|기획전|상설전|소장품전|회고전|초대전|귀국전)$/, "").trim();
  // Split on subtitle separators, but only if both parts are long enough
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
        // Don't split if result would be too short (4 chars or less)
        if (candidate.length <= 4) continue;
        cleaned = candidate;
        changed = true;
        break;
      }
    }
  }
  return cleaned;
}

// Build search query: wrap title in quotes, split mixed-language titles
// e.g. "Finnegans Wake 다니엘 보이드" → "Finnegans Wake" "다니엘 보이드"
function buildQuery(searchTitle: string, shortPlace: string): string {
  // Check if title has both Latin and Korean characters
  const hasLatin = /[a-zA-Z]{2,}/.test(searchTitle);
  const hasKorean = /[가-힣]{2,}/.test(searchTitle);

  let titlePart: string;
  if (hasLatin && hasKorean) {
    // Split at the boundary between Latin and Korean
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

async function fetchBlogCount(title: string, place: string, retries = 3): Promise<number | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET not set");
    process.exit(1);
  }

  const searchTitle = extractSearchTitle(title);
  const shortPlace = place ? place.split(" ")[0] : "";
  const query = buildQuery(searchTitle, shortPlace);
  const url = new URL("https://openapi.naver.com/v1/search/blog.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "1");

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      });
      if (res.status === 429) {
        const wait = 1000 * (attempt + 1);
        console.error(`  429 rate limit, waiting ${wait}ms... (${title})`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        console.error(`  API error ${res.status} for: ${title}`);
        return null;
      }
      const data = await res.json();
      return data.total ?? 0;
    } catch (e) {
      console.error(`  Fetch error for: ${title}`, (e as Error).message);
      return null;
    }
  }
  console.error(`  Failed after ${retries} retries: ${title}`);
  return null;
}

async function main() {
  const jsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/exhibitions-data.json");
  const exhibitions: Exhibition[] = JSON.parse(readFileSync(jsonPath, "utf-8"));

  console.log(`Updating blog counts for ${exhibitions.length} exhibitions...`);

  // Sequential with delay to avoid 429
  for (let i = 0; i < exhibitions.length; i++) {
    const ex = exhibitions[i];
    ex.blogCount = await fetchBlogCount(ex.title, ex.place);
    if ((i + 1) % 10 === 0 || i === exhibitions.length - 1) {
      console.log(`  ${i + 1}/${exhibitions.length}`);
    }
    await sleep(100);
  }

  writeFileSync(jsonPath, JSON.stringify(exhibitions, null, 2), "utf-8");
  console.log(`\nDone. Updated ${exhibitions.length} exhibitions.`);
}

main();
