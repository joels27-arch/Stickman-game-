/* Neon Rush · the worlds of Inside the Brain, Candy Land, Volcano Bridge and Cloud City. */
import * as THREE from 'three';
import { U, FOG_GLSL, seeded } from './shared.js';
import { simpleSky, particles, fogCards, strips, geos, C } from './maps.js';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), K = new THREE.Color();

/* one instanced draw per material of a model, placed from a list of { x, y, z, s, ry, rx, c } */
function place(models, name, mats, list, parent, reflect){
  for (const g of geos(models, name)){
    if (mats[g.name] === null) continue;
    const im = new THREE.InstancedMesh(g.geometry, mats[g.name] || mats.default, list.length);
    list.forEach((l, i) => {
      Q.setFromEuler(E.set(l.rx || 0, l.ry || 0, l.rz || 0));
      S.set(l.sx || l.s, l.s, l.sz || l.s);
      M.compose(P.set(l.x, l.y, l.z), Q, S); im.setMatrixAt(i, M);
      if (l.c) im.setColorAt(i, K.copy(l.c));
    });
    im.frustumCulled = false; if (reflect) im.layers.enable(1);
    parent.add(im);
  }
}
const VS = `varying vec2 vUv; varying vec3 vP; varying vec3 vN; varying float vDepth; varying vec3 vRay; varying vec3 vWorld;
  void main(){
    vUv = uv; vP = position;
    #ifdef USE_INSTANCING
      mat4 m = modelMatrix*instanceMatrix; vN = mat3(m)*normal;
    #else
      mat4 m = modelMatrix; vN = mat3(m)*normal;
    #endif
    vec4 w = m*vec4(position, 1.); vWorld = w.xyz;
    vec4 mv = viewMatrix*w; vDepth = -mv.z; vRay = mv.xyz; gl_Position = projectionMatrix*mv;
  }`;
const FS_HEAD = `varying vec2 vUv; varying vec3 vP; varying vec3 vN; varying float vDepth; varying vec3 vRay; varying vec3 vWorld;
  uniform float uFogDensity, uTime; uniform vec3 uFogColor; ${FOG_GLSL}`;

/* ---------- Inside the Brain ---------- */
export function makeBrainWorld(scene, tPlate, models, noise){
  const group = new THREE.Group(), r = seeded(70);
  const sky = simpleSky(tPlate, .31, '(1.3 + 2.4*smoothstep(.55, 1., L))', {
    dir: [.012, .012], amt: .022, mask: 'smoothstep(.12, .42, uv.y)',
    post: `
      float beat = pow(.5 + .5*sin(uT*1.6), 6.);                         // the far light breathes like a heartbeat
      c *= 1. + beat*.7*smoothstep(.34, .0, distance(uv, vec2(.5, .36)));
      c *= 1. + .9*pow(.5 + .5*sin(uv.x*30. + uv.y*22. - uT*3.2), 8.)*smoothstep(.3, .9, max(c.b - c.r*.4, 0.));   // signals racing along the nerves`,
  });
  group.add(sky);

  const shared = { uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uTime: U.uTime, tNoise: { value: noise } };
  const tissue = new THREE.ShaderMaterial({
    toneMapped: false, side: THREE.DoubleSide, uniforms: shared, vertexShader: VS,
    fragmentShader: `${FS_HEAD}
      uniform sampler2D tNoise;
      void main(){
        vec3 N = normalize(vN), V = normalize(cameraPosition - vWorld);
        if (dot(N, V) < 0.) N = -N;
        float g = vUv.x, fold = smoothstep(.04, .6, g);
        vec2 w = vP.xz/vec2(160., 256.);
        float n1 = textureLod(tNoise, w, 3.).r, n2 = (textureLod(tNoise, w*.5, 3.).g - .5)*5. + .5;
        vec3 flesh = mix(vec3(.26, .13, .42), vec3(.76, .46, .72), g*g*(.65 + n2*.5));
        float light = .42 + .7*max(dot(N, normalize(vec3(0., .3, -1.))), 0.) + .3*max(N.y, 0.);
        vec3 c = mix(vec3(.018, .008, .04), flesh*light, fold);
        float F = pow(1. - max(dot(N, V), 0.), 3.);
        c += vec3(.46, .3, .85)*F*.55*fold;
        c += vec3(1., .75, 1.)*pow(max(dot(reflect(-V, N), normalize(vec3(.1, .5, -1.))), 0.), 34.)*.55*fold;   // wet tissue
        // light runs along the bottom of every fold, as in the picture
        float groove = smoothstep(.2, .03, g), pulse = pow(.5 + .5*sin(vP.z*.035 + vP.x*.05 + n1*9. - uTime*3.4), 6.);
        c += mix(vec3(.2, 1.4, 2.1), vec3(2., .4, 1.8), smoothstep(.42, .58, n2))*groove*(.22 + pulse*3.6);
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity*.7, vDepth, vRay), 1.);
      }`,
  });
  const walls = strips(geos(models, 'cortex')[0].geometry, tissue, 1024, 2, false);
  group.add(walls);

  const deco = new THREE.Group(), L = 512;
  const nerveMat = new THREE.ShaderMaterial({
    toneMapped: false, uniforms: shared, vertexShader: `varying vec3 vT;
      ${VS.replace('void main(){', 'void main(){ vT = instanceColor;')}`,
    fragmentShader: `${FS_HEAD} varying vec3 vT;
      void main(){
        float a = vUv.x, body = step(a, -.5);
        float ph = fract(vT.g*7. + vT.r*3.), run = pow(fract(a*1.5 - uTime*.95 + ph), 7.);
        vec3 c = vT*(.32 + run*4.2);
        vec3 N = normalize(vN), V = normalize(cameraPosition - vWorld);
        c = mix(c, vT*2.2 + vec3(1.5)*pow(max(dot(N, V), 0.), 2.)*(1. + .5*sin(uTime*2.4 + ph*6.3)), body);
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity*.55, vDepth, vRay), 1.);
      }`,
  });
  const cols = [C(.2, 1.2, 1.9), C(1.7, .35, 1.6), C(.9, .5, 2), C(.3, 1.6, 1.2)], cells = [], fibres = [], arches = [];
  for (let c = 0; c < 2; c++){
    for (let i = 0; i < 24; i++){
      const side = i % 2 ? 1 : -1, x = side*(30 + r()*r()*170), t = cols[Math.floor(r()*4)];
      cells.push({ x, y: 3 + r()*(9 + Math.abs(x)*.42), z: -r()*L - c*L + 40, s: 1.2 + r()*r()*2.6, ry: r()*6.28, rx: r()*1.5, c: t });
    }
    for (let i = 0; i < 4; i++) fibres.push({ x: (r() - .5)*5, y: 0, z: -i*L/4 - c*L - r()*40, s: .85 + r()*.3, ry: (r() - .5)*.5, c: cols[i % 4] });
    for (let i = 0; i < 2; i++) arches.push({ x: (r() - .5)*10, y: 0, z: -i*L/2 - c*L - 90, s: 1 + r()*.25, ry: (r() - .5)*.5 });
  }
  place(models, 'neuron', { default: nerveMat }, cells, deco);
  place(models, 'axon', { default: nerveMat }, fibres, deco, true);
  place(models, 'foldarch', { default: tissue }, arches, deco, true);
  group.add(deco);
  group.add(particles({ n: 260, range: 26, fall: -1.6, spread: 46, wobble: 1, w: .05, h: .05, color: C(1.2, .9, 2.2) }));
  group.add(fogCards({ n: 14, color: C(.26, .12, .42), alpha: .2, wide: 44, tall: 11, noise, spreadX: 34, minX: 12, y: 2 }));
  group.visible = false;
  scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); walls.position.z = dist % 1024; deco.position.z = dist % L; },
    flash(t){ const b = .5 + .5*Math.sin(t*1.6); return b*b*b*b*b*b*.16; } };
}

/* ---------- Candy Land ---------- */
export function makeCandyWorld(scene, tPlate, models, noise){
  const group = new THREE.Group(), r = seeded(88);
  const sky = simpleSky(tPlate, .33, '1.3', { dir: [.05, .004], amt: .025, mask: 'smoothstep(.36, .56, uv.y)' });
  group.add(sky);
  // rounded cake hills standing in the milk lake, each with a cap of icing dripping down its sides
  const cake = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .42, metalness: 0, envMapIntensity: 1.1 });
  const icing = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .16, metalness: 0, envMapIntensity: 1.35 });
  const H = 900, hills = new THREE.Group(), hillList = [], tops = [];
  const cakes = [C(1, .5, .66), C(.5, .9, .74), C(1, .8, .62), C(.78, .62, 1), C(1, .62, .55)], creams = [C(1, .98, .95), C(1, .98, .95), C(.32, .14, .06)];
  for (let c = 0; c < 2; c++) for (let i = 0; i < 30; i++){
    const side = i % 2 ? 1 : -1, s = 9 + r()*r()*34, x = side*(s + 16 + r()*r()*300);
    const l = { x, y: -1.4 - r()*s*.1, z: -r()*H - c*H + 60, s: s*1.15, sx: s*(1 + r()*.3), sz: s*(1 + r()*.3), ry: r()*6.28 };
    hillList.push({ ...l, c: cakes[Math.floor(r()*5)] }); tops.push({ ...l, c: creams[Math.floor(r()*3)] });
  }
  place(models, 'candyhill', { cake, icing: null }, hillList, hills, true);
  place(models, 'candyhill', { cake: null, icing }, tops, hills, true);
  group.add(hills);

  const sweet = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .2, metalness: 0, envMapIntensity: 1.25 });
  const sugar = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: 0, envMapIntensity: 1.1 });
  const L = 768, field = new THREE.Group(), tints = [C(1, .2, .35), C(.2, .85, .5), C(1, .75, .1), C(.55, .3, 1), C(.2, .6, 1)];
  const lay = (n, lo, hi, sLo, sHi, y, extra) => {
    const out = [];
    for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++){
      const side = i % 2 ? 1 : -1;
      out.push({ x: side*(lo + r()*r()*(hi - lo)), y, z: -r()*L - c*L + 40, s: sLo + r()*(sHi - sLo), ry: r()*6.28, ...(extra ? extra() : {}) });
    }
    return out;
  };
  place(models, 'lollipop', { default: sweet }, lay(11, 13, 80, 3.2, 6.8, -1, () => ({ ry: (r() - .5)*.7, rz: (r() - .5)*.16 })), field, true);
  place(models, 'gumdrop', { default: sugar }, lay(26, 13, 70, 1.6, 4.6, -.8, () => ({ c: tints[Math.floor(r()*5)] })), field);
  place(models, 'donut', { default: sweet }, lay(7, 26, 90, 3, 5.6, 4.6, () => ({ rx: Math.PI/2 - .3 + r()*.6, ry: (r() - .5)*.8 })), field, true);
  place(models, 'icecream', { default: sweet }, lay(8, 14, 90, 2.4, 5, -1.6), field, true);
  place(models, 'cupcake', { default: sweet }, lay(8, 13, 70, 2.2, 4.6, -.9), field, true);
  const canes = []; for (let i = 0; i < 8; i++) canes.push({ x: 0, y: -.2, z: -i*L/4 - 60, s: 1 });
  place(models, 'canearch', { default: sweet }, canes, field, true);
  group.add(field);
  group.add(particles({ n: 200, range: 18, fall: 1.1, spread: 40, wobble: 1.3, w: .09, h: .09, multi: true }));
  group.visible = false;
  scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); hills.position.z = dist % H; field.position.z = dist % L; } };
}

/* ---------- Volcano Bridge ---------- */
export function makeVolcanoWorld(scene, tPlate, models, noise){
  const group = new THREE.Group(), r = seeded(33);
  const sky = simpleSky(tPlate, .3, '(1.7 + 2.4*smoothstep(.4, .95, L))', {
    dir: [.03, .012], amt: .032, mask: 'smoothstep(.3, .46, uv.y)',
    post: `
      float crater = smoothstep(.2, .0, distance(uv*vec2(2.36, 1.), vec2(1.6, .46)));
      c *= 1. + crater*(.6 + .6*sin(uT*2.1 + sin(uT*.7)*3.));                // the crater throbs
      float strike = uT*.7, id = floor(strike);
      c += c*step(.84, fract(sin(id*53.1)*4375.))*exp(-fract(strike)*9.)*(.6 + .4*sin(uT*80.))*4.*smoothstep(.45, .7, uv.y);`,
  });
  group.add(sky);
  const rock = new THREE.ShaderMaterial({
    toneMapped: false, uniforms: { uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uTime: U.uTime }, vertexShader: VS,
    fragmentShader: `${FS_HEAD}
      void main(){
        vec3 N = normalize(vN), V = normalize(cameraPosition - vWorld);
        float id = 1. - vUv.y, up = max(N.y, 0.), h = vWorld.y;
        vec3 c = vec3(.016, .014, .017)*(.7 + id*.9) + vec3(.03)*up;
        float glow = exp(-max(h + 6., 0.)/4.5);
        c += vec3(1.1, .2, .02)*glow*(.3 + .5*(1. - up))*(.9 + .1*sin(uTime*2. + id*40.));                   // the lava lights everything from below
        c += vec3(.42, .08, .03)*pow(max(dot(N, normalize(vec3(0., .25, -1.))), 0.), 2.)*.4;                    // and the eruption from ahead
        c += vec3(.6, .16, .08)*pow(1. - max(dot(N, V), 0.), 4.)*.25;
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity*.6, vDepth, vRay), 1.);
      }`,
  });
  const iron = new THREE.MeshStandardMaterial({ color: 0x17151a, metalness: .85, roughness: .46, envMapIntensity: 1.3 });
  const hot = new THREE.MeshBasicMaterial({ color: C(4.6, 1.1, .12), toneMapped: false });
  const L = 768, land = new THREE.Group(), cols = [], tall = [];
  for (let c = 0; c < 2; c++){
    for (let i = 0; i < 34; i++){
      const side = i % 2 ? 1 : -1, s = .5 + r()*r()*2.8, x = side*(12.5 + s*9 + r()*r()*130);
      cols.push({ x, y: -6.5 - r()*5, z: -r()*L - c*L + 40, s, ry: r()*6.28 });
    }
    for (let i = 0; i < 9; i++){
      const side = i % 2 ? 1 : -1;
      tall.push({ x: side*(70 + r()*280), y: -7, z: -r()*L - c*L, s: .9 + r()*1.5, ry: r()*6.28 });
    }
  }
  place(models, 'basalt', { default: rock }, cols, land, true);
  place(models, 'spire', { default: rock }, tall, land, true);
  const bays = []; for (let i = 0; i < 6; i++) bays.push({ x: 0, y: 0, z: -i*256 + 20, s: 1 });
  place(models, 'susp', { iron, hotwire: hot }, bays, land, true);
  group.add(land);
  group.add(particles({ n: 480, range: 30, fall: -7.5, spread: 62, wobble: 1.5, w: .055, h: .055, color: C(5, 1.3, .16) }));
  group.add(fogCards({ n: 16, color: C(.13, .04, .03), alpha: .34, wide: 52, tall: 13, noise, spreadX: 34, minX: 11, y: 2 }));
  group.visible = false;
  scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); land.position.z = dist % L; },
    flash(t){ const s = t*.7, id = Math.floor(s), h = Math.sin(id*53.1)*4375; return (h - Math.floor(h)) > .84 ? Math.exp(-(s - id)*9)*.8 : 0; } };
}

/* ---------- Cloud City ---------- */
export function makeCloudWorld(scene, tPlate, models, noise){
  const group = new THREE.Group(), r = seeded(61);
  const sky = simpleSky(tPlate, .49, '(1.34 + 1.6*smoothstep(.8, 1., L))', {
    flow: '(uv - vec2(.5, .47))*vec2(.5, 1.)*smoothstep(.5, .36, uv.y)*.16 + vec2(.01, 0.)', amt: .03,
    post: 'c *= mix(vec3(1.34, 1.2, 1.06), vec3(1.22, 1.03, .84), smoothstep(.2, .5, uv.y));',    // warm the whole sky, and let the sea of cloud catch the low sun
  });
  group.add(sky);
  const marble = new THREE.MeshStandardMaterial({ color: 0xf2eadc, roughness: .34, metalness: .02, envMapIntensity: 1.2 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd2a452, roughness: .22, metalness: 1, envMapIntensity: 1.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8ec4e0, roughness: .08, metalness: .5, envMapIntensity: 1.6, emissive: C(.9, .55, .22), emissiveIntensity: .35 });
  const glow = new THREE.MeshBasicMaterial({ color: C(5, 3.1, 1.1), toneMapped: false });
  const mats = { marble, brass, skyglass: glass, skyglow: glow, default: marble };
  const L = 1600, city = new THREE.Group();
  const tower = (n, lo, hi) => { const a = []; for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++){ const side = i % 2 ? 1 : -1; a.push({ x: side*(lo + r()*r()*(hi - lo)), y: -22 + r()*44, z: -r()*L - c*L + 60, s: .55 + r()*.9, ry: r()*6.28 }); } return a; };
  place(models, 'skytower1', mats, tower(8, 62, 460), city, true);
  place(models, 'skytower2', mats, tower(9, 44, 420), city, true);
  const gates = new THREE.Group(), G = 480, arches = [];
  for (let i = 0; i < 6; i++) arches.push({ x: 0, y: -.02, z: -i*G/3 - 70, s: 1 });
  place(models, 'skyarch', mats, arches, gates, true);
  const ships = new THREE.Group(), fleet = [];
  for (let i = 0; i < 7; i++) fleet.push({ x: (i % 2 ? 1 : -1)*(90 + r()*300), y: 22 + r()*70, z: -r()*1200, s: 1.1 + r()*1.3, ry: (r() - .5)*.4 });
  place(models, 'airship', mats, fleet, ships);
  group.add(city, gates, ships);
  // billows sailing past below the road, lit from the sun ahead with a bright edge
  const puffMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, uniforms: { uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uTime: U.uTime }, vertexShader: VS,
    fragmentShader: `${FS_HEAD}
      void main(){
        vec3 N = normalize(vN), V = normalize(cameraPosition - vWorld), Sun = normalize(vec3(0., .22, -1.));
        float d = dot(N, Sun)*.5 + .5, top = N.y*.5 + .5, nv = max(dot(N, V), 0.);
        vec3 c = mix(vec3(.74, .52, .42), vec3(1.7, 1.34, 1.), smoothstep(.15, .95, top*.7 + d*.45));
        c += vec3(1.9, 1.15, .6)*pow(1. - nv, 2.2)*d*1.1;
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity*.7, vDepth, vRay), smoothstep(.04, .5, nv));
      }`,
  });
  const billows = new THREE.Group(), B = 900, heap = [];
  for (let c = 0; c < 2; c++) for (let i = 0; i < 26; i++){
    const side = i % 2 ? 1 : -1, s = .9 + r()*r()*3.2;
    heap.push({ x: side*(17 + s*13 + r()*r()*260), y: -17 - r()*22, z: -r()*B - c*B + 80, s, ry: r()*6.28 });
  }
  place(models, 'puff', { default: puffMat }, heap, billows);
  group.add(billows);
  group.add(particles({ n: 120, range: 22, fall: -.7, spread: 60, wobble: 1.4, w: .07, h: .07, color: C(2.4, 1.7, .9) }));
  group.visible = false;
  scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); city.position.z = dist % L; gates.position.z = dist % G; ships.position.z = (dist*.82 + t*5) % 1200 - 200; billows.position.z = dist % B; } };
}

/* ---------- Football Stadium ---------- */
const ARENA_B = 380, DRIFT = .42;      // the bowl slides along with the car, so 1.5 km of road crosses one real-sized stadium

function scrollerTexture(){
  const c = document.createElement('canvas'); c.width = 2048; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 128);
  g.font = 'italic 800 92px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textBaseline = 'middle';
  const words = [['NEON RUSH', '#36e4ff'], ['GREEN IS GOOD', '#3dff7a'], ['OVERDRIVE', '#ff3fa8'], ['RUN THE GATES', '#ffd764']];
  let x = 30; for (const [w, col] of words){ g.fillStyle = col; g.fillText(w, x, 68); x += g.measureText(w).width + 44; g.fillStyle = '#fff'; g.fillText('✦', x - 34, 66); x += 30; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/* every seat of the arena, matching tools/build_maps2.py: x, height, z and a random number per fan */
function arenaSeats(){
  const A = 36, B = ARENA_B, e = .4, N = 6000, th = new Float64Array(N + 1), cum = new Float64Array(N + 1);
  let px = 0, py = 0;
  for (let i = 0; i <= N; i++){
    const t = i/N*Math.PI*2, c = Math.cos(t), s = Math.sin(t), x = Math.sign(c)*Math.abs(c)**e*A, y = Math.sign(s)*Math.abs(s)**e*B;
    th[i] = t; cum[i] = i ? cum[i - 1] + Math.hypot(x - px, y - py) : 0; px = x; py = y;
  }
  const L = cum[N], count = Math.floor(L/.64), at = [];
  for (let k = 0, i = 0; k < count; k++){ const a = (k + .5)/count*L; while (cum[i + 1] < a) i++; at.push([th[i] + (th[i + 1] - th[i])*(a - cum[i])/(cum[i + 1] - cum[i]), Math.floor(a/(L/360))]); }
  const rows = [];
  for (let r = 0; r < 26; r++) rows.push([.85*r + .45, 2.8 + .64*r, r]);
  for (let r = 0; r < 32; r++) rows.push([26.3 + .85*r + .45, 25.84 + .86*r, 99]);
  const parts = Array.from({ length: 64 }, () => []), rnd = seeded(808);
  for (const [d, h, low] of rows) at.forEach(([t, j], k) => {
    if (j % 12 === 0 || (low >= 6 && low < 12 && (j % 36 === 17 || j % 36 === 18)) || rnd() < .05) return;   // aisles, tunnel mouths, a few empty seats
    const c = Math.cos(t), s = Math.sin(t);
    parts[Math.floor(k/count*64)].push(Math.sign(c)*Math.abs(c)**e*(A + d), h, -Math.sign(s)*Math.abs(s)**e*(B + d), rnd());
  });
  return parts.map(p => new Float32Array(p));                     // 64 stretches of stand, so the ones behind you or far away are skipped
}

export function makeArenaWorld(scene, tPlate, tCrowd, models, oldModels, pipe, tFans){
  const group = new THREE.Group(), CENTRE = -(ARENA_B - 30);
  const sky = simpleSky(tPlate, .05, '1.2', { dir: [.03, .002], amt: .006 });
  group.add(sky);
  const fog = { uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uTime: U.uTime };
  const crowd = new THREE.ShaderMaterial({
    toneMapped: false, side: THREE.DoubleSide, uniforms: { ...fog, tC: { value: tCrowd } }, vertexShader: VS,
    fragmentShader: `${FS_HEAD} uniform sampler2D tC;
      void main(){
        float row = (1. - vUv.y)*20.;
        float block = floor(vUv.x/3.) + floor(row/9.)*41.;
        float h = fract(sin(block*12.9898)*43758.5453);
        float hype = smoothstep(.6, .95, .5 + .5*sin(uTime*.4 + h*6.28));          // block by block the fans go wild
        vec2 uv = vUv*vec2(.25, .59);                                                  // one photo tile is 18 m wide and 17 rows tall
        uv.y += abs(sin(uTime*8. + h*20.))*.028*hype + sin(uTime*2.6 + vUv.x*9.)*.003;
        float pos = mod(vUv.x - uTime*3.4, 60.) - 30.;
        float wave = exp(-pos*pos/6.);                                                // the Mexican wave running round the bowl
        vec3 c = texture2D(tC, uv).rgb*(1.05 + wave*.8 + hype*.3);
        c *= mix(1.3, .62, smoothstep(6., 66., row));                                  // floodlit down low, in the roof's shade up high
        c *= mix(.5, 1., smoothstep(300., 380., vDepth));                              // close by, the seats behind the 3D fans sit in shadow
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity, vDepth, vRay), 1.);
      }`,
  });
  const ribbon = new THREE.ShaderMaterial({
    toneMapped: false, side: THREE.DoubleSide, uniforms: { ...fog, tT: { value: scrollerTexture() } }, vertexShader: VS,
    fragmentShader: `${FS_HEAD} uniform sampler2D tT;
      void main(){
        float y = fract((1. - vUv.y)*20.);
        float left = step(vWorld.x, 0.);
        vec3 t = texture2D(tT, vec2(mix(vUv.x, -vUv.x, left)/22. - uTime*.12, mix(1. - y, y, left))).rgb;   // the left stand sees the band from the other side
        vec2 g = fract(vec2(vUv.x*60., y*12.));
        float led = smoothstep(.5, .25, length(g - .5));
        vec3 c = (t*3.4 + vec3(.04, .06, .12))*(.5 + .7*led);
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity*.6, vDepth, vRay), 1.);
      }`,
  });
  const vip = new THREE.ShaderMaterial({
    toneMapped: false, side: THREE.DoubleSide, uniforms: fog, vertexShader: VS,
    fragmentShader: `${FS_HEAD}
      void main(){
        float pane = step(.08, fract(vUv.x*1.5))*step(.1, fract((1. - vUv.y)*20.));
        vec3 c = mix(vec3(.02, .025, .04), vec3(1.7, 1.25, .85)*(.8 + .3*fract(sin(floor(vUv.x*1.5)*7.1)*91.)), pane);
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity, vDepth, vRay), 1.);
      }`,
  });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x2c303a, metalness: .1, roughness: .8 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x14161e, metalness: .5, roughness: .5, side: THREE.DoubleSide });
  const mats = { crowd, seatback: crowd, ledband: ribbon, vipglass: vip, concrete, roof,
    roofglow: new THREE.MeshBasicMaterial({ color: C(2.2, 2.4, 2.8), toneMapped: false, side: THREE.DoubleSide }),
    tunnel: new THREE.MeshBasicMaterial({ color: C(.006, .008, .014), side: THREE.DoubleSide }),
    rib: new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: .75, roughness: .35 }) };
  const bowl = new THREE.Group();
  place(models, 'arena', mats, [{ x: 0, y: 0, z: CENTRE, s: 1 }], bowl);
  place(models, 'arenatruss', mats, [{ x: 0, y: 0, z: CENTRE, s: 1 }], bowl);

  // the fans: one card per seat, always turned to the camera, seated or up on their feet with arms in the air
  const card = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
  const fanMat = new THREE.ShaderMaterial({
    toneMapped: false, alphaToCoverage: true, uniforms: { ...fog, tF: { value: tFans } },
    vertexShader: `attribute vec4 aF; uniform float uTime; varying vec2 vUv; varying float vL; varying float vDepth; varying vec3 vRay; varying vec3 vT;
      void main(){
        vec3 base = aF.xyz; float s = aF.w;
        vec3 w = (modelMatrix*vec4(base, 1.)).xyz;
        float near = smoothstep(380., 300., distance(w, cameraPosition));             // far off, the stand's photo carries the crowd
        float block = floor(base.x/16.)*7. + floor(base.z/16.) + floor(base.y/14.)*31.;
        float h = fract(sin(block*12.9898)*43758.5453);
        float hype = smoothstep(.6, .95, .5 + .5*sin(uTime*.4 + h*6.28));           // the same blocks that bounce in the photo
        float lone = step(.94, fract(s*91.7 + floor(uTime*.6 + s*5.)*.37));          // and here and there one fan on their own
        float up = max(step(.45, hype), lone);
        float jump = abs(sin(uTime*7.5 + s*40.))*.32*hype;
        vec3 side = normalize(vec3(cameraPosition.z - w.z, 0., w.x - cameraPosition.x));
        vec3 p = base + (side*position.x*.84 + vec3(0., .12 + position.y*(1.78 + up*.48) + jump, 0.))*near;   // the card hugs the figure
        float v = floor(s*16.);
        vec2 inCell = vec2(.5 + position.x*.7, .05 + position.y*(.74 + up*.2));
        vUv = (vec2(mod(v, 8.), 3. - floor(v/8.) - up*2.) + inCell)/vec2(8., 4.);
        vL = mix(1.05, .5, smoothstep(4., 52., base.y))*(.85 + .3*fract(s*7.31));
        // most of the crowd in dark everyday clothes; whole blocks in the colours of their team
        float sec = fract(sin(floor(base.x/26.)*13.1 + floor(base.z/26.)*7.7 + floor(base.y/22.)*3.3)*4375.85);
        vec3 team = sec < .4 ? vec3(.02, .3, .07) : sec < .62 ? vec3(.55) : sec < .78 ? vec3(.42, .03, .16) : vec3(.03, .16, .4);
        float r2 = fract(s*53.7);
        vec3 plain = r2 < .3 ? vec3(.035) : r2 < .5 ? vec3(.04, .055, .12) : r2 < .65 ? vec3(.2) : r2 < .8 ? vec3(.11, .16, .27) : vec3(.24, .05, .06);
        vT = fract(s*17.3) < .55 ? team : plain;
        vec4 mv = modelViewMatrix*vec4(p, 1.); vDepth = -mv.z; vRay = mv.xyz; gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `varying vec2 vUv; varying float vL; varying float vDepth; varying vec3 vRay; varying vec3 vT; uniform sampler2D tF; uniform float uFogDensity; uniform vec3 uFogColor;
      ${FOG_GLSL}
      void main(){
        vec4 t = texture2D(tF, vUv);
        float key = smoothstep(.2, .55, min(t.r, t.b) - t.g);                         // the magenta shirt
        vec3 c = mix(t.rgb, vT*max(t.r, t.b)*1.3, key);
        gl_FragColor = vec4(fogMix(c*vL*vec3(.95, 1., 1.08), uFogColor, uFogDensity, vDepth, vRay), t.a);
      }`,
  });
  const stands = [];
  for (const seats of arenaSeats()){
    if (!seats.length) continue;
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = card.index; geo.setAttribute('position', card.getAttribute('position'));
    geo.setAttribute('aF', new THREE.InstancedBufferAttribute(seats, 4)); geo.instanceCount = seats.length/4;
    const lo = new THREE.Vector3(1e9, 1e9, 1e9), hi = lo.clone().negate();
    for (let i = 0; i < seats.length; i += 4){ lo.min(P.set(seats[i], seats[i + 1], seats[i + 2])); hi.max(P); }
    geo.boundingSphere = new THREE.Sphere(lo.clone().add(hi).multiplyScalar(.5), lo.distanceTo(hi)/2 + 4);
    const m = new THREE.Mesh(geo, fanMat);
    m.position.z = CENTRE; m.frustumCulled = true; bowl.add(m); stands.push(m);
  }

  // giant screens showing the race live: the last finished frame, through an LED grid
  const feed = new THREE.ShaderMaterial({
    toneMapped: false, uniforms: { tF: { value: pipe.blurred.texture }, uTime: U.uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tF; uniform float uTime;
      void main(){
        vec2 uv = vec2(vUv.x, 1. - vUv.y);
        vec3 c = (texture2D(tF, uv).rgb + texture2D(tF, uv + vec2(.004, 0.)).rgb + texture2D(tF, uv - vec2(0., .006)).rgb)/3.;
        vec2 g = fract(vUv*vec2(220., 98.));
        c = min(c, vec3(4.))*(.55 + .75*smoothstep(.5, .2, length(g - .5)))*1.15 + vec3(.01, .015, .03);
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const S = 1;
  place(models, 'jumbotron', { screen: feed, roof }, [
    { x: 46, y: 31, z: CENTRE + 150, s: S }, { x: 46, y: 31, z: CENTRE - 150, s: S },
    { x: -46, y: 31, z: CENTRE + 150, s: S, ry: Math.PI }, { x: -46, y: 31, z: CENTRE - 150, s: S, ry: Math.PI },
    { x: 0, y: 40, z: CENTRE - ARENA_B - 10, s: 1.5, ry: Math.PI/2 },
  ], bowl);

  // floodlight towers behind the stands, each with a hot glare and a beam through the haze
  const lamp = new THREE.MeshBasicMaterial({ color: C(13, 13.5, 14), toneMapped: false, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b8f98, metalness: .7, roughness: .4 });
  const towers = []; for (const zz of [-300, -110, 110, 300]) for (const side of [-1, 1]) towers.push({ x: side*110, y: 0, z: CENTRE + zz, s: 1.3, ry: -side*.32 });
  place(oldModels, 'flood', { floodlamp: lamp, default: steel }, towers, bowl);
  const glareGeo = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
  glareGeo.index = quad.index; glareGeo.setAttribute('position', quad.getAttribute('position'));
  const heads = new Float32Array(towers.length*3);
  towers.forEach((t, i) => { heads[i*3] = t.x - Math.sign(t.x)*1.5; heads[i*3 + 1] = (92 + 6.5)*t.s; heads[i*3 + 2] = t.z; });
  glareGeo.setAttribute('aH', new THREE.InstancedBufferAttribute(heads, 3)); glareGeo.instanceCount = towers.length;
  const glare = new THREE.Mesh(glareGeo, new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, uniforms: { uTime: U.uTime },
    vertexShader: `attribute vec3 aH; varying vec2 vQ;
      void main(){ vQ = position.xy*2.; vec4 mv = modelViewMatrix*vec4(aH, 1.); mv.xy += position.xy*46.; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec2 vQ; uniform float uTime;
      void main(){
        float r = length(vQ), core = exp(-r*r*60.), halo = exp(-r*9.)*.14;
        float star = (exp(-abs(vQ.y)*90.) + exp(-abs(vQ.x)*90.))*exp(-r*2.6)*.7;
        gl_FragColor = vec4(vec3(1.4, 1.5, 1.7)*(core*8. + halo + star)*(.96 + .04*sin(uTime*30.)), 1.);
      }`,
  }));
  glare.frustumCulled = false; bowl.add(glare);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV;
      void main(){ vT = uv.y; vN = normalMatrix*normal; vec4 mv = modelViewMatrix*vec4(position, 1.); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vT; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); gl_FragColor = vec4(vec3(.5, .56, .66)*f*f*vT*vT*.035, 1.); }`,
  });
  const beamGeo = new THREE.CylinderGeometry(3, 26, 1, 24, 1, true); beamGeo.translate(0, -.5, 0); beamGeo.rotateX(-Math.PI/2);
  const up = new THREE.Vector3();
  towers.forEach((t, i) => {
    const b = new THREE.Mesh(beamGeo, beamMat), from = new THREE.Vector3(heads[i*3], heads[i*3 + 1], heads[i*3 + 2]), to = new THREE.Vector3(Math.sign(t.x)*-6, 0, t.z - 60);
    b.position.copy(from); b.lookAt(to); b.scale.set(1, 1, from.distanceTo(to)); b.frustumCulled = false; bowl.add(b);
  });
  group.add(bowl);
  group.add(particles({ n: 420, range: 34, fall: 3, spread: 70, wobble: 1.8, w: .22, h: .12, multi: true }));
  group.visible = false;
  scene.add(group);
  return { group, sky, update(t, ds, dist, rel){
    sky.position.set(0, 3, 8);
    bowl.position.z = rel*DRIFT; U.uArena.value = bowl.position.z + CENTRE;
    for (const m of stands){ const c = m.geometry.boundingSphere.center; m.visible = Math.hypot(c.x, c.z + m.position.z + bowl.position.z) - m.geometry.boundingSphere.radius < 400; }   // beyond this the photo carries it
    feed.uniforms.tF.value = pipe.blurred.texture;                 // the targets are remade when the window or quality changes
  } };
}
