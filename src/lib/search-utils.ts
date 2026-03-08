/**
 * Shared search utilities for extracting searchable titles and building
 * Naver blog search queries from exhibition data.
 */

/**
 * Extract the most searchable part of an exhibition title.
 * Strips brackets, common suffixes (개인전, 단체전, etc.), and splits on
 * subtitle separators to find the most meaningful fragment.
 *
 * e.g. "한국 근현대미술 : 붓으로 빚은 한국의 서정" → "붓으로 빚은 한국의 서정"
 * e.g. "《지구울림 - 헤르츠앤도우》" → "지구울림 - 헤르츠앤도우"
 */
export function extractSearchTitle(title: string): string {
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

/**
 * Build a Naver search query string. Wraps the title in quotes, and splits
 * mixed-language (Latin + Korean) titles into separate quoted segments.
 *
 * e.g. "Finnegans Wake 다니엘 보이드" → "Finnegans Wake" "다니엘 보이드"
 */
export function buildQuery(searchTitle: string, shortPlace: string): string {
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
