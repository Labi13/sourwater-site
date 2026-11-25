// Build-time side of the Substack section: the "Latest from the SOURwater Substack" carousel is rendered into the static HTML
// from the live RSS feed on every build, falling back to essays.json only if the feed cannot be read.
import { readFile } from 'node:fs/promises';
import { FEED_URL, parseFeed, renderCarousel } from './essays-render.mjs';

export async function loadPosts(root) {
  try {
    const response = await fetch(FEED_URL, {signal: AbortSignal.timeout(10000)});
    if (response.ok) {
      const posts = parseFeed(await response.text());
      if (posts.length) return {posts, source: 'feed'};
    }
  } catch (e) { console.warn('WARNING: Substack feed unreachable (' + e.message + ').'); }
  console.warn('WARNING: using the stored essays.json copy; the carousel may be out of date.');
  try {
    const posts = JSON.parse(await readFile(new URL('essays.json', root), 'utf8')).posts;
    if (posts?.length) return {posts, source: 'essays.json'};
  } catch { /* nothing stored either */ }
  return {posts: [], source: 'none'};
}

// Homepage: fill the placeholder section; with no posts it stays hidden.
export function injectHome(html, posts, lang = 'en') {
  const re = new RegExp(`<section class="sw-latest" id="latest" data-sw-feed="carousel" data-count="6"${lang === 'el' ? ' data-lang="el"' : ''} hidden></section>`);
  if (!re.test(html)) throw new Error('Homepage carousel placeholder is missing.');
  if (!posts.length) return html;
  return html.replace(re, `<section class="sw-latest" id="latest" data-sw-feed="carousel" data-count="6"${lang === 'el' ? ' data-lang="el"' : ''} aria-label="${lang === 'el' ? 'Τελευταία από το SOURwater Substack' : 'Latest from the SOURwater Substack'}">${renderCarousel(posts, 6, 'carousel', undefined, lang)}</section>`);
}
