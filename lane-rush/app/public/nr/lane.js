/* Neon Rush worlds in Lane Rush.
   Neon Rush keeps its car at z = 0 and slides the world past; Lane Rush moves the runners down -z.
   So each Neon Rush world lives in a container that rides with the runner (container.z = runner z),
   and its own update() streams the scenery exactly as it does at home.
   The road is Neon Rush's deck shader cut down for Lane Rush's four lanes: the same grounds and neon
   paint, with the painted sky in the reflection instead of the planar-reflection pass (too heavy for phones). */
import * as THREE from "three";
import { GLTFLoader } from "/vendor/jsm/loaders/GLTFLoader.js";
import { U, noiseTexture } from "./shared.js";

/** Lane Rush map → Neon Rush world */
export const NR_WORLD = { space: "orbit", candy: "candy", icecream: "candy", crystal: "brain", lava: "volcano", snowy: "cloud", aurora: "ice", deepsea: "sea", egypt: "egypt", uranus: "uranus" };

const C = (r, g, b) => new THREE.Color(r, g, b);
/** Per world: road kind, deck picture, sky, horizon of the plate, ground plane (y or null), fog (linear) and density, parapet LED. */
export const NR = {
  orbit: { kind: 1, sky: "orbit", hz: 0.44, deck: null, ground: null, fog: C(0.1, 0.22, 0.55), density: 0.00032, led: C(0.2, 2.8, 3.4) },
  candy: { kind: 8, sky: "candy", hz: 0.38, deck: "candy", ground: -0.7, fog: C(0.97, 0.76, 0.83), density: 0.00052, led: C(2.6, 0.5, 0.9), rail: true },
  brain: { kind: 7, sky: "brain", hz: 0.28, deck: "brain", ground: null, fog: C(0.13, 0.06, 0.24), density: 0.0015, led: C(1.5, 0.5, 3.4) },
  volcano: { kind: 9, sky: "volcano", hz: 0.28, deck: "volcano", ground: -6, fog: C(0.17, 0.05, 0.03), density: 0.0012, led: C(3.4, 1, 0.1) },
  cloud: { kind: 10, sky: "cloud", hz: 0.44, deck: "cloud", ground: null, fog: C(0.98, 0.82, 0.62), density: 0.0005, led: C(1.9, 1.25, 0.45), marble: true },
  ice: { kind: 4, sky: "ice", hz: 0.06, deck: "ice", ground: -0.5, fog: C(0.06, 0.16, 0.2), density: 0.00072, led: C(0.2, 2.8, 3.4) },
  sea: { kind: 2, sky: "sea", hz: 0.28, deck: "sand", ground: null, fog: C(0.012, 0.085, 0.14), density: 0.0032, led: C(0.2, 2.2, 3.0) },
  egypt: { kind: 13, sky: "egypt", hz: 0.51, deck: "egypt", ground: -2, fog: C(0.78, 0.5, 0.3), density: 0.0016, led: C(2.4, 1.6, 0.5), stone: true },
  uranus: { kind: 14, sky: "uranus", hz: 0.38, deck: "uranus", ground: -0.5, fog: C(0.07, 0.1, 0.22), density: 0.00045, led: C(1.8, 0.7, 3.6) },
};

const tex = new THREE.TextureLoader();
const cache = {};
function loadTex(file, repeat) {
  if (cache[file]) return cache[file];
  const t = tex.load(`/assets/${file}`);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return (cache[file] = t);
}
export const skyTex = (w) => loadTex(`nr_sky_${NR[w].sky}.webp`);

/** Sky reflection lookup shared by the deck and the water: a direction → the plate, mapped like the plate sky. */
const PLATE_GLSL = `
  uniform sampler2D tSky; uniform float uHz;
  vec3 plate(vec3 d){
    float az = atan(d.x, -d.z)/1.1; az = abs(mod(az + 1., 4.) - 2.) - 1.;
    float el = asin(clamp(d.y, -1., 1.));
    return texture2D(tSky, vec2(az*.5 + .5, clamp(uHz + el/.933, .002, .998))).rgb;
  }`;
// three's fog uniforms are filled in by the renderer (fog: true); this is the linear fog Lane Rush uses
const FOG = `uniform vec3 fogColor; uniform float fogNear, fogFar;`;
const VS = `varying vec3 vW; varying float vDepth;
  void main(){ vec4 w = modelMatrix*vec4(position, 1.); vW = w.xyz; vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`;
const END = `#include <tonemapping_fragment>
  #include <colorspace_fragment>`;

/** The road deck for Lane Rush's track (lanes 2 m apart, centres at ±1 and ±3, edges at ±4.8). */
export function deckMaterial(w) {
  const cfg = NR[w];
  const m = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tDeck: { value: null }, tSky: { value: null }, tNoise: { value: null }, uHz: { value: cfg.hz }, uKind: { value: cfg.kind } }]),
    vertexShader: VS,
    fragmentShader: `
      varying vec3 vW; varying float vDepth;
      uniform sampler2D tDeck, tNoise; uniform float uKind, uTime;
      ${PLATE_GLSL}
      ${FOG}
      float aa(float d, float w){ float f = fwidth(d) + 1e-4; return 1. - smoothstep(w - f, w + f, abs(d)); }
      void main(){
        vec2 p = vW.xz;
        float ax = abs(vW.x);
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, vec3(0., 1., 0.));
        vec3 refl = plate(R);
        float F = .035 + .965*pow(1. - max(V.y, 0.), 5.);
        vec3 col = vec3(.03, .025, .04) + refl*F*.6;
        float G = .1 + .75*pow(1. - max(V.y, 0.), 3.);
        if (uKind == 1.){                                         // Orbit: a mirror with the planet showing through
          vec3 below = plate(-V*vec3(1., -1., 1.));
          col = below*.16*vec3(.7, .85, 1.) + refl*(.10 + .9*pow(1. - max(V.y, 0.), 3.5));
          col += vec3(.25, .6, .9)*aa(mod(p.y, 26.) - 13., .03)*.25;
        }
        if (uKind == 2.){                                         // Sea: pale sand, sunlight rippling over it
          vec3 sand = mix(vec3(.3, .36, .4), texture2D(tDeck, p/15.).rgb, .45);
          float w1 = sin(p.y*.9 + sin(p.x*.7 + uTime*.8)*2. + uTime*1.3), w2 = sin(p.x*1.1 - p.y*.6 + uTime*1.1);
          col = sand*vec3(.8, .94, 1.02) + vec3(.3, .42, .44)*pow(max(w1*w2, 0.), 3.)*.8;
        }
        if (uKind == 4.) col = texture2D(tDeck, p/15.).rgb*vec3(.62, .78, .95) + refl*.35*G;          // Ice: black glass, white cracks
        if (uKind == 7.){                                         // Brain: dark membrane, signals racing under it
          float run = pow(.5 + .5*sin(p.y*.09 + uTime*5. + p.x*.3), 10.);
          vec3 skin = texture2D(tDeck, p/16.).rgb;
          col = skin*vec3(.5, .42, .72) + refl*G*.5 + mix(vec3(.2, .9, 1.6), vec3(1.5, .3, 1.3), .5 + .5*sin(p.x))*skin.b*run*.6;
        }
        if (uKind == 8.) col = texture2D(tDeck, p/8.).rgb*vec3(1.06, .95, .98) + refl*(.05 + .45*pow(1. - max(V.y, 0.), 3.));   // Candy: glossy icing
        if (uKind == 9.){                                         // Volcano: black basalt, lava in the cracks
          vec3 lava = texture2D(tDeck, p/8.).rgb;
          float hot = smoothstep(.34, .9, lava.r - lava.b*.8), beat = .72 + .28*sin(uTime*1.7 + p.y*.04);
          col = lava*vec3(.42, .32, .3)*(1. - hot) + vec3(4.4, 1.15, .12)*hot*hot*beat*.6 + refl*F*.3;
        }
        if (uKind == 10.) col = texture2D(tDeck, p/16.).rgb*vec3(.9, .83, .72) + refl*G*.6;          // Cloud City: polished marble
        if (uKind == 13.){                                        // Valley of the Kings: sandstone, gold inlay in the sun
          vec3 t = texture2D(tDeck, p/12.).rgb;
          float gold = smoothstep(.12, .3, t.r - t.b*1.25)*smoothstep(.55, .8, t.r);
          col = t*vec3(.95, .82, .66) + vec3(1.6, 1., .3)*gold*.35 + refl*(.08 + .5*pow(1. - max(V.y, 0.), 3.));
        }
        if (uKind == 14.) col = texture2D(tDeck, p/15.).rgb*vec3(.45, .6, .85) + refl*(.2 + .7*pow(1. - max(V.y, 0.), 3.));   // Uranus: blue ice

        // joints, then the neon paint: dashed lane lines and double edge lines (bright, so they bloom)
        col *= 1. - .6*aa(mod(p.y, 32.) - 16., .03);
        vec3 lineC = vec3(.5, 1.5, 2.), edgeC = vec3(3.6, .25, 2.6);
        if (uKind == 8.){ lineC = vec3(1.5, 1.45, 1.4); edgeC = vec3(1.7, 1.6, 1.5); }
        if (uKind == 9.){ lineC = vec3(2.4, .9, .16); edgeC = vec3(3.8, 1.2, .14); }
        if (uKind == 10.){ lineC = vec3(2.2, 1.5, .6); edgeC = vec3(3., 1.9, .6); }
        if (uKind == 13.){ lineC = vec3(2.4, 1.6, .5); edgeC = vec3(3.4, 2., .5); }
        if (uKind == 14.){ lineC = vec3(.6, 1.8, 2.8); edgeC = vec3(1.8, .7, 3.6); }
        float dash = smoothstep(.5, .54, fract(p.y/14.))*smoothstep(1., .96, fract(p.y/14.));
        float lane = (aa(vW.x, .05) + aa(ax - 2., .05))*dash;
        float edge = aa(ax - 4.45, .07) + aa(ax - 4.68, .035)*.6;
        float fade = 1./(1. + vDepth*.01);
        col += lineC*lane*(.45 + fade*.55) + edgeC*edge*(.55 + fade*.6);
        col = mix(col, fogColor, smoothstep(fogNear, fogFar, vDepth));
        gl_FragColor = vec4(col, 1.);
        ${END}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.tSky.value = skyTex(w);
  m.uniforms.tNoise.value = noiseTexture();
  if (cfg.deck) m.uniforms.tDeck.value = loadTex(`nr_deck_${cfg.deck}.webp`, true);
  return m;
}

/** The lake / lava / frozen sea under the deck, with the sky lying in it. */
export function groundPlane(w) {
  const cfg = NR[w];
  if (cfg.ground == null) return null;
  const m = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tSky: { value: null }, uHz: { value: cfg.hz }, uKind: { value: cfg.kind } }]),
    vertexShader: VS,
    fragmentShader: `
      varying vec3 vW; varying float vDepth;
      uniform float uKind, uTime;
      ${PLATE_GLSL}
      ${FOG}
      void main(){
        vec2 p = vW.xz;
        vec2 rip = vec2(sin(p.x*.11 + uTime*.6) + sin(p.y*.07 - uTime*.4), cos(p.y*.13 + uTime*.5) + sin(p.x*.05 + p.y*.04))*.012;
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, normalize(vec3(rip.x, 1., rip.y)));
        float F = .03 + .97*pow(1. - max(V.y, 0.), 4.5);
        vec3 col = mix(vec3(.012, .02, .03), plate(R)*.85, min(1., F + .1));
        if (uKind == 8.) col = mix(mix(vec3(1., .66, .76), vec3(.72, .92, .86), .5 + .5*sin(p.x*.02 + p.y*.013)), plate(R), F*.6);   // strawberry milk
        if (uKind == 9.){                                                                                       // a lava river
          float crust = smoothstep(.2, .6, .5 + .5*sin(p.x*.13 + sin(p.y*.09 + uTime*.3)*2.)*sin(p.y*.11 - uTime*.2));
          col = mix(vec3(2.6, .42, .03)*(1. + .4*sin(uTime*2. + p.x*.2)), vec3(.05, .02, .02), crust);
        }
        if (uKind == 4. || uKind == 14.){                                                                       // a frozen sea of floes
          float floe = smoothstep(.45, .55, .5 + .5*sin(p.x*.08)*sin(p.y*.06 + sin(p.x*.03)*3.));
          col = mix(col, vec3(.55, .7, .82)*(uKind == 14. ? vec3(.8, .9, 1.2) : vec3(1.)), floe*.85);
        }
        col = mix(col, fogColor, smoothstep(fogNear, fogFar, vDepth));
        gl_FragColor = vec4(col, 1.);
        ${END}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.tSky.value = skyTex(w);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), m);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = cfg.ground;
  plane.renderOrder = -1;
  return plane;
}

/** Parapets along both edges: a dark wall with a glowing LED strip and a bright top line (Neon Rush's road edge). */
export function parapets(w, len, x) {
  const cfg = NR[w];
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: cfg.marble ? 0xf2ede4 : cfg.stone ? 0xc9a36b : 0x15131c, roughness: cfg.marble || cfg.stone ? 0.5 : 0.35, metalness: cfg.marble || cfg.stone ? 0 : 0.6 });
  const led = new THREE.MeshBasicMaterial({ color: cfg.led });
  const top = new THREE.MeshBasicMaterial({ color: cfg.rail ? C(2.6, 0.4, 0.5) : C(2.8, 0.25, 2.3).multiplyScalar(0.34) });
  for (const s of [-1, 1]) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, len), wall);
    body.position.set(s * x, 0.375, -len / 2 + 60);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, len), led);
    strip.position.set(s * x, 0.49, -len / 2 + 60);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, len), top);
    lip.position.set(s * x, 0.77, -len / 2 + 60);
    g.add(body, strip, lip);
  }
  return g;
}

/** Their HDR materials, made to go through Lane Rush's tone mapping instead of their own post pass. */
function toneMap(root) {
  root.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.isShaderMaterial && !m.userData.nrTone) {
        m.userData.nrTone = true;
        m.fragmentShader = m.fragmentShader.replace(/}\s*$/, `${END}\n}`);
        m.needsUpdate = true;
      }
      m.toneMapped = true;
    }
  });
}

const glbs = {};
const loader = new GLTFLoader();
const worlds = {};
/** Build (once) a Neon Rush world into its own container; resolves to { container, world }. */
export function loadWorld(w) {
  if (worlds[w]) return worlds[w];
  const plate = skyTex(w);
  const glb = glbs[w] ?? (glbs[w] = loader.loadAsync(`/assets/nr_${w}.glb?v=1`));
  worlds[w] = Promise.all([glb, import("./maps.js"), import("./maps2.js"), import("./maps3.js")]).then(([g, m1, m2, m3]) => {
    const container = new THREE.Group();
    const models = g.scene;
    const noise = noiseTexture();
    const make = {
      orbit: () => m1.makeOrbitWorld(container, plate, models),
      sea: () => m1.makeSeaWorld(container, plate, models, noise),
      ice: () => m1.makeIceWorld(container, plate, models),
      candy: () => m2.makeCandyWorld(container, plate, models, noise),
      brain: () => m2.makeBrainWorld(container, plate, models, noise),
      volcano: () => m2.makeVolcanoWorld(container, plate, models, noise),
      cloud: () => m2.makeCloudWorld(container, plate, models, noise),
      egypt: () => m3.makeEgyptWorld(container, plate, models),
      uranus: () => m3.makeUranusWorld(container, plate, models),
    }[w];
    const world = make();
    world.group.visible = true;
    toneMap(container);
    return { container, world };
  });
  return worlds[w];
}

/** Per frame: the shared Neon Rush uniforms (time, fog) for the active world. */
export function tickUniforms(w, t) {
  U.uTime.value = t;
  U.uFogColor.value.copy(NR[w].fog);
  U.uFogDensity.value = NR[w].density;
}
