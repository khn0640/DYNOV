document.addEventListener("DOMContentLoaded", async () => {
  const RSS_URL = "https://dynovlab.tistory.com/rss";
  const API = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(RSS_URL);

  const $ = (id) => document.getElementById(id);
  const defaultThumb = "images/tistory-thumb.png";

  function extractThumbFromHtml(html = "") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");

      // 1) figure > span[data-url]
      const span = doc.querySelector('figure span[data-url]');
      if (span?.getAttribute('data-url')) {
        console.log("[thumb] via data-url:", span.getAttribute('data-url'));
        return span.getAttribute('data-url');
      }

      // 2) 첫 이미지의 srcset에서 가장 큰 항목
      const img = doc.querySelector("img");
      if (img) {
        const srcset = img.getAttribute("srcset");
        if (srcset) {
          const candidates = srcset.split(",")
            .map(s => s.trim().split(/\s+/)[0])
            .filter(Boolean);
          if (candidates.length) {
            console.log("[thumb] via srcset(last):", candidates[candidates.length - 1]);
            return candidates[candidates.length - 1];
          }
        }
        if (img.getAttribute("src")) {
          console.log("[thumb] via img[src]:", img.getAttribute("src"));
          return img.getAttribute("src");
        }
      }

      // 3) 정규식 백업
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m?.[1]) {
        console.log("[thumb] via regex:", m[1]);
        return m[1];
      }
    } catch(e) {
      console.warn("extractThumbFromHtml failed:", e);
    }
    return "";
  }

  try {
    const res = await fetch(API, { cache: "no-store" });
    const data = await res.json();
    console.log("[rss2json] raw:", data);

    if (!data.items?.length) throw new Error("No items");

    const latest = data.items[0];
    console.log("[latest item]:", latest);

    // 제목
    const cap = (latest.title || "제목 없음").trim();
    $("tistory-caption").textContent = cap.length > 20 ? cap.slice(0, 20) + "…" : cap;

    // 썸네일 결정
    let thumb = (latest.thumbnail || "").trim();
    console.log("[rss2json thumbnail]:", thumb || "(empty)");

    if (!thumb) {
      thumb = extractThumbFromHtml(latest.content || latest.description || "");
    }

    // 최종 반영
    $("tistory-thumb").src = thumb || defaultThumb;
    $("tistory-link").href = latest.link || "https://dynovlab.tistory.com/";

    console.log("[thumb final]:", $("tistory-thumb").src);
  } catch (err) {
    console.error("Tistory 최신글 불러오기 실패:", err);
    $("tistory-caption").textContent = "업데이트 실패";
  }
});
