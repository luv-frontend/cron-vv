const fetch = require("node-fetch");

const API_BASE = "https://phimapi.com/danh-sach/phim-moi-cap-nhat-v2";
const YOUR_SITE = "https://phimvivu.net/phim/";

async function getTotalPage() {
  const res = await fetch(`${API_BASE}?limit=64`);
  const data = await res.json();
  return data?.pagination?.totalPages ?? 0;
}

async function getSlugsFromPage(page) {
  const res = await fetch(`${API_BASE}?page=${page}&limit=64`);
  const data = await res.json();
  const movies = data?.items || [];
  if (movies.length === 0) return [];
  return movies.map((movie) => movie.slug);
}

async function warmCacheForSlug(slug) {
  const res = await fetch(`${YOUR_SITE}${slug}`, {
    method: "GET",
    headers: {
      "User-Agent": "CacheWarmerBot/1.0",
    },
  });
  return res.headers.get("cf-cache-status");
}

const summary = {
  total: 0,
  hit: 0,
  miss: 0,
  expired: 0,
  stale: 0,
  error: 0,
};

(async () => {
  const MAX_PAGE = await getTotalPage();

  for (let page = 1; page <= MAX_PAGE; page++) {
    try {
      console.log(`📄 Fetching page ${page}`);
      const slugs = await getSlugsFromPage(page);
      summary.total += slugs.length;

      await Promise.allSettled(
        slugs.map(async (slug) => {
          try {
            const status = await warmCacheForSlug(slug);

            if (status === "HIT") summary.hit++;
            else if (status === "MISS") summary.miss++;
            else if (status === "EXPIRED") summary.expired++;
            else if (status === "STALE") summary.stale++;
            else summary.miss++; // default fallback
          } catch (err) {
            summary.error++;
            console.error(`❌ Error slug ${slug}:`, err);
          }
        })
      );

      console.log(`\n🎯 Cache Summary`);
      console.log(`Total slugs: ${summary.total}`);
      console.log(`HIT: ${summary.hit}`);
      console.log(`MISS: ${summary.miss}`);
      console.log(`EXPIRED: ${summary.expired}`);
      console.log(`STALE: ${summary.stale}`);
      console.log(`Error: ${summary.error}`);
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`❌ Error page ${page}`, err);
    }
  }
})();
