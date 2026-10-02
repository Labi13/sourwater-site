// Only the new independent film uses this handler; other assets stay static.
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/assets/ai-content-film.mp4' ||
        !['GET', 'HEAD'].includes(request.method)) return env.ASSETS.fetch(request);
    const source = await env.ASSETS.fetch(new Request(request.url, {method: request.method}));
    if (source.status !== 200) return source;
    const headers = new Headers(source.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');
    const range = request.headers.get('Range');
    const size = Number(headers.get('Content-Length'));
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
