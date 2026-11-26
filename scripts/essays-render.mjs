// Substack feed -> HTML for the homepage carousel. Nothing here invents text: titles, dates, images and excerpts come from the feed.
export const SUBSTACK = 'https://sourwaterspace.substack.com';
export const FEED_URL = SUBSTACK + '/feed';
export const utm = (campaign, href = SUBSTACK) =>
  href + (href.includes('?') ? '&' : '?') + 'utm_source=sourwater.space&utm_medium=site&utm_campaign=' + campaign;

const NAMED = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–'};
const decode = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cdata = s => (s || '').replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
const tag = (xml, name) => { const m = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>')); return m ? cdata(m[1]) : ''; };

// First paragraph of the post, as the feed exposes it (the free preview). Cut at a sentence end near 230 characters.
function excerptOf(content, description) {
  const p = (content.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
  let text = decode(p.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || decode(description).trim();
  if (text.length > 240) {
    const cut = text.slice(0, 240), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    text = end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
  }
  return text;
}

export function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const content = tag(it, 'content:encoded');
    const enclosure = (it.match(/<enclosure[^>]*\surl="([^"]+)"/) || [])[1] || '';
    const date = new Date(tag(it, 'pubDate'));
    return {
      title: decode(tag(it, 'title')).trim(),
      url: tag(it, 'link').trim(),
      date: isNaN(date) ? '' : date.toISOString().slice(0, 10),
      image: enclosure,
      excerpt: excerptOf(content, tag(it, 'description')),
      // The feed has no explicit flag. A post is marked paid only when its preview itself says so.
      paid: /paywall|for paid subscribers|paid subscribers only/i.test(content)
    };
  }).filter(p => p.title && /^https:\/\/sourwaterspace\.substack\.com\//.test(p.url));
}

export const LABELS = {
  en: {heading: 'Latest from the SOURwater Substack', read: 'Read on Substack ↗', prev: 'Previous posts', next: 'Next posts', locale: 'en-US', note: ''},
  el: {heading: 'Τελευταία από το SOURwater Substack', read: 'Διάβασε στο Substack ↗', prev: 'Προηγούμενα', next: 'Επόμενα', locale: 'el-GR', note: 'Τα άρθρα δημοσιεύονται στα αγγλικά.'}
};
const fmt = (iso, locale = 'en-US') => iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString(locale, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}) : '';

function card(p, campaign, eager, L, locale) {
  const cover = p.image
    ? `<img src="${esc(p.image)}" alt="" width="1200" height="800" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`
    : `<span class="sw-card-plain serif">${esc(p.title)}</span>`;
  return `<li class="sw-card"><a href="${esc(utm(campaign, p.url))}" target="_blank" rel="noopener">` +
    `<span class="sw-card-cover">${cover}</span>` +
    `<span class="sw-card-meta">${p.date ? `<time datetime="${p.date}">${fmt(p.date, locale)}</time>` : ''}${p.paid ? '<b class="sw-paid">Paid</b>' : ''}</span>` +
    `<span class="sw-card-title serif">${esc(p.title)}</span>` +
    `<span class="sw-card-excerpt">${esc(p.excerpt)}</span>` +
    `<span class="sw-card-link">${L.read}</span></a></li>`;
}

export function renderCarousel(posts, count, campaign = 'carousel', heading, lang = 'en') {
  const L = LABELS[lang] || LABELS.en;
  heading = heading || L.heading;
  const list = posts.slice(0, count);
  if (!list.length) return '';
  return `<div class="wrap"><h2 class="disp sw-latest-h" id="sw-latest-h">${esc(heading)}</h2>` +
    `<div class="sw-car" role="region" aria-roledescription="carousel" aria-labelledby="sw-latest-h" data-count="${list.length}">` +
    `<div class="sw-car-bar"><button type="button" class="sw-car-btn" data-dir="-1" aria-label="${L.prev}">←</button>` +
    `<button type="button" class="sw-car-btn" data-dir="1" aria-label="${L.next}">→</button></div>` +
    `<ul class="sw-car-track">${list.map((p, i) => card(p, campaign, i < 3, L, L.locale)).join('')}</ul></div>${L.note ? `<p class="sw-car-note">${esc(L.note)}</p>` : ''}</div>`;
}

export function renderList(posts) {
  if (!posts.length) return '';
  return `<ul class="sw-list">${posts.map(p => `<li class="sw-entry"><time datetime="${p.date}">${fmt(p.date)}</time>` +
    `<h2 class="serif"><a href="${esc(utm('essays', p.url))}" target="_blank" rel="noopener">${esc(p.title)}</a>${p.paid ? ' <b class="sw-paid">Paid</b>' : ''}</h2>` +
    `<p>${esc(p.excerpt)}</p><a class="sw-card-link" href="${esc(utm('essays', p.url))}" target="_blank" rel="noopener">Read on Substack ↗</a></li>`).join('')}</ul>`;
}

export function itemListLd(posts) {
  const graph = {'@context': 'https://schema.org', '@type': 'CollectionPage', '@id': 'https://sourwater.space/essays#page', url: 'https://sourwater.space/essays',
    name: 'Essays | SOURwater', isPartOf: {'@id': 'https://sourwater.space/#website'}, publisher: {'@id': 'https://sourwater.space/#org'},
    mainEntity: {'@type': 'ItemList', itemListElement: posts.map((p, i) => ({'@type': 'ListItem', position: i + 1, url: p.url,
      item: {'@type': 'Article', headline: p.title, datePublished: p.date, url: p.url, mainEntityOfPage: p.url, description: p.excerpt,
        ...(p.image ? {image: p.image} : {}), author: {'@type': 'Person', name: 'Lampros Filippou'}, publisher: {'@id': 'https://sourwater.space/#org'}}}))}};
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}
