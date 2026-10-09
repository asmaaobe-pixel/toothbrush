function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=120" : "no-store"
    }
  });
}

function textOf(node) {
  if (!node || typeof node !== "object") return "";
  if (typeof node.simpleText === "string") return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((run) => run.text || "").join("");
  return "";
}

function collectVideos(node, out, seen, depth) {
  if (!node || typeof node !== "object" || depth > 14 || out.length >= 8) return;
  const video = node.videoRenderer || node.compactVideoRenderer;
  if (video && typeof video.videoId === "string" && /^[\w-]{11}$/.test(video.videoId) && !seen.has(video.videoId)) {
    const title = textOf(video.title).replace(/\s+/g, " ").trim();
    if (title) {
      seen.add(video.videoId);
      out.push({
        id: video.videoId,
        title,
        channel: textOf(video.ownerText).replace(/\s+/g, " ").trim(),
        length: textOf(video.lengthText).replace(/\s+/g, " ").trim()
      });
    }
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const value of values) collectVideos(value, out, seen, depth + 1);
}

async function searchYouTube(query) {
  const upstream = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0"
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20251001.00.00",
          hl: "en",
          gl: "US"
        }
      },
      query
    })
  });
  if (!upstream.ok) throw new Error("youtube");
  const data = await upstream.json();
  const videos = [];
  collectVideos(data, videos, new Set(), 0);
  return videos;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/youtube-search") {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "GET") return json({ error: "Search from this page." }, 405);
    const query = (url.searchParams.get("q") || "").trim().slice(0, 80);
    if (!query) return json({ videos: [] });
    try {
      return json({ videos: await searchYouTube(query) });
    } catch (e) {
      return json({ error: "Search could not load." }, 502);
    }
  }
};
