import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "";
  const place = searchParams.get("place") || "";

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ items: [] });
  }

  const searchTitle = extractSearchTitle(title);
  const shortPlace = place ? place.split(" ")[0] : "";
  const query = buildQuery(searchTitle, shortPlace);

  const url = new URL("https://openapi.naver.com/v1/search/blog.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "5");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "sim");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });
    if (!res.ok) return NextResponse.json({ items: [] });

    const data = await res.json();
    const items = (data.items || []).map((item: Record<string, string>) => ({
      title: item.title?.replace(/<\/?b>/g, "") || "",
      link: item.link || "",
      description: item.description?.replace(/<\/?b>/g, "") || "",
      bloggername: item.bloggername || "",
      postdate: item.postdate || "",
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
