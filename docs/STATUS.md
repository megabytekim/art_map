# 무하한 - 프로젝트 진행 현황

## 완료된 작업 (2026-03-08)

### 핵심 기능
- [x] art-map.co.kr 크롤러 (Playwright + Kakao 지오코딩)
- [x] 네이버 블로그 인기도 (최근 60일 조회건수)
- [x] 지도 마커 클러스터링 (leaflet.markercluster)
- [x] 마감 임박 배지 (14일 이내)
- [x] 슬라이드업 카드 (접힘/펼침 2단 구조)
- [x] 네이버 블로그 상위글 표시 + 네이버 검색 링크
- [x] 대표 이미지 갤러리 (네이버 이미지검색, 최대 10장 가로 스크롤)

### 개선/리팩토링
- [x] ClusterLayer 성능 최적화 (마커 생성/아이콘 업데이트 분리)
- [x] 검색 유틸 코드 중복 제거 (`search-utils.ts`)
- [x] 전시 선택 시 마커 오프셋 센터링 (카드 위로)
- [x] 지도 타일 CARTO Voyager로 변경

## 남은 개선사항

### 중요
- [ ] 블로그 HTML 엔티티 디코딩 (`&amp;` → `&`)
- [ ] Legend ↔ SlideUpCard 모바일 겹침 해결
- [ ] blog-search API 캐싱/디바운스

### 선택
- [ ] 지도 타일 개선 (Vworld 등 한국 지도 검토)
- [ ] Map 에러 바운더리 추가
- [ ] slide-up 애니메이션 첫 등장만 재생
- [ ] `window.innerWidth` → CSS 미디어쿼리 기반 반응형
- [ ] @types/* devDependencies로 이동

## 기술 스택
- Next.js 16 / React 19 / Tailwind CSS 4
- react-leaflet 5 + leaflet.markercluster
- Vercel 무료플랜 배포

## 환경변수
- `KAKAO_REST_API_KEY` - 카카오 지오코딩
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` - 네이버 블로그/이미지 검색
