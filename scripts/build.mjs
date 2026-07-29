import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);

const sourceAssets = [
  "ata-gap-cream.png",
  "ata-gap-pink.png",
  "banner-wim-clean.png",
  "favicon.png",
  "flaouer-couples-bonding.png",
  "flaouer-dance-story.png",
  "flaouer-performances-story.png",
  "flaouer-site-preview.png",
  "logo_aca-lockup-transparent.png",
  "logo_flaouer.png",
  "logo_mermaid.jpg",
  "logo_wdv.png",
  "logo_zeibekiko.png",
  "logo_zeibekiko_white.png",
  "mermaid-photo.jpg",
  "mermaid3.jpeg",
  "og-cover.png",
  "wdv-card-course.png",
  "wdv-ig-post.png",
  "zeibekiko-music.png"
];

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download ${url}: ${response.status}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

await rm(dist, { recursive: true, force: true });
await mkdir(new URL("assets/", dist), { recursive: true });
await mkdir(new URL("el/", dist), { recursive: true });

await copyFile(new URL("index.html", root), new URL("index.html", dist));
await copyFile(new URL("el/index.html", root), new URL("el/index.html", dist));

await Promise.all([
  ...sourceAssets.map((asset) =>
    download(
      `https://sourwater.space/assets/${asset}`,
      join(new URL("assets/", dist).pathname, asset)
    )
  ),
  download(
    "https://escapeshop-gr.labrakex.workers.dev/escape-shop-social.jpg",
    join(new URL("assets/", dist).pathname, "escape-shop-social.jpg")
  )
]);

const html = await readFile(new URL("index.html", dist), "utf8");
if (!html.includes("https://escapeshop-gr.labrakex.workers.dev/")) {
  throw new Error("Escape Shop portfolio link is missing from the production build.");
}

console.log(`Built Sourwater with ${sourceAssets.length + 1} local assets.`);
