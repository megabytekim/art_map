import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  const place = request.nextUrl.searchParams.get("place");

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ total: null });
  }

  // 전시명은 OR (단어 나열), 갤러리명은 정확 매칭 (쌍따옴표)
  const query = place ? `${title} "${place}"` : title;

  const url = new URL("https://openapi.naver.com/v1/search/blog.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!res.ok) {
    return NextResponse.json({ total: null });
  }

  const data = await res.json();
  return NextResponse.json({ total: data.total ?? 0 });
}
