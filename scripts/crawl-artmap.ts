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

async function fetchBlogCount(title: string, place: string, retries = 3): Promise<number | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

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
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      return data.total ?? 0;
    } catch {
      return null;
    }
  }
  return null;
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

  // 2. Visit each exhibition detail → get gallery link → get GPS
  const results: RawExhibition[] = [];
  const galleryGpsCache: Record<string, { lat: number; lng: number; address: string }> = {};

  const batchSize = 3;
  for (let i = 0; i < listItems.length; i += batchSize) {
    const batch = listItems.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const detailPage = await browser.newPage();
        try {
          // Visit exhibition detail to get all info
          await detailPage.goto(
            `https://art-map.co.kr/exhibition/view.php?idx=${item.idx}`,
            { waitUntil: "domcontentloaded", timeout: 15000 }
          );

          // Extract title, gallery link, place, dates all at once
          const detail = await detailPage.evaluate(() => {
            // Title from page title: "전시명 (2026.02.13 - 2026.03.28)"
            const pageTitle = document.title.replace(/\s*\([\d.\s-]+\)\s*$/, "").trim();

            // Gallery link and place name
            const galleryLink = document.querySelector('a[href*="gallery/view.php?idx="]');
            const galleryIdx = galleryLink?.getAttribute("href")?.match(/idx=(\d+)/)?.[1] || null;
            const place = galleryLink?.textContent?.trim() || "";

            // Dates from table cells
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

            return { title: pageTitle, place, galleryIdx, startDate, endDate };
          });

          const startDate = detail.startDate.replace(/\./g, "-");
          const endDate = detail.endDate.replace(/\./g, "-");

          // Get GPS from gallery page (with cache)
          let gps = { lat: 0, lng: 0, address: "" };
          if (detail.galleryIdx) {
            if (galleryGpsCache[detail.galleryIdx]) {
              gps = galleryGpsCache[detail.galleryIdx];
            } else {
              const galleryPage = await browser.newPage();
              try {
                await galleryPage.goto(
                  `https://art-map.co.kr/gallery/view.php?idx=${detail.galleryIdx}`,
                  { waitUntil: "domcontentloaded", timeout: 15000 }
                );
                const gpsData = await galleryPage.evaluate(() => {
                  const html = document.documentElement.innerHTML;
                  const match = html.match(
                    /initMap\("([^"]+)","([^"]+)","([^"]*?)","([^"]*?)"/
                  );
                  if (match) {
                    return {
                      lat: parseFloat(match[1]),
                      lng: parseFloat(match[2]),
                      address: match[4].trim(),
                    };
                  }
                  return { lat: 0, lng: 0, address: "" };
                });
                gps = gpsData;
                galleryGpsCache[detail.galleryIdx] = gps;
              } finally {
                await galleryPage.close();
              }
            }
          }

          // Clean place name (remove "/서울" etc.)
          const placeName = detail.place.replace(/\/[^/]*$/, "").trim();

          return {
            id: item.idx,
            title: detail.title,
            place: placeName,
            address: gps.address || placeName,
            lat: gps.lat,
            lng: gps.lng,
            startDate,
            endDate,
            thumbnail: item.thumbnail
              ? item.thumbnail.startsWith("http")
                ? item.thumbnail
                : `https://art-map.co.kr${item.thumbnail}`
              : "",
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

  // 3. Fetch blog counts from Naver API (sequential to avoid 429)
  console.log("\nFetching blog counts...");
  for (let i = 0; i < results.length; i++) {
    results[i].blogCount = await fetchBlogCount(results[i].title, results[i].place);
    if ((i + 1) % 10 === 0 || i === results.length - 1) {
      console.log(`  Blog counts: ${i + 1}/${results.length}`);
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
