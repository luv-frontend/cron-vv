const fetch = require("node-fetch");

const API_BASE = "https://phimapi.com/danh-sach/phim-moi-cap-nhat-v2";
const SITES = ["https://phimvivu.net/phim/", "https://phimvivu.net/xem-phim/"];

async function getTotalPage() {
  const res = await fetch(`${API_BASE}?limit=64`);
  const data = await res.json();
  return data?.pagination?.totalPages ?? 0;
}

async function getMovieFromPage(page) {
  const res = await fetch(`${API_BASE}?page=${page}&limit=64`);
  const data = await res.json();
  return data?.items || [];
}

async function warmCacheForMovie(movie) {
  const results = await Promise.allSettled(
    SITES.map((base, index) =>
      fetch(
        `${base}${movie.slug}${
          index === 1
            ? `vietsub/${
                movie.episode_current?.toLowerCase() === "full"
                  ? "full"
                  : "tap-01"
              }/`
            : ""
        }`,
        {
          method: "GET",
          headers: {
            "User-Agent": "CacheWarmerBot/1.0",
          },
        }
      )
    )
  );

  // Kiểm tra nếu bất kỳ response nào có cf-cache-status = HIT
  for (const res of results) {
    if (res.status === "fulfilled") {
      const status = res.value.headers.get("cf-cache-status");
      if (status === "HIT") return "HIT";
    }
  }

  return "noHit";
}

const summary = {
  total: 0,
  hit: 0,
  noHit: 0,
  error: 0,
};

(async () => {
  const MAX_PAGE = await getTotalPage();

  for (let page = 1; page <= MAX_PAGE; page++) {
    try {
      console.log(`📄 Fetching page ${page}`);
      const movies = await getMovieFromPage(page);
      summary.total += movies.length;

      await Promise.allSettled(
        movies.map(async (movie) => {
          try {
            const result = await warmCacheForMovie(movie);
            if (result === "HIT") summary.hit++;
            else summary.noHit++;
          } catch (err) {
            summary.error++;
            console.error(`❌ Error slug ${movie.slug}:`, err);
          }
        })
      );

      console.log(`\n🎯 Cache Summary`);
      console.log(`Total slugs: ${summary.total}`);
      console.log(`HIT: ${summary.hit}`);
      console.log(`noHit: ${summary.noHit}`);
      console.log(`Error: ${summary.error}`);
    } catch (err) {
      console.error(`❌ Error page ${page}`, err);
    }
  }
})();
