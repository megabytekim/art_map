import { NextRequest, NextResponse } from "next/server";
import { extractSearchTitle, buildQuery } from "@/lib/search-utils";

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
