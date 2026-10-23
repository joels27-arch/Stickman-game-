// Browser end-to-end test with Playwright (headless Chromium, SwiftShader WebGL).
// Two isolated browser contexts act as two devices: one creates a party through
// the real UI, the other joins with the code, both play the same match.
//
//   npm run build && node tests/e2e.mjs            (starts its own server)
//   BASE=https://your-deploy node tests/e2e.mjs    (against a deployment)

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const PORT = 9300 + Math.floor(Math.random() * 300);
const BASE = process.env.BASE ?? `http://127.0.0.1:${PORT}`;
const OUT = 'test-results';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null;
if (!process.env.BASE) {
  server = spawn('node', ['dist/server/node-main.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: 'scratch/e2edb' }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/api/health'); break; } catch { await sleep(150); } }
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function device(name, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    // The deliberate wrong-code lookup returns 404; that is the expected response, not a page error.
    if (m.type() === 'error' && !(m.text().includes('404') && m.location().url.includes('/api/rooms/'))) errors.push(`${name}: ${m.text()} @ ${m.location().url}`);
  });
  await page.goto(BASE + '/');
  await page.waitForSelector('text=PLAY', { timeout: 30000 });
  return { ctx, page };
}

try {
  // ---------------------------------------------------------------- menus (desktop)
  const A = await device('A', { viewport: { width: 1280, height: 720 } });
  const pa = A.page;
  await sleep(1500);
  check('menu shows the server as online', await pa.locator('.server-status .dot.on').isVisible());
  await pa.screenshot({ path: `${OUT}/01-menu.png`, timeout: 120000 });
  for (const [btn, expect] of [['Locker', 'Equip'], ['Shop', 'SHOP'], ['Stats', 'Rounds played']]) {
    await pa.getByRole('button', { name: btn }).first().click();
    const ok = await pa.locator(`text=${expect}`).first().isVisible({ timeout: 5000 }).catch(() => false);
    check(`menu button "${btn}" opens its screen`, ok);
    if (btn === 'Locker') await pa.screenshot({ path: `${OUT}/02-locker.png`, timeout: 120000 });
    const back = pa.getByRole('button', { name: /Back|✕/ }).first();
    if (await back.isVisible().catch(() => false)) await back.click(); else await pa.keyboard.press('Escape');
    await sleep(400);
  }
  await pa.getByTitle('Settings').click();
  check('settings opens', await pa.locator('text=Graphics').isVisible());
  await pa.getByRole('button', { name: '✕' }).first().click();

  // ---------------------------------------------------------------- party: create (A) + join (B on a phone)
  await pa.getByRole('button', { name: /PARTY/ }).click();
  await pa.getByRole('button', { name: /Create a room/ }).click();
  await pa.waitForSelector('.code-card .code');
  const code = (await pa.locator('.code-card .code').innerText()).trim();
  check('room created with a 6-character code', /^[A-Z0-9]{6}$/.test(code), code);

  const B = await device('B', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const pb = B.page;
  await pb.screenshot({ path: `${OUT}/03-phone-menu.png`, timeout: 120000 });
  // Invalid code first
  await pb.getByRole('button', { name: /PARTY/ }).tap();
  await pb.locator('.code-input input').fill('ZZZZZZ');
  await pb.getByRole('button', { name: 'Join room' }).tap();
  check('joining a wrong code shows a friendly error', await pb.locator('text=Room not found').waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await pb.locator('.code-input input').fill(code);
  await pb.getByRole('button', { name: 'Join room' }).tap();
  await pb.waitForSelector('text=READY!');
  await sleep(800);
  const countA = await pa.locator('.prow').count();
  check('host sees 2 players in the lobby', countA === 2, `${countA}`);
  await pb.getByRole('button', { name: 'READY!' }).tap();
  await sleep(600);
  check('ready status reaches the host', (await pa.locator('.prow .tag.ready').count()) === 1);
  await pb.screenshot({ path: `${OUT}/04-phone-lobby.png`, timeout: 120000 });

  // Invite link opens the join dialog prefilled.
  const C = await device('C', { viewport: { width: 1000, height: 600 } });
  await C.page.goto(`${BASE}/?room=${code}`);
  await C.page.waitForSelector('.code-input input', { timeout: 15000 }).catch(() => {});
  await C.page.screenshot({ path: `${OUT}/04b-invite.png`, timeout: 120000 });
  const pre = await C.page.locator('.code-input input').inputValue({ timeout: 10000 }).catch(() => '');
  check('invite link pre-fills the room code', pre === code, pre);
  await C.ctx.close();

  // ---------------------------------------------------------------- play
  await pa.getByRole('button', { name: 'Single map' }).click();
  await pa.getByRole('button', { name: 'START' }).click();
  await pa.waitForSelector('.intro-card', { timeout: 15000 });
  check('round intro appears for the host', true);
  check('round intro appears for the phone', await pb.locator('.intro-card').waitFor({ timeout: 20000 }).then(() => true).catch(() => false));
  await pa.screenshot({ path: `${OUT}/05-intro.png`, timeout: 120000 });
  await sleep(7500); // intro + countdown
  check('touch controls visible on the phone', await pb.locator('.tbtn-jump').waitFor({ timeout: 15000 }).then(() => true).catch(() => false) && await pb.locator('.tbtn-dive').isVisible());
  // A runs with the keyboard; B runs with the on-screen joystick (synthetic touch drag).
  await pa.keyboard.down('KeyW');
  const posBefore = await pa.evaluate(() => { const s = window.__tumble.client.session; const t = [...s.remotes.values()][0]; return t ? { x: t.x, z: t.z } : null; });
  const cdp = await B.ctx.newCDPSession(pb);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await tp('touchStart', 150, 280); await tp('touchMove', 150, 230); await tp('touchMove', 150, 210);
  await sleep(2500);
  await pb.screenshot({ path: `${OUT}/06-phone-play.png`, timeout: 120000 });
  await pa.screenshot({ path: `${OUT}/07-desktop-play.png`, timeout: 120000 });
  const posAfter = await pa.evaluate(() => { const s = window.__tumble.client.session; const t = [...s.remotes.values()][0]; return t ? { x: t.x, z: t.z } : null; });
  const moved = posBefore && posAfter ? Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z) : 0;
  check('host sees the phone player move (joystick → server → host)', moved > 3, `${moved.toFixed(1)} m`);
  const meB = await pb.evaluate(() => { const s = window.__tumble.client.session; return { z: s.pred.z, others: s.remotes.size }; });
  check('phone player moved and sees the host', meB.z > 4 && meB.others === 1, JSON.stringify(meB));
  await tp('touchEnd', 0, 0);
  await pa.keyboard.up('KeyW');
  // Jump button
  const yBefore = await pb.evaluate(() => window.__tumble.client.session.pred.y);
  await pb.evaluate(() => { window.__ymax = -99; const s = window.__tumble.client.session; const t = setInterval(() => { window.__ymax = Math.max(window.__ymax, s.pred.y); }, 30); setTimeout(() => clearInterval(t), 2500); });
  await pb.locator('.tbtn-jump').tap();
  await sleep(2600);
  const yAfter = await pb.evaluate(() => window.__ymax);
  check('JUMP button jumps', yAfter > yBefore + 0.8, `peak ${yBefore.toFixed(2)} → ${yAfter.toFixed(2)}`);
  // Pause → leave from the phone; host keeps playing.
  await pb.locator('button[aria-label=Pause]').tap();
  await pb.getByRole('button', { name: 'Leave match' }).tap();
  await pb.waitForSelector('text=PLAY', { timeout: 10000 });
  check('leaving mid-match returns to the menu', true);
  const eliminatedOnHost = await pa.waitForFunction(() => window.__tumble.client.session?.eliminatedIds.size >= 1 || document.querySelector('.results'), null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('host is told the phone player left', eliminatedOnHost);
} catch (e) {
  check('e2e flow completed without exceptions', false, e.message);
} finally {
  check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
  server?.kill();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
