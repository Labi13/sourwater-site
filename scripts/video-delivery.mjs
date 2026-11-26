// Film files use byte-range delivery for playback and scroll seeking; other assets stay static.
import { FILM_BYTES } from './film-metadata.mjs';
import { FEED_URL, parseFeed, renderCarousel } from './essays-render.mjs';
// Exact sizes of the existing encoded Mermaid assets, verified against dist.
const VIDEO_BYTES = {
  '/assets/ai-content-film.mp4': FILM_BYTES,
  '/assets/mermaids-need-space-720.mp4': 14344809,
  '/assets/mermaids-need-space-1080.mp4': 25582422,
  '/assets/mermaids-need-space-2k.mp4': 24697919
};

// Substack feed, cached at the edge for one hour so new posts appear without a redeploy. Only / and /el/ use it.
// Any failure or an empty feed returns the page exactly as built, with the posts baked in at build time.
async function freshPosts() {
  try {
    const response = await fetch(FEED_URL, {cf: {cacheTtl: 3600, cacheEverything: true}, signal: AbortSignal.timeout(5000)});
    return response.ok ? parseFeed(await response.text()) : [];
  } catch { return []; }
}
async function homeWithFeed(request, env) {
  // Conditional headers are dropped so the page is always rebuilt from the built HTML plus the current feed.
  const headers = new Headers(request.headers);
  headers.delete('If-None-Match');
  headers.delete('If-Modified-Since');
  const response = await env.ASSETS.fetch(new Request(request, {headers}));
  if (!response.ok || !(response.headers.get('Content-Type') || '').includes('text/html')) return response;
  const posts = await freshPosts();
  if (!posts.length) return response;
  const out = new HTMLRewriter()
    .on('section[data-sw-feed="carousel"]', {element(el) {
      el.removeAttribute('hidden');
      el.setInnerContent(renderCarousel(posts, Number(el.getAttribute('data-count')) || 6, 'carousel', undefined, el.getAttribute('data-lang') || 'en'), {html: true});
    }})
    .transform(response);
  out.headers.delete('ETag');
  return out;
}
export default {
  async fetch(request, env) {
    const {pathname} = new URL(request.url);
    if (request.method === 'GET' && (pathname === '/' || pathname === '/el' || pathname === '/el/')) return homeWithFeed(request, env);
    const videoSize = VIDEO_BYTES[pathname];
    if (!videoSize || !['GET', 'HEAD'].includes(request.method)) {
      const asset = await env.ASSETS.fetch(request);
      if (['GET', 'HEAD'].includes(request.method) && asset.ok &&
          /\.(?:png|jpe?g|webp|gif|avif|svg|ico|css|js)$/.test(new URL(request.url).pathname)) {
        const headers = new Headers(asset.headers);
        headers.set('Cache-Control', 'public, max-age=604800');
        return new Response(asset.body, {status: asset.status, statusText: asset.statusText, headers});
      }
      return asset;
    }
    const source = await env.ASSETS.fetch(new Request(request.url, {method: request.method}));
    if (source.status !== 200) return source;
    const headers = new Headers(source.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');
    const range = request.headers.get('Range');
    // The ASSETS binding may omit Content-Length; the build verifies this size.
    const size = Number(headers.get('Content-Length')) || videoSize;
    headers.set('Content-Length', String(size));
    if (!range || request.method === 'HEAD' || !size ||
        (request.headers.has('If-Range') && request.headers.get('If-Range') !== headers.get('ETag'))) {
      return new Response(source.body, {status: 200, headers});
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = 0, end = size - 1;
    if (match && (match[1] || match[2])) {
      if (match[1]) {
        start = Number(match[1]);
        if (match[2]) end = Math.min(Number(match[2]), end);
      } else start = Math.max(0, size - Number(match[2]));
    }
    if (!match || (!match[1] && !match[2]) || start >= size || end < start ||
        (match[1] === '' && Number(match[2]) === 0)) {
      await source.body.cancel();
      return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes'}});
    }
    // Slice incrementally: never buffer the whole film in Worker memory.
    const reader = source.body.getReader();
    let position = 0;
    const body = new ReadableStream({
      async pull(controller) {
        try {
          while (true) {
            const {done, value} = await reader.read();
            if (done) {controller.close(); return;}
            const chunkStart = position;
            position += value.byteLength;
            if (position <= start) continue;
            const slice = value.subarray(Math.max(0, start - chunkStart), Math.min(value.byteLength, end + 1 - chunkStart));
            if (slice.byteLength) controller.enqueue(slice);
            if (position > end) {controller.close(); await reader.cancel();}
            return;
          }
        } catch (error) {controller.error(error); await reader.cancel().catch(() => {});}
      },
      cancel(reason) {return reader.cancel(reason);}
    });
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(body, {status: 206, headers});
  }
};
