/* Space Rider's course props in Lane Rush: its gate (force field, lit carpet, beacon, trick-word label), its barrier,
   its low bar with the rising jump arrows, and a meteor crater. Models come from Space Rider's props.glb
   (assets/sr_props.glb here); the shaders and materials are Space Rider's (src/game.js buildPools, src/main.js).
   Space Rider's lanes are 3.4 m wide, Lane Rush's 2 m: everything is scaled to fit one Lane Rush lane. */
import * as THREE from "three";

const time = { value: 0 };
const HDR = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const std = (o) => new THREE.MeshStandardMaterial(o);
const vsUv = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }`;

function wordTexture(word, color) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 192;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(4,3,10,.82)";
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = color;
  g.lineWidth = 8;
  g.strokeRect(8, 8, 496, 176);
  g.fillStyle = color;
  g.font = 'italic 800 140px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(word, 256, 102);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Build the kit from Space Rider's props.glb scene. */
export function makeSrKit(gltfScene) {
  const get = (n) => gltfScene.getObjectByName(n);
  const mats = {
    carbon: std({ color: 0x0c0c10, metalness: 0.5, roughness: 0.36 }),
    steel: std({ color: 0x24252b, metalness: 0.9, roughness: 0.34 }),
    alloy: std({ color: 0xbfc1c8, metalness: 1, roughness: 0.25 }),
    panel: std({ color: 0xc4c6cc, metalness: 0.25, roughness: 0.38 }),
    dark: std({ color: 0x050507, metalness: 0.2, roughness: 0.5 }),
    gold: std({ color: 0xffb84a, metalness: 1, roughness: 0.22 }),
    amber: HDR(9, 3.6, 0.3),
    tail: HDR(12, 0.3, 0.4),
    headlamp: HDR(10, 11, 12),
    cyan: HDR(0.8, 6, 7.5),
    led: HDR(6, 6, 6),
  };
  const ledG = HDR(0.45, 9, 2.6);
  const ledR = HDR(11, 0.5, 0.8);
  const clone = (prop, swap) => {
    const o = prop.clone(true);
    o.traverse((m) => {
      if (m.isMesh) m.material = swap(m.material.name) ?? m.material;
    });
    return o;
  };
  // painted colour, not additive light: added light vanishes against a bright sky
  const field = (c) =>
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uC: { value: c }, uTime: time },
      vertexShader: vsUv,
      fragmentShader: `varying vec2 vUv; uniform vec3 uC; uniform float uTime;
        void main(){
          float e = min(min(vUv.x, 1. - vUv.x)*1.4, min(vUv.y, 1. - vUv.y)*2.);
          float scan = .55 + .45*sin(vUv.y*70. - uTime*14.);
          float a = clamp((.34 + .6*exp(-e*9.))*(.8 + .2*scan), 0., .92);
          gl_FragColor = vec4(uC, a);
        }`,
    });
  const carpet = (c) =>
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      uniforms: { uC: { value: c }, uTime: time },
      vertexShader: vsUv,
      fragmentShader: `varying vec2 vUv; uniform vec3 uC; uniform float uTime;
        void main(){
          float x = abs(vUv.x - .5)*2.;
          float along = smoothstep(0., .35, vUv.y)*smoothstep(1., .92, vUv.y);
          float chev = smoothstep(.3, .46, abs(fract(vUv.y*6. + x*.9 - uTime*2.2) - .5));
          float edge = smoothstep(.72, .96, x)*smoothstep(1., .96, x);
          float a = along*(.22 + chev*.42*(1. - x*.5) + edge*.7)*smoothstep(1., .94, x);
          gl_FragColor = vec4(uC, clamp(a, 0., .9));
        }`,
    });
  const beacon = (c) =>
    new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      uniforms: { uC: { value: c } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv*2. - 1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }`,
      fragmentShader: `varying vec2 vUv; uniform vec3 uC;
        void main(){ float d = length(vUv*vec2(1., 2.4)); gl_FragColor = vec4(uC*pow(max(1. - d, 0.), 2.6), 1.); }`,
    });
  const fG = field(new THREE.Color(0.12, 2.6, 0.7)), fR = field(new THREE.Color(3, 0.08, 0.14));
  const cG = carpet(new THREE.Color(0.12, 2.2, 0.55)), cR = carpet(new THREE.Color(2.6, 0.08, 0.14));
  const bG = beacon(new THREE.Color(0.5, 5, 1.6)), bR = beacon(new THREE.Color(6, 0.35, 0.5));
  const planeG = new THREE.PlaneGeometry(2.75, 3.3);
  const carpetGeo = new THREE.PlaneGeometry(2.9, 30);
  const beaconGeo = new THREE.PlaneGeometry(7, 3);
  const labelGeo = new THREE.PlaneGeometry(2.3, 0.86);
  const word = (w, c) => new THREE.MeshBasicMaterial({ map: wordTexture(w, c), transparent: true, toneMapped: false, color: new THREE.Color(2.4, 2.4, 2.4) });
  const words = { g_GREEN: word("GREEN", "#3dff7a"), g_RED: word("RED", "#3dff7a"), r_GREEN: word("GREEN", "#ff3b4f"), r_RED: word("RED", "#ff3b4f") };

  // one lane of Lane Rush is 2 m; Space Rider's gate (2.95 m wide, scaled 1.1) shrinks to fit
  const S = 0.6;
  const gateProto = (green) => {
    const o = clone(get("gate"), (n) => (n === "led" ? (green ? ledG : ledR) : mats[n]));
    const f = new THREE.Mesh(planeG, green ? fG : fR);
    f.position.y = 1.72;
    o.add(f);
    const c = new THREE.Mesh(carpetGeo, green ? cG : cR);
    c.rotation.x = -Math.PI / 2;
    c.position.set(0, 0.05, 15);
    o.add(c);
    const b = new THREE.Mesh(beaconGeo, green ? bG : bR);
    b.position.y = 3.65;
    o.add(b);
    const g = new THREE.Group();
    o.scale.setScalar(1.1 * S);
    g.add(o);
    g.userData.inner = o;
    return g;
  };
  const gates = { g: gateProto(true), r: gateProto(false) };

  // the barrier: Space Rider's 3 m chevron block, one lane wide and stacked tall (here it's dodge-only)
  const barrier = new THREE.Group();
  {
    const b = clone(get("barrier"), (n) => mats[n]);
    b.scale.set(0.62, 0.62, 0.62);
    const top = b.clone();
    top.position.y = 0.66;
    barrier.add(b, top);
  }

  // the low bar (Space Rider's hurdle1) with its rising amber arrows: anything marked so is cleared by jumping
  const jumpField = (n) =>
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uN: { value: n }, uTime: time },
      vertexShader: vsUv,
      fragmentShader: `varying vec2 vUv; uniform float uN, uTime;
        void main(){
          float x = abs(fract(vUv.x*uN) - .5);
          float y = fract(vUv.y*1.6 + x*1.3 - uTime*1.5);
          float arrow = smoothstep(.56, .62, y)*smoothstep(1., .94, y);
          gl_FragColor = vec4(mix(vec3(1.05, .22, .01), vec3(5.2, 3.4, .9), arrow), .62 + arrow*.34);
        }`,
    });
  const lowbar = new THREE.Group();
  {
    const o = clone(get("hurdle1"), (n) => mats[n]);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.25), jumpField(3));
    f.position.y = 0.66;
    o.add(f);
    o.scale.setScalar(0.62);
    lowbar.add(o);
  }

  // a meteor crater: a glowing rim round a dark pit, a lava rock on the lip
  const crater = new THREE.Group();
  {
    const pit = new THREE.Mesh(new THREE.CircleGeometry(0.85, 28), new THREE.MeshBasicMaterial({ color: 0x050302 }));
    pit.rotation.x = -Math.PI / 2;
    pit.scale.set(1.05, 1.5, 1);
    pit.position.y = 0.03;
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.0, 32), HDR(6, 1.4, 0.12));
    rim.rotation.x = -Math.PI / 2;
    rim.scale.set(1.05, 1.5, 1);
    rim.position.y = 0.04;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.9), jumpField(1));
    glow.position.set(0, 0.45, 1.3);
    crater.add(pit, rim, glow);
    const rock = get("lavarock");
    if (rock) {
      for (const [x, s] of [[-0.85, 0.22], [0.8, 0.17]]) {
        const r = clone(rock, (n) => mats[n]);
        r.scale.setScalar(s);
        r.position.set(x, 0.1, -0.9);
        crater.add(r);
      }
    }
  }

  return {
    time,
    /** A gate for one lane: c is "g" or "r"; word ("RED" / "GREEN") puts Space Rider's label over it. */
    gate(c, wordText) {
      const o = gates[c].clone();
      if (wordText) {
        const lbl = new THREE.Mesh(labelGeo, words[`${c}_${wordText}`]);
        lbl.position.y = 4.5 * 1.1 * S;
        lbl.scale.setScalar(1.1 * S);
        o.add(lbl);
      }
      return o;
    },
    barrier,
    lowbar,
    crater,
    tick(t) {
      time.value = t;
    },
  };
}
