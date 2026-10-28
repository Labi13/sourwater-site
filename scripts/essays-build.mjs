// Build-time side of the Substack presence: the /essays page and the homepage carousel are rendered into the static HTML
// from the live feed, falling back to essays.json. The Worker (video-delivery.mjs) refreshes the same slots hourly.
import { readFile } from 'node:fs/promises';
import { FEED_URL, SUBSTACK, parseFeed, renderCarousel, renderList, itemListLd, utm, esc } from './essays-render.mjs';

export async function loadPosts(root) {
  try {
    const response = await fetch(FEED_URL, {signal: AbortSignal.timeout(10000)});
    if (response.ok) {
      const posts = parseFeed(await response.text());
      if (posts.length) return {posts, source: 'feed'};
    }
  } catch { /* fall through to the stored copy */ }
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

const CSS = `:root{--sand:#EFE6D5;--paper:#F5F0E4;--ink:#241F1A;--soft:#7C7160;--terra:#C15C34}
*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth;overflow-x:hidden;max-width:100%}
body{background:var(--sand);color:var(--ink);font-family:'Space Grotesk','Helvetica Neue',Arial,sans-serif;line-height:1.55;overflow-x:hidden;max-width:100%}
.serif{font-family:'Fraunces',Georgia,serif}.wrap{max-width:1200px;margin:0 auto;padding:0 44px}.disp{font-family:'Fraunces',Georgia,serif;font-weight:600;line-height:.94;letter-spacing:-.015em}
nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;justify-content:space-between;align-items:center;padding:16px 30px;background:rgba(239,230,213,.92);backdrop-filter:blur(8px)}
nav .brand{font-family:'Fraunces';font-weight:600;letter-spacing:.02em;font-size:17px}nav .brand em{font-style:italic;font-weight:300;color:#A84B28}
nav .links a{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);text-decoration:none;margin-left:18px;border-bottom:1px solid transparent;padding-bottom:2px}
nav .links a:hover,nav .links a[aria-current]{border-color:var(--terra)}
footer{padding:120px 0;text-align:center;background:var(--ink);color:#EFE6D5}footer h2{font-size:clamp(38px,6vw,84px);color:#fff}
footer .contact{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:38px}
footer .contact a{display:inline-block;text-decoration:none;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);background:#DA9A28;padding:14px 26px;border-radius:40px;font-weight:600}
footer .contact a.ghost{background:transparent;color:#EFE6D5;border:1px solid rgba(239,230,213,.4)}
footer .studioline{margin-top:34px;letter-spacing:.4em;font-size:12px;text-transform:uppercase;color:#DA9A28}
@media(max-width:700px){.wrap{padding:0 16px}footer{padding:80px 0}}`;

export const NAV = (esc_, lang = 'en') => `<nav>
  <a class="brand serif" href="${lang === 'el' ? '/el/' : '/'}" style="text-decoration:none;color:inherit">SOUR<em>water</em></a>
  <div class="links">
    <a href="/essays"${esc_ ? ' aria-current="page"' : ''}>Essays</a>
    <a class="sw-nav-contact" href="https://wa.me/14243351142">WhatsApp</a>
    <a class="sw-nav-contact" href="tel:+306971779530">Call</a>
    <a class="sw-nav-contact" href="mailto:hello@sourwater.space">Email</a>
    <details class="sw-more"><summary>Contact</summary><div><a href="https://wa.me/14243351142">WhatsApp</a><a href="tel:+306971779530">Call</a><a href="mailto:hello@sourwater.space">Email</a></div></details>
    <a href="/el/" hreflang="el" lang="el">ΕΛ</a>
  </div>
  <a class="sw-sub-btn" href="${esc(utm('nav'))}" target="_blank" rel="noopener">Substack</a>
</nav>`;

export const FOLLOW = `<div class="sw-follow">
    <p class="sw-follow-line">Essays on marketing, crowd psychology and AI, read through dramaturgy. <a href="${esc(utm('footer'))}" target="_blank" rel="noopener">Read on the SOURwater Substack</a></p>
    <div class="sw-follow-label">Follow SOURwater</div>
    <ul>
      <li><a href="https://www.linkedin.com/company/sourwater-space/" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
      <li><a href="https://www.instagram.com/sourwater.space/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
      <li><a href="${esc(utm('footer'))}" target="_blank" rel="noopener noreferrer">Subscribe on Substack</a></li>
    </ul>
  </div>`;

export function essaysPage(posts) {
  const top = posts.length ? `<section class="sw-latest" data-sw-feed="carousel" data-count="3" data-heading="Newest" aria-label="Newest on the SOURwater Substack">${renderCarousel(posts, 3, 'carousel', 'Newest')}</section>` : '';
  const list = posts.length
    ? `<h2 class="serif sw-all-h">All essays</h2><div data-sw-feed="list">${renderList(posts)}</div>`
    : `<p>No essays could be loaded right now. They are all on <a href="${esc(utm('essays'))}" target="_blank" rel="noopener">the SOURwater Substack</a>.</p>`;
  const sub = label => `<a class="sw-sub-link" href="${esc(utm('essays'))}" target="_blank" rel="noopener">${label}</a>`;
  const desc = 'Essays from the SOURwater studio on marketing, crowd psychology and AI, read through dramaturgy. Previews here, the full essays on Substack.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Essays | SOURwater</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="https://sourwater.space/essays">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website"><meta property="og:site_name" content="SOURwater"><meta property="og:title" content="Essays | SOURwater">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="https://sourwater.space/essays"><meta property="og:image" content="https://sourwater.space/assets/og-cover.png">
<meta name="theme-color" content="#241F1A">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
<link rel="stylesheet" href="/assets/substack.css?v=20261028">
<script type="application/ld+json" id="sw-essays-ld">${itemListLd(posts)}</script>
</head>
<body class="sw-essays-page">
${NAV(true)}
<main>
<div class="wrap sw-essays-head">
  <h1 class="disp">Essays</h1>
  <p>Essays on marketing, crowd psychology and AI, read through dramaturgy. A short preview of each is here. The full essays live on Substack.</p>
  ${sub('Subscribe on Substack')}
</div>
${top}
<div class="wrap">${list}
  <div class="sw-essays-foot">${sub('Subscribe on Substack')}</div>
</div>
</main>
<footer id="contact"><div class="wrap">
  <div class="serif footer-kick" style="font-style:italic;font-size:clamp(21px,2.8vw,32px);color:#DA9A28;margin-bottom:14px">Let&rsquo;s raise your mark.</div>
  <div class="contact">
    <a href="https://wa.me/14243351142">WhatsApp · +1 424 335 1142</a>
    <a class="ghost" href="tel:+306971779530">Call · +30 697 177 9530</a>
    <a class="ghost" href="mailto:hello@sourwater.space">hello@sourwater.space</a>
  </div>
  ${FOLLOW}
  <div class="studioline">SOURwater · Concepts for Culture &amp; Commerce</div>
</div></footer>
<script src="/assets/substack-ui.js" defer></script>
</body>
</html>
`;
}
