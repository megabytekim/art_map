// Crawl art-map.co.kr for ongoing exhibition data using Playwright
// Usage: npx tsx scripts/crawl-artmap.ts

import { chromium } from "playwright";

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
  imageUrl: string;
  blogCount: number | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractSearchTitle(title: string): string {
  let cleaned = title.replace(/[《》〈〉<>≪≫〔〕【】『』「」()]/g, " ").replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\s+(개인전|단체전|특별전|기획전|상설전|소장품전|회고전|초대전|귀국전)$/, "").trim();
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
        if (candidate.length <= 4) continue;
        cleaned = candidate;
        changed = true;
        break;
      }
    }
  }
  return cleaned;
}

function buildQuery(searchTitle: string, shortPlace: string): string {
  const hasLatin = /[a-zA-Z]{2,}/.test(searchTitle);
  const hasKorean = /[가-힣]{2,}/.test(searchTitle);

  let titlePart: string;
  if (hasLatin && hasKorean) {
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

async function geocodeAddress(address: string, retries = 2): Promise<{ lat: number; lng: number } | null> {
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) return null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
      url.searchParams.set("query", address);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
      });
      if (!res.ok) {
        await sleep(500);
        continue;
      }
      const data = await res.json();
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
      }
      return null;
    } catch {
      await sleep(500);
    }
  }
  return null;
}

async function geocodeKeyword(keyword: string, retries = 2): Promise<{ lat: number; lng: number } | null> {
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) return null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
      url.searchParams.set("query", keyword);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
      });
      if (!res.ok) {
        await sleep(500);
        continue;
      }
      const data = await res.json();
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
      }
      return null;
    } catch {
      await sleep(500);
    }
  }
  return null;
}

async function fetchImageUrl(title: string, place: string): Promise<string> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return "";

  const searchTitle = extractSearchTitle(title);
  const shortPlace = place ? place.split(" ")[0] : "";
  const query = buildQuery(searchTitle, shortPlace);

  try {
    const url = new URL("https://openapi.naver.com/v1/search/image.json");
    url.searchParams.set("query", query);
    url.searchParams.set("display", "1");
    url.searchParams.set("sort", "sim");

    const res = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });
    if (!res.ok) return "";
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].thumbnail || "";
    }
  } catch {
    // ignore
  }
  return "";
}

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
        await sleep(1000 * (attempt + 1));
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
  if (!clientId || !clientSecret) return null;

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

    if (!allWithinRange) break;
    if (data.items.length < pageSize) break;

    start += pageSize;
    await sleep(100);
  }

  return count;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Load exhibition list with infinite scroll
  console.log("Loading exhibition list...");
  await page.goto("https://art-map.co.kr/exhibition/new_list.php?type=ing", {
    waitUntil: "networkidle",
  });

  // Scroll until no more items load
  let prevCount = 0;
  let count = 0;
  let scrolls = 0;
  do {
    prevCount = count;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    count = await page.evaluate(
      () => document.querySelectorAll('a[href*="view.php?idx="]').length
    );
    scrolls++;
    console.log(`  Scroll ${scrolls}: ${count} exhibitions`);
  } while (count > prevCount && scrolls < 50);

  // Extract exhibition list (idx + thumbnail only; title/place from detail page)
  const listItems = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="view.php?idx="]')];
    return links.map((a) => {
      const idx = a.getAttribute("href")?.match(/idx=(\d+)/)?.[1] || "";
      const img = a.querySelector("img");
      const thumbnail = img?.getAttribute("src") || "";
      return { idx, thumbnail };
    });
  });

  console.log(`\nFound ${listItems.length} ongoing exhibitions`);

  // 2. Visit each exhibition detail → extract address → geocode with Kakao
  const results: RawExhibition[] = [];
  const geocodeCache: Record<string, { lat: number; lng: number }> = {};

  const batchSize = 3;
  for (let i = 0; i < listItems.length; i += batchSize) {
    const batch = listItems.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const detailPage = await browser.newPage();
        try {
          await detailPage.goto(
            `https://art-map.co.kr/exhibition/view.php?idx=${item.idx}`,
            { waitUntil: "domcontentloaded", timeout: 15000 }
          );

          const detail = await detailPage.evaluate(() => {
            const pageTitle = document.title.replace(/\s*\([\d.\s-]+\)\s*$/, "").trim();

            const galleryLink = document.querySelector('a[href*="gallery/view.php?idx="]');
            const place = galleryLink?.textContent?.trim() || "";

            // Extract address from table row "주소 | ..."
            let address = "";
            const rows = [...document.querySelectorAll("tr")];
            for (const row of rows) {
              const th = row.querySelector("th");
              if (th?.textContent?.includes("주소")) {
                const td = row.querySelector("td");
                address = td?.textContent?.trim() || "";
                break;
              }
            }

            let startDate = "";
            let endDate = "";
            const cells = [...document.querySelectorAll("td")];
            for (const cell of cells) {
              const match = cell.textContent?.match(
                /(\d{4}\.\d{2}\.\d{2})\s*-\s*(\d{4}\.\d{2}\.\d{2})/
              );
              if (match) {
                startDate = match[1];
                endDate = match[2];
                break;
              }
            }

            return { title: pageTitle, place, address, startDate, endDate };
          });

          const startDate = detail.startDate.replace(/\./g, "-");
          const endDate = detail.endDate.replace(/\./g, "-");
          const placeName = detail.place.replace(/\/[^/]*$/, "").trim();
          const address = detail.address;

          // Geocode: address → Kakao address search → place name keyword search
          let lat = 0, lng = 0;
          const cacheKey = address || placeName;
          if (cacheKey && geocodeCache[cacheKey]) {
            lat = geocodeCache[cacheKey].lat;
            lng = geocodeCache[cacheKey].lng;
          } else {
            let coords: { lat: number; lng: number } | null = null;
            // 1st: try address geocoding
            if (address) coords = await geocodeAddress(address);
            // 2nd fallback: keyword search with place name
            if (!coords && placeName) coords = await geocodeKeyword(placeName);
            if (coords) {
              lat = coords.lat;
              lng = coords.lng;
              geocodeCache[cacheKey] = coords;
            }
          }

          return {
            id: item.idx,
            title: detail.title,
            place: placeName,
            address: address || placeName,
            lat,
            lng,
            startDate,
            endDate,
            thumbnail: item.thumbnail
              ? item.thumbnail.startsWith("http")
                ? item.thumbnail
                : `https://art-map.co.kr${item.thumbnail}`
              : "",
            imageUrl: "",
            blogCount: null,
          } as RawExhibition;
        } catch (e) {
          console.error(`  Failed: idx=${item.idx}`, (e as Error).message);
          return null;
        } finally {
          await detailPage.close();
        }
      })
    );

    for (const r of batchResults) {
      if (r) results.push(r);
    }
    console.log(`Progress: ${Math.min(i + batchSize, listItems.length)}/${listItems.length}`);
  }

  await browser.close();

  // 3. Fetch blog counts + image URLs from Naver API (sequential to avoid 429)
  console.log("\nFetching blog counts + images...");
  for (let i = 0; i < results.length; i++) {
    const [blogCount, imageUrl] = await Promise.all([
      fetchBlogCount(results[i].title, results[i].place),
      fetchImageUrl(results[i].title, results[i].place),
    ]);
    results[i].blogCount = blogCount;
    results[i].imageUrl = imageUrl;
    if ((i + 1) % 10 === 0 || i === results.length - 1) {
      console.log(`  Progress: ${i + 1}/${results.length}`);
    }
    await sleep(100);
  }

  // Filter: only with GPS coordinates
  const withCoords = results.filter((r) => r.lat !== 0 && r.lng !== 0);
  const withoutCoords = results.filter((r) => r.lat === 0 || r.lng === 0);

  console.log(
    `\nResults: ${withCoords.length} with GPS, ${withoutCoords.length} without GPS`
  );

  if (withoutCoords.length > 0) {
    console.log("\nWithout GPS:");
    withoutCoords.forEach((e) => console.log(`  - ${e.title} @ ${e.place}`));
  }

  // Write to JSON
  const fs = await import("fs");
  const outputPath = new URL(
    "../src/lib/exhibitions-data.json",
    import.meta.url
  );
  fs.writeFileSync(outputPath, JSON.stringify(withCoords, null, 2), "utf-8");
  console.log(
    `\nSaved ${withCoords.length} exhibitions to src/lib/exhibitions-data.json`
  );
}

main();
