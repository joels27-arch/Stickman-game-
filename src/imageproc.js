// Pure RGBA image processing shared by the browser loader (src/assets.js) and
// the Node asset pipeline (tools/build-assets.mjs). No DOM, no dependencies.

// Remove a light, low-saturation backdrop: flood-fill from the border, keep only
// the main subject (concept sheets also carry titles, logos and small insets),
// then feather the cut edge. Mutates the alpha channel of `d` in place.
export function cutoutMainSubject(d, w, h) {
  let br = 0, bg = 0, bb = 0, n = 0;
  const sample = (x, y) => { const i = (y * w + x) * 4; br += d[i]; bg += d[i + 1]; bb += d[i + 2]; n++; };
  for (let x = 0; x < w; x += 4) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y += 4) { sample(0, y); sample(w - 1, y); }
  br /= n; bg /= n; bb /= n;
  const isBg = (p) => {
    const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const light = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b);
    const dist = Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb);
    return (dist < 70 && light > 150) || (light > 225 && sat < 28);
  };
  const mark = new Uint8Array(w * h); // 1 = background
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (mark[p] || !isBg(p)) continue;
    mark[p] = 1;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  keepMainComponent(mark, w, h);
  for (let p = 0; p < w * h; p++) {
    if (mark[p]) { d[p * 4 + 3] = 0; continue; }
    const x = p % w;
    let e = 0;
    if (x > 0 && mark[p - 1]) e++;
    if (x < w - 1 && mark[p + 1]) e++;
    if (p >= w && mark[p - w]) e++;
    if (p < w * (h - 1) && mark[p + w]) e++;
    if (e) d[p * 4 + 3] = Math.min(d[p * 4 + 3], 255 - e * 45);
  }
}

// Group foreground pixels into coarse cells, join cells that touch (which
// bridges hairline gaps between e.g. a tower and its banners), and mark every
// group except the largest as background.
function keepMainComponent(mark, w, h) {
  const cs = Math.max(3, Math.round(w / 110));
  const gw = Math.ceil(w / cs), gh = Math.ceil(h / cs);
  const count = new Int32Array(gw * gh);
  for (let y = 0; y < h; y++) {
    const row = ((y / cs) | 0) * gw;
    for (let x = 0; x < w; x++) if (!mark[y * w + x]) count[row + ((x / cs) | 0)]++;
  }
  const minFill = Math.max(2, (cs * cs) >> 3); // ignore cells with a few stray pixels
  const label = new Int32Array(gw * gh).fill(-1);
  const sizes = [];
  const q = [];
  for (let c = 0; c < gw * gh; c++) {
    if (label[c] !== -1 || count[c] < minFill) continue;
    const id = sizes.length;
    let size = 0;
    label[c] = id; q.length = 0; q.push(c);
    while (q.length) {
      const k = q.pop();
      size += count[k];
      const cx = k % gw, cy = (k / gw) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const nk = ny * gw + nx;
        if (label[nk] === -1 && count[nk] >= minFill) { label[nk] = id; q.push(nk); }
      }
    }
    sizes.push(size);
  }
  if (sizes.length < 2) return;
  let main = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;
  for (let y = 0; y < h; y++) {
    const row = ((y / cs) | 0) * gw;
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!mark[p] && label[row + ((x / cs) | 0)] !== main) mark[p] = 1;
    }
  }
}

// Find where a side-scroller background's flat ground strip begins: the first
// row (below 60% height) whose horizontal brightness variation drops well below
// the scenery above it and stays low. Returns a fraction of the height.
export function detectGroundLine(d, w, h) {
  const rows = [];
  for (let y = Math.floor(h * 0.6); y < h; y++) {
    let s = 0, s2 = 0, n = 0;
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      s += l; s2 += l * l; n++;
    }
    const m = s / n;
    rows.push({ y, sd: Math.sqrt(Math.max(0, s2 / n - m * m)) });
  }
  const top = rows.filter((r) => r.y < h * 0.7).map((r) => r.sd).sort((a, b) => a - b);
  const base = top[top.length >> 1] || 1;
  const step = Math.max(1, Math.round(h * 0.01));
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].y > h * 0.95) break;
    if (rows[i].sd >= base * 0.45) continue;
    let ok = true;
    for (let k = 1; k <= 4; k++) {
      const r = rows[i + k * step];
      if (!r || r.sd >= base * 0.55) { ok = false; break; }
    }
    if (ok) return Math.max(0.6, rows[i].y / h - 0.015); // keep the grass/snow lip
  }
  return 0.88;
}
