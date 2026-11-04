/* Neon Rush · everything beside the road. Repeating pieces are instanced once and only their group slides,
   wrapped on the spacing, so moving a thousand lamps costs one matrix. */
import * as THREE from 'three';
import { U, ROAD_HALF, FOG_GLSL, seeded, smooth, lerp } from './shared.js';

export const BIOME_LEN = 4400;
/* 0 = open sunset, 1 = city at dusk */
export const biomeAt = d => { const m = d % BIOME_LEN; return smooth(1500, 1850, m)*(1 - smooth(3650, 4000, m)); };

/* Instanced copy of a prop: one InstancedMesh per material, all sharing the same matrices */
function instanced(prop, matrices, resolve){
  const g = new THREE.Group(), list = [];
  prop.traverse(o => { if (o.isMesh) list.push(o); });
  for (const o of list){
    const m = new THREE.InstancedMesh(o.geometry, resolve(o.material.name), matrices.length);
    matrices.forEach((t, i) => m.setMatrixAt(i, t));
    m.frustumCulled = false; m.layers.enable(1);
    g.add(m);
  }
  return g;
}

export class Scenery {
  constructor(scene, props, mats, tFacade, half = ROAD_HALF){
    this.scene = scene;   // Lane Rush: `half` is the road's half width there (its track is narrower)
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);

    // lamp masts on both parapets
    this.lampPeriod = 32;
    const lamps = [];
    for (let i = 0; i < 90; i++) for (const s of [-1, 1]){
      Q.setFromAxisAngle(Y, s > 0 ? 0 : Math.PI);
      lamps.push(new THREE.Matrix4().compose(new THREE.Vector3(s*(half + .55), .77, -i*this.lampPeriod + 32), Q, S));
    }
    this.lampLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 7.5, 8), toneMapped: false });
    this.lamps = instanced(props.lamp, lamps, n => n === 'led' ? this.lampLed : mats[n]);
    scene.add(this.lamps);

    // gantries
    this.gantryPeriod = 256;
    const gantries = [];
    for (let i = 0; i < 12; i++) gantries.push(new THREE.Matrix4().makeTranslation(0, 0, -i*this.gantryPeriod + 256));
    this.gantryLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 6, 8), toneMapped: false });
    this.gantries = instanced(props.gantry, gantries, n => n === 'led' ? this.gantryLed : mats[n]);
    scene.add(this.gantries);

    // towers: a chain of city blocks recycled from the back to the front
    this.segLen = 480; this.segs = [];
    const towerGeo = new THREE.BoxGeometry(1, 1, 1); towerGeo.translate(0, .5, 0);
    this.towerMat = new THREE.ShaderMaterial({
      toneMapped: false,
      uniforms: { ...U, tF: { value: tFacade }, uTint: { value: new THREE.Color(1, 1, 1) }, uLit: { value: .24 }, uTile: { value: 1 } },
      vertexShader: `
        attribute vec3 aSeed; uniform float uTile; varying vec2 vF; varying vec3 vN; varying vec3 vSeed; varying float vDepth; varying vec3 vRay; varying vec3 vW; varying vec3 vL;
        void main(){
          vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec4 w = modelMatrix*instanceMatrix*vec4(position, 1.);
          vec3 lp = position*sc;
          vF = (abs(normal.x) > .5 ? vec2(lp.z, lp.y) : vec2(lp.x, lp.y))/vec2(38., 62.)*uTile + aSeed.xy*9.;
          vN = normal; vSeed = aSeed; vL = vec3(position.x, position.y*sc.y, position.z); vW = w.xyz;
          vec4 mv = viewMatrix*w; vDepth = -mv.z; vRay = mv.xyz; gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `
        varying vec2 vF; varying vec3 vN; varying vec3 vSeed; varying float vDepth; varying vec3 vRay; varying vec3 vW; varying vec3 vL;
        uniform sampler2D tF; uniform float uFogDensity, uNight, uBoost, uDist, uLit; uniform vec3 uFogColor, uSkyTint, uTint;
        ${FOG_GLSL}
        void main(){
          vec3 t = texture2D(tF, vF).rgb;
          float L = dot(t, vec3(.3, .6, .1));
          float lit = smoothstep(uLit, uLit + .28, L);
          vec3 glass = mix(vec3(.05, .03, .07), vec3(.20, .08, .13), clamp(vW.y/200., 0., 1.))*uTint;
          vec3 c = t*.05 + glass*(1. - lit);
          c += t*t*lit*(2.2 + uNight*4.)*mix(vec3(1.), vec3(.7, 1.1, 1.5), vSeed.z);
          if (abs(vN.y) > .5) c = vec3(.012, .01, .02);
          else {
            // neon piping on the corners of one tower in three
            float pipe = step(.66, vSeed.x)*smoothstep(.012, .004, .5 - (abs(vN.x) > .5 ? abs(vL.z) : abs(vL.x)));
            vec3 hue = mix(vec3(.2, 2.6, 3.4), vec3(3.6, .3, 2.6), step(.82, vSeed.x));
            c += hue*pipe*(1. - smoothstep(0., 1., vL.y/360.)*.3)*2.;
          }
          // far towers melt into a dark silhouette, never a bright block in front of the sun
          float f = 1. - exp(-pow(vDepth*.0014, 2.));
          gl_FragColor = vec4(mix(c, uFogColor*.42, f), 1.);
        }`,
    });
    const r = seeded(77);
    for (let s = 0; s < 7; s++){
      const n = 46, im = new THREE.InstancedMesh(towerGeo, this.towerMat, n), seeds = new Float32Array(n*3);
      for (let i = 0; i < n; i++){
        const side = i % 2 ? 1 : -1, row = r();
        const x = side*(half + 30 + row*row*260), w = 22 + r()*34, dp = 22 + r()*34, h = 70 + r()*r()*300 + row*80;
        M.compose(new THREE.Vector3(x, -9, -r()*this.segLen), Q.identity(), new THREE.Vector3(w, h, dp));
        im.setMatrixAt(i, M);
        seeds[i*3] = r(); seeds[i*3 + 1] = r(); seeds[i*3 + 2] = r();
      }
      im.geometry = towerGeo.clone();
      im.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
      im.frustumCulled = false; im.layers.enable(1); im.visible = false;
      scene.add(im);
      this.segs.push({ mesh: im, start: s*this.segLen });
    }
    // bright ambient glow patches under the road give the far water depth
  }

  update(dist){
    this.lamps.position.z = dist % this.lampPeriod;
    this.gantries.position.z = (dist + this.gantryPeriod/2) % this.gantryPeriod;      // never on top of the start line
    for (const s of this.segs){
      if (s.start + this.segLen + 60 < dist){
        s.start += this.segs.length*this.segLen;
      }
      s.mesh.position.z = dist - s.start;
      s.mesh.visible = this.towers && s.start - dist < 1200;   // Lane Rush: its City map is city all the way
    }
  }

  /* what stands beside the road in each world */
  setWorld(lamps, gantries, towers){ this.lamps.visible = lamps; this.gantries.visible = gantries; this.towers = towers; }

  setFlip(on){ this.gantryLed.color.setRGB(on ? 9 : .6, on ? .7 : 6, on ? 1 : 8); }
}

export function biomeColors(k, out){
  out.fog.setRGB(lerp(.72, .10, k), lerp(.28, .055, k), lerp(.34, .17, k));
  out.tint.setRGB(lerp(1, .42, k), lerp(1, .30, k), lerp(1, .62, k));
  out.night = k*.8;
  out.density = lerp(.00078, .0012, k);
}
