// Update blog counts for existing exhibition data (without re-crawling art-map.co.kr)
// Usage: npx tsx scripts/update-blog-counts.ts

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
import { extractSearchTitle, buildQuery } from "../src/lib/search-utils";

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

const RECENT_DAYS = 60;

async function fetchPage(
  query: string,
  start: number,
  display: number,
  clientId: string,
  clientSecret: string,
  retries = 3
): Promise<{ items: { postdate: string }[]; total: number } | null> {
  const url = new URL("https://openapi.naver.com/v1/search/blog.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("start", String(start));
  url.searchParams.set("sort", "date");

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
        console.error(`  429 rate limit, waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
}

function getCutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - RECENT_DAYS);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

async function fetchBlogCount(title: string, place: string): Promise<number | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET not set");
    process.exit(1);
  }

  const searchTitle = extractSearchTitle(title);
  const shortPlace = place ? place.split(" ")[0] : "";
  const query = buildQuery(searchTitle, shortPlace);
  const cutoff = getCutoffDate();

  let count = 0;
  let start = 1;
  const pageSize = 100;

  while (start <= 1000) {
    const data = await fetchPage(query, start, pageSize, clientId, clientSecret);
    if (!data || !data.items || data.items.length === 0) break;

    let allWithinRange = true;
    for (const item of data.items) {
      if (item.postdate >= cutoff) {
        count++;
      } else {
        allWithinRange = false;
        break;
      }
    }

    // If we found a post older than cutoff, no need to fetch more
    if (!allWithinRange) break;
    // If fewer items returned than requested, we've reached the end
    if (data.items.length < pageSize) break;

    start += pageSize;
    await sleep(100);
  }

  return count;
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
