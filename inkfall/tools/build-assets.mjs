// Asset pipeline: optimizes the concept art in assets/concept/ into game-ready
// files in assets/game/ and icons/. Run: npm run assets
//  - monuments: light background removed (border flood fill), trimmed, resized, WebP
//  - bg_grassland: resized + WebP; bg_biomes: cropped into 4 quadrants (desert, snow, volcano, night)
//  - icon.png: PWA / apple-touch icons in all sizes (falls back to a code-drawn icon)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cutoutMainSubject } from '../src/imageproc.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (n) => path.join(root, 'assets/concept', n);
const out = (n) => path.join(root, 'assets/game', n);
const icon = (n) => path.join(root, 'icons', n);
fs.mkdirSync(path.join(root, 'assets/game'), { recursive: true });
fs.mkdirSync(path.join(root, 'icons'), { recursive: true });
const has = (n) => fs.existsSync(src(n));
const kb = (f) => `${(fs.statSync(f).size / 1024).toFixed(0)} KB`;

async function removeBackground(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  cutoutMainSubject(data, info.width, info.height);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 });
}

async function monuments() {
  for (const name of ['monument_blue', 'monument_red']) {
    if (!has(name + '.png')) { console.log(`- ${name}.png missing, skipped (game uses code-drawn monument)`); continue; }
    const cut = await removeBackground(src(name + '.png'));
    const buf = await cut.png().toBuffer();
    const o = out(name + '.webp');
    await sharp(buf).resize({ height: 640, withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 90 }).toFile(o);
    console.log(`✓ ${name}.webp  ${kb(o)}`);
  }
}

async function backgrounds() {
  if (has('bg_grassland.png')) {
    const o = out('bg_grassland.webp');
    await sharp(src('bg_grassland.png')).resize({ height: 720, width: 1680, fit: 'cover' }).webp({ quality: 80 }).toFile(o);
    console.log(`✓ bg_grassland.webp  ${kb(o)}`);
  } else console.log('- bg_grassland.png missing, skipped');
  if (has('bg_biomes.png')) {
    const meta = await sharp(src('bg_biomes.png')).metadata();
    const qw = Math.floor(meta.width / 2), qh = Math.floor(meta.height / 2);
    const inset = Math.round(Math.min(qw, qh) * 0.008);
    const quads = { desert: [0, 0], snow: [1, 0], volcano: [0, 1], night: [1, 1] };
    for (const [biome, [qx, qy]] of Object.entries(quads)) {
      const o = out(`bg_${biome}.webp`);
      await sharp(src('bg_biomes.png'))
        .extract({ left: qx * qw + inset, top: qy * qh + inset, width: qw - inset * 2, height: qh - inset * 2 })
        .resize({ height: 720, width: 1680, fit: 'cover', kernel: 'lanczos3' })
        .webp({ quality: 80 }).toFile(o);
      console.log(`✓ bg_${biome}.webp  ${kb(o)}`);
    }
  } else console.log('- bg_biomes.png missing, skipped');
}

// Code-drawn fallback icon: ink warrior with a blue scarf on a radial burst.
const PLACEHOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><radialGradient id="g" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="#fff6d8"/><stop offset="0.55" stop-color="#ffd27a"/><stop offset="1" stop-color="#f08a24"/></radialGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <path d="M120 360c40-90 150-120 230-90 60 22 70 80 30 110-50 38-160 50-220 20-30-15-50-20-40-40z" fill="#2f7de1" opacity="0.9"/>
  <circle cx="390" cy="150" r="26" fill="#2f7de1"/><circle cx="110" cy="300" r="16" fill="#2f7de1"/>
  <g stroke="#121318" stroke-width="22" stroke-linecap="round" fill="none">
    <path d="M250 300 L300 200"/><path d="M250 300 L190 360 L160 420"/><path d="M250 300 L300 370 L350 400"/>
    <path d="M290 220 L230 230 L190 200"/><path d="M290 220 L350 190 L380 140"/>
  </g>
  <path d="M380 140 L440 40" stroke="#dfe7ee" stroke-width="16" stroke-linecap="round"/>
  <path d="M296 196 C250 180 200 200 150 170" stroke="#2f7de1" stroke-width="18" stroke-linecap="round" fill="none"/>
  <circle cx="315" cy="160" r="38" fill="#121318"/><circle cx="330" cy="152" r="7" fill="#fff"/>
</svg>`;

async function icons() {
  const base = has('icon.png') ? sharp(src('icon.png')) : sharp(Buffer.from(PLACEHOLDER_ICON));
  console.log(has('icon.png') ? '✓ using icon.png' : '- icon.png missing: generating code-drawn placeholder icons');
  const master = await base.resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
  const sizes = { 'favicon-32.png': 32, 'icon-120.png': 120, 'icon-152.png': 152, 'icon-167.png': 167, 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
  for (const [name, s] of Object.entries(sizes)) {
    // iOS icons must be opaque
    await sharp(master).resize(s, s).flatten({ background: '#101218' }).png({ compressionLevel: 9 }).toFile(icon(name));
  }
  // maskable: keep the art inside the 80% safe zone
  const inner = await sharp(master).resize(410, 410).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#101218' } })
    .composite([{ input: inner, left: 51, top: 51 }]).png({ compressionLevel: 9 }).toFile(icon('icon-maskable-512.png'));
  console.log('✓ icons/ (32, 120, 152, 167, 180, 192, 512, maskable 512)');
}

await monuments();
await backgrounds();
await icons();
// manifest lets the game request only files that exist (no 404 probing)
const files = fs.readdirSync(path.join(root, 'assets/game')).filter((f) => f.endsWith('.webp') || f.endsWith('.png'));
fs.writeFileSync(out('manifest.json'), JSON.stringify({ files }, null, 1));
console.log(`✓ assets/game/manifest.json (${files.length} files)`);
