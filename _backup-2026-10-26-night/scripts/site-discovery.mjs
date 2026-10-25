import { writeFile } from 'node:fs/promises';

const origin = 'https://sourwater.space';
const clean = value => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
const visible = value => clean(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export async function buildDiscovery(pages, dist) {
  const graphs = pages.map(({ html, language }) => {
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!block) throw new Error(`Missing schema: ${language}`);
    const graph = JSON.parse(block[1])['@graph'];
    const ids = graph.map(node => node['@id']);
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate schema id: ${language}`);
    const org = graph.find(node => node['@type'] === 'ProfessionalService');
    const catalog = org.hasOfferCatalog.itemListElement;
    const fields = [...html.matchAll(/<fieldset class="reg-row">([\s\S]*?)<\/fieldset>/g)];
    if (fields.length !== 5 || catalog.length !== 5) throw new Error('Register/catalog must have 5 rows.');
    fields.forEach((field, row) => {
      const keys = [...field[1].matchAll(/<label class="reg-key">([\s\S]*?)<\/label>/g)];
      const offers = catalog[row].itemListElement;
      if (keys.length !== offers.length) throw new Error('Catalog key count differs.');
      keys.forEach((key, i) => {
        const name = visible(key[1].match(/<b>([\s\S]*?)<\/b>/)[1]);
        const description = visible(key[1].match(/<em class="reg-description">([\s\S]*?)<\/em>/)?.[1] || '');
        const service = offers[i].itemOffered;
        if (service.name !== name || (service.description || '') !== description) throw new Error(`Visible key/schema differs: ${name}`);
      });
    });
    const faq = graph.find(node => node['@type'] === 'FAQPage');
    const section = html.match(/<section class="site-faq"[\s\S]*?<\/section>/)[0];
    const questions = [...section.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)];
    if (questions.length !== 4 || faq.mainEntity.length !== 4) throw new Error('FAQ must have 4 questions.');
    questions.forEach((q, i) => {
      if (visible(q[1]) !== faq.mainEntity[i].name || visible(q[2]) !== faq.mainEntity[i].acceptedAnswer.text) throw new Error('Visible FAQ/schema differs.');
    });
    return { graph, language, url: `${origin}/${language === 'el' ? 'el/' : ''}` };
  });
  const lastmod = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const bots = ['*', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'Bingbot'];
  const robots = bots.map(bot => `User-agent: ${bot}\nAllow: /\n`).join('\n') + `\nSitemap: ${origin}/sitemap.xml\n`;
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';
  for (const page of graphs) {
    sitemap += `  <url>\n    <loc>${page.url}</loc>\n    <lastmod>${lastmod}</lastmod>\n`;
    for (const [lang, url] of [['en', `${origin}/`], ['el', `${origin}/el/`], ['x-default', `${origin}/`]]) {
      sitemap += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${url}" />\n`;
    }
    for (const film of page.graph.filter(node => node['@type'] === 'VideoObject')) {
      const seconds = Number(film.duration.match(/^PT(\d+)S$/)[1]);
      sitemap += `    <video:video>\n      <video:thumbnail_loc>${xml(film.thumbnailUrl)}</video:thumbnail_loc>\n      <video:title>${xml(film.name)}</video:title>\n      <video:description>${xml(film.description)}</video:description>\n      <video:content_loc>${xml(film.contentUrl)}</video:content_loc>\n      <video:duration>${seconds}</video:duration>\n    </video:video>\n`;
    }
    sitemap += '  </url>\n';
  }
  sitemap += '</urlset>\n';
  const en = graphs.find(page => page.language === 'en').graph;
  const org = en.find(node => node['@type'] === 'ProfessionalService');
  let llms = '# SOURwater\n\n> SOURwater is a branding studio in Athens and New York. We build brand systems, websites made for Google and AI search, social content engines and AI brand films.\n\n## Services\n\n';
  for (const row of org.hasOfferCatalog.itemListElement) {
    for (const offer of row.itemListElement) {
      const service = offer.itemOffered;
      llms += `- [${row.name} — ${service.name}](${origin}/#services)${service.description ? ': ' + service.description : ''}\n`;
    }
  }
  llms += '\n## Selected work\n\n';
  for (const work of en.filter(node => node['@type'] === 'CreativeWork')) {
    llms += `- [${work.name}](${work.url}): ${work.locationCreated.name}, ${work.locationCreated.address.addressCountry}. ${work.description} Work: ${work.keywords.join('; ')}.\n`;
  }
  llms += '\n## Films\n\n';
  for (const film of en.filter(node => node['@type'] === 'VideoObject')) {
    llms += `- [${film.name}](${origin}/#${film.duration === 'PT44S' ? 'mermaids-film' : 'ai-films'}): ${film.description}. [Video](${film.contentUrl}).\n`;
  }
  const app = en.find(node => node['@type'] === 'SoftwareApplication');
  llms += `\n## Katopsi (in development)\n\n- [Katopsi](${origin}/#katopsi): ${app.description} Working pilot on synthetic data.\n`;
  llms += `\n## Contact\n\n- [Email](mailto:${org.email}): ${org.email}\n- [Greece telephone](tel:+306971779530): +30 697 177 9530\n- [United States telephone](tel:+14243351142): +1 424 335 1142\n- [LinkedIn](${org.sameAs[0]})\n- [Instagram](${org.sameAs[1]})\n`;
  llms += `\n## Languages\n\n- [English](${origin}/)\n- [Ελληνικά](${origin}/el/)\n`;
  if (llms.split(/\s+/).length >= 2500) throw new Error('llms.txt exceeds requested word limit.');
  await Promise.all([writeFile(new URL('robots.txt', dist), robots), writeFile(new URL('sitemap.xml', dist), sitemap), writeFile(new URL('llms.txt', dist), llms)]);
  console.log(`Generated robots.txt, sitemap.xml and llms.txt; lastmod ${lastmod}.`);
}
