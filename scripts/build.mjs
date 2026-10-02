import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { FILM_BYTES } from "./video-delivery.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);
const distAssets = fileURLToPath(new URL("assets/", dist));
if ((await stat(new URL("media/ai-content-film.mp4", root))).size !== FILM_BYTES) {
  throw new Error("Update the independent film byte size before publishing its replacement.");
}
const localAssets = [
  ["media/ai-content-film.mp4", "ai-content-film.mp4"],
  ["media/ai-content-film-poster.jpg", "ai-content-film-poster.jpg"],
  ["scripts/ai-film-player.js", "ai-film-player.js"],
  ["styles/ai-films.css", "ai-films.css"]
];

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

const authoredAssets = [
  ["mermaids-need-space-poster-jpg-", "mermaids-need-space-poster.jpg"],
  ["mermaids-need-space-web-mp4-", "mermaids-need-space-web.mp4"],
  ["mermaids-need-space-720-mp4-", "mermaids-need-space-720.mp4"],
  ["mermaids-need-space-1080-mp4-", "mermaids-need-space-1080.mp4"],
  ["mermaids-need-space-2k-mp4-", "mermaids-need-space-2k.mp4"]
];

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download ${url}: ${response.status}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function decodeAuthoredAsset(prefix, filename) {
  const partsDirectory = new URL("../asset-parts/", import.meta.url);
  const partNames = (await readdir(partsDirectory))
    .filter((name) => name.startsWith(prefix) && name.endsWith(".b64"))
    .sort();
  if (!partNames.length) {
    throw new Error(`Missing encoded source for ${filename}`);
  }
  const encodedParts = await Promise.all(
    partNames.map((name) => readFile(new URL(name, partsDirectory), "utf8"))
  );
  await writeFile(
    join(distAssets, filename),
    Buffer.from(encodedParts.join(""), "base64")
  );
}

await rm(dist, { recursive: true, force: true });
await mkdir(new URL("assets/", dist), { recursive: true });
await mkdir(new URL("el/", dist), { recursive: true });

await copyFile(new URL("index.html", root), new URL("index.html", dist));
await copyFile(new URL("el/index.html", root), new URL("el/index.html", dist));
await Promise.all(localAssets.map(([source, filename]) =>
  copyFile(new URL(source, root), join(distAssets, filename))
));
await Promise.all(
  authoredAssets.map(([prefix, filename]) => decodeAuthoredAsset(prefix, filename))
);
await Promise.all([
  ...sourceAssets.map((asset) =>
    download(
      `https://sourwater.space/assets/${asset}`,
      join(distAssets, asset)
    )
  ),
  download(
    "https://sourwater.space/assets/escape-shop-social.jpg",
    join(distAssets, "escape-shop-social.jpg")
  )
]);

const html = await readFile(new URL("index.html", dist), "utf8");
if (!html.includes("https://escapeshop-gr.labrakex.workers.dev/")) {
  throw new Error("Escape Shop portfolio link is missing from the production build.");
}

console.log(`Built Sourwater with ${sourceAssets.length + authoredAssets.length + localAssets.length + 1} local assets.`);
