# ART MAP

서울 진행중 전시를 지도에서 확인하고, 네이버 블로그 인기도를 한눈에 파악할 수 있는 웹앱.

## 기술 스택

- **Next.js 16** (App Router) + TypeScript
- **Leaflet** + react-leaflet (지도)
- **Tailwind CSS v4** (스타일링)
- **Playwright** (전시 데이터 크롤링)
- **네이버 블로그 검색 API** (인기도 측정)

## 시작하기

```bash
# 의존성 설치
bun install

# Playwright 브라우저 설치 (최초 1회)
npx playwright install chromium

# 개발 서버
bun run dev
```

http://localhost:3000 에서 확인.

## 환경변수

`.env.local` 파일을 생성하고 아래 키를 설정:

```
NAVER_CLIENT_ID=<네이버 개발자 Client ID>
NAVER_CLIENT_SECRET=<네이버 개발자 Client Secret>
```

네이버 검색 API 키는 https://developers.naver.com/ 에서 발급.

## 데이터 갱신

전시 데이터(`src/lib/exhibitions-data.json`)는 빌드 시점에 고정됩니다. 갱신하려면 아래 스크립트를 실행:

```bash
# 전시 목록 재수집 + 블로그 건수 (art-map.co.kr 크롤링, ~5분)
source .env.local && export NAVER_CLIENT_ID NAVER_CLIENT_SECRET && npx tsx scripts/crawl-artmap.ts

# 블로그 건수만 갱신 (크롤링 없이 네이버 API만, ~30초)
source .env.local && export NAVER_CLIENT_ID NAVER_CLIENT_SECRET && npx tsx scripts/update-blog-counts.ts
```

## 인기도 기준

| 레벨 | 블로그 건수 | 색상 |
|------|-----------|------|
| 인기 높음 | 100+ | 빨강 |
| 보통 | 30-99 | 주황 |
| 관심 적음 | 10-29 | 노랑 |
| 거의 없음 | 0-9 | 회색 |

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    # 메인 페이지 (지도 + 목록)
│   └── api/exhibitions/route.ts    # 전시 데이터 API
├── components/
│   ├── Map.tsx                     # Leaflet 지도
│   ├── ExhibitionPanel.tsx         # 전시 목록 패널
│   └── Legend.tsx                  # 인기도 범례
└── lib/
    ├── types.ts                    # 타입 + 인기도 분류
    └── exhibitions-data.json       # 크롤링된 전시 데이터

scripts/
├── crawl-artmap.ts                 # art-map.co.kr 크롤러
├── crawl.ts                        # opengallery.co.kr 크롤러
└── update-blog-counts.ts           # 블로그 건수 갱신
```
