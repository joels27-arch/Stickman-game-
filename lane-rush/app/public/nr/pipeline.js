/* Space Rider's HDR render pipeline, ported to Lane Rush.
   scene (half-float, optional MSAA) → camera motion blur → bloom mip chain + anamorphic streak → film grade
   (chromatic aberration, ACES, lifted violet shadows, soft S-curve, vignette, grain).
   Differences from Space Rider (src/pipeline.js there):
   - Lane Rush moves the camera down -z through a still world, so last frame's view-projection is used as is
     (Space Rider slides the world past a still car and shifts it by the distance driven).
   - The runners write alpha 0 (see sharpen()), so the blur never smears them: the same trick as Space Rider's car.
   - No planar mirror and no sun shafts (the mirror is off in Space Rider too; shafts need a depth-1 sky).
   - The targets follow the renderer's own drawing-buffer size, so Lane Rush keeps deciding the resolution.
   Every target is allocated once per size/quality: nothing allocates per frame. */
import * as THREE from "three";

const vs = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const quadGeo = new THREE.PlaneGeometry(2, 2);
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function pass(fragmentShader, uniforms) {
  const mesh = new THREE.Mesh(quadGeo, new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false }));
  mesh.frustumCulled = false;
  return { material: mesh.material, render: (r) => r.render(mesh, quadCam) };
}

/** Quality levels, best first: MSAA on the scene target, bloom mips, motion-blur taps (0 = no blur pass). */
export const PIPE_LEVELS = [
  { msaa: 2, bloom: 5, mblur: 7 },
  { msaa: 0, bloom: 5, mblur: 0 }, // phones start here: the motion-blur pass costs a full-screen read of 7 taps
  { msaa: 0, bloom: 4, mblur: 0 },
];

/** Rim light on the runners (Space Rider's lamp sheen, cut down): its colour is set per map by the game. */
export const RIM = { value: new THREE.Color(0, 0, 0) };
/** A floor on the runners' brightness (their own colours times this): on a dark map the world stays dark
    but the runners still look as they do in daylight. 0 = off. */
export const FILL = { value: 0 };
/** Keep these objects sharp under the motion blur: their opaque materials write alpha 0 (Space Rider's car trick),
    and give lit ones a rim of light so the runners stand out from the world. */
const sharpened = new WeakSet();
export function sharpen(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || m.transparent || sharpened.has(m)) continue;
      sharpened.add(m);
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        prev?.call(m, sh, r);
        const lit = sh.fragmentShader.includes("#include <normal_fragment_begin>");
        if (lit) {
          sh.uniforms.uRim = RIM;
          sh.uniforms.uFill = FILL;
          sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uRim;\nuniform float uFill;");
        }
        const rim = lit
          ? "  { float nv = abs(dot(normalize(normal), normalize(vViewPosition)));\n" +
            "    gl_FragColor.rgb = max(gl_FragColor.rgb, diffuseColor.rgb*uFill*(.62 + .38*nv));\n" +
            "    gl_FragColor.rgb += uRim*pow(1. - nv, 3.); }\n"
          : "";
        sh.fragmentShader = sh.fragmentShader.replace(/}\s*$/, rim + "  gl_FragColor.a = 0.;\n}");
      };
      const key = m.customProgramCacheKey?.bind(m);
      m.customProgramCacheKey = () => (key ? key() : "") + "|sharp";
      m.needsUpdate = true;
    }
  });
}

export class Pipeline {
  constructor(renderer, scene, camera) {
    this.r = renderer;
    this.scene = scene;
    this.camera = camera;
    this.level = 0;
    this.exposure = 1;
    this.blurAmount = 1;
    this.aberration = 0;
    this.flash = 0;
    this.flashColor = new THREE.Color(1, 1, 1);
    this.saturation = 1;
    this.bloomMix = 0.06;
    this.prevVP = new THREE.Matrix4();
    this.vp = new THREE.Matrix4();
    this.invVP = new THREE.Matrix4();
    this.prevPos = new THREE.Vector3();
    this.size = new THREE.Vector2();
    this.cut = true;

    this.motion = pass(
      `varying vec2 vUv; uniform sampler2D tColor, tDepth; uniform mat4 uInvVP, uPrevVP; uniform float uAmount; uniform int uTaps;
      float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(.06711056, .00583715)))); }
      void main(){
        vec4 c = texture2D(tColor, vUv);
        float d = texture2D(tDepth, vUv).r;
        vec4 wp = uInvVP*vec4(vUv*2. - 1., d*2. - 1., 1.); wp /= wp.w;
        vec4 pc = uPrevVP*wp;
        vec2 vel = (vUv - (pc.xy/pc.w*.5 + .5))*uAmount*clamp(c.a, 0., 1.);
        float L = length(vel);
        if (L > .04) vel *= .04/L;
        if (L < .0006){ gl_FragColor = vec4(c.rgb, 1.); return; }
        float j = ign(gl_FragCoord.xy) - .5;
        vec3 sum = c.rgb; float w = 1.;
        for (int i = 0; i < 9; i++){
          if (i >= uTaps) break;
          float t = (float(i) + .5 + j)/float(uTaps) - .5;
          vec4 s = texture2D(tColor, vUv + vel*t);
          sum += mix(c.rgb, s.rgb, clamp(s.a, 0., 1.)); w += 1.;   // a runner (alpha 0) is never smeared into what is behind it
        }
        gl_FragColor = vec4(sum/w, 1.);
      }`,
      { tColor: { value: null }, tDepth: { value: null }, uInvVP: { value: this.invVP }, uPrevVP: { value: new THREE.Matrix4() }, uAmount: { value: 0 }, uTaps: { value: 7 } },
    );

    // Jimenez 13-tap downsample with a soft knee on the first mip
    this.down = pass(
      `varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uPx; uniform float uFirst, uKnee0, uKnee1;
      vec3 s(vec2 o){ return min(texture2D(tMap, vUv + o*uPx).rgb, vec3(24.)); }
      void main(){
        vec3 a = s(vec2(-2,2)), b = s(vec2(0,2)), c = s(vec2(2,2)), d = s(vec2(-2,0)), e = s(vec2(0)), f = s(vec2(2,0)),
             g = s(vec2(-2,-2)), h = s(vec2(0,-2)), i = s(vec2(2,-2)), j = s(vec2(-1,1)), k = s(vec2(1,1)), l = s(vec2(-1,-1)), m = s(vec2(1,-1));
        vec3 o = e*.125 + (a+c+g+i)*.03125 + (b+d+f+h)*.0625 + (j+k+l+m)*.125;
        if (uFirst > .5){ float L = dot(o, vec3(.2126,.7152,.0722)); o *= smoothstep(uKnee0, uKnee1, L); }
        gl_FragColor = vec4(o, 1.);
      }`,
      { tMap: { value: null }, uPx: { value: new THREE.Vector2() }, uFirst: { value: 0 }, uKnee0: { value: 0.75 }, uKnee1: { value: 2.6 } },
    );

    this.up = pass(
      `varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uPx; uniform float uK;
      void main(){
        vec3 c = texture2D(tMap, vUv).rgb*4.;
        c += (texture2D(tMap, vUv + vec2(uPx.x,0)).rgb + texture2D(tMap, vUv - vec2(uPx.x,0)).rgb + texture2D(tMap, vUv + vec2(0,uPx.y)).rgb + texture2D(tMap, vUv - vec2(0,uPx.y)).rgb)*2.;
        c += texture2D(tMap, vUv + uPx).rgb + texture2D(tMap, vUv - uPx).rgb + texture2D(tMap, vUv + vec2(uPx.x,-uPx.y)).rgb + texture2D(tMap, vUv + vec2(-uPx.x,uPx.y)).rgb;
        gl_FragColor = vec4(c/16.*uK, 1.);
      }`,
      { tMap: { value: null }, uPx: { value: new THREE.Vector2() }, uK: { value: 1 } },
    );
    Object.assign(this.up.material, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });

    // anamorphic streak: a wide horizontal blur of a small bloom mip
    this.streak = pass(
      `varying vec2 vUv; uniform sampler2D tMap; uniform float uStep;
      void main(){
        vec3 c = texture2D(tMap, vUv).rgb*.16;
        for (int i = 1; i < 8; i++){
          float w = .16*exp(-float(i*i)/14.), o = float(i)*uStep;
          c += (texture2D(tMap, vUv + vec2(o,0)).rgb + texture2D(tMap, vUv - vec2(o,0)).rgb)*w;
        }
        gl_FragColor = vec4(c, 1.);
      }`,
      { tMap: { value: null }, uStep: { value: 0 } },
    );

    this.final = pass(
      `varying vec2 vUv; uniform sampler2D tColor, tBloom, tStreak;
      uniform float uExposure, uAb, uTime, uFlash, uSat, uBloom; uniform vec3 uFlashCol;
      vec3 aces(vec3 x){
        const mat3 I = mat3(.59719,.07600,.02840, .35458,.90834,.13383, .04823,.01566,.83777);
        const mat3 O = mat3(1.60475,-.10208,-.00327, -.53108,1.10813,-.07276, -.07367,-.00605,1.07602);
        x = I*x;
        vec3 a = x*(x + .0245786) - .000090537, b = x*(.983729*x + .4329510) + .238081;
        return clamp(O*(a/b), 0., 1.);
      }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
      vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
      void main(){
        vec2 q = vUv - .5; float r2 = dot(q, q);
        vec2 ca = q*r2*(.012 + uAb);
        vec3 c = vec3(texture2D(tColor, vUv + ca).r, texture2D(tColor, vUv).g, texture2D(tColor, vUv - ca).b);
        c += texture2D(tBloom, vUv).rgb*uBloom;
        c += texture2D(tStreak, vUv).rgb*vec3(.28,.5,1.)*.055;
        c *= uExposure;
        c = mix(c, uFlashCol, uFlash);
        c = aces(c*.82);
        // grade: lifted violet shadows, a little saturation and contrast
        float L = dot(c, vec3(.2126,.7152,.0722));
        c = mix(vec3(L), c, 1.08*uSat);
        c = c + vec3(.012,.0,.03)*(1. - smoothstep(0., .35, L));
        c = c*c*(3. - 2.*c)*.42 + c*.58;
        c *= 1. - r2*r2*1.9;
        c = srgb(clamp(c, 0., 1.));
        float n = hash(gl_FragCoord.xy*.73 + fract(uTime)*91.) - .5;
        c += n*(.022 - .012*sqrt(L)) + (hash(gl_FragCoord.yx + 3.1) - .5)/255.;
        gl_FragColor = vec4(c, 1.);
      }`,
      {
        tColor: { value: null }, tBloom: { value: null }, tStreak: { value: null },
        uExposure: { value: 1 }, uAb: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 }, uSat: { value: 1 }, uBloom: { value: 0.06 }, uFlashCol: { value: this.flashColor },
      },
    );
  }

  get quality() {
    return PIPE_LEVELS[this.level];
  }
  setLevel(level) {
    level = Math.max(0, Math.min(PIPE_LEVELS.length - 1, level));
    if (level === this.level && this.main) return;
    this.level = level;
    this.w = 0; // rebuild the targets on the next frame
  }
  /** Bloom threshold: only luminance between knee0 and knee1 (HDR) blooms in. */
  setKnee(k0, k1) {
    const u = this.down.material.uniforms;
    u.uKnee0.value = k0;
    u.uKnee1.value = k1;
  }

  ensure() {
    const s = this.r.getDrawingBufferSize(this.size);
    const w = Math.max(2, Math.floor(s.x)), h = Math.max(2, Math.floor(s.y));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.dispose();
    const q = PIPE_LEVELS[this.level];
    const opt = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    const depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    depthTexture.format = THREE.DepthFormat;
    this.main = new THREE.WebGLRenderTarget(w, h, { ...opt, depthBuffer: true, samples: q.msaa, depthTexture });
    this.blurred = q.mblur ? new THREE.WebGLRenderTarget(w, h, opt) : null;
    this.mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < q.bloom; i++) {
      mw = Math.max(2, mw >> 1);
      mh = Math.max(2, mh >> 1);
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, opt));
    }
    this.streakT = [0, 1].map(() => new THREE.WebGLRenderTarget(Math.max(2, w >> 2), Math.max(2, h >> 3), opt));
    this.motion.material.uniforms.uTaps.value = q.mblur || 1;
    this.cut = true;
  }
  dispose() {
    for (const t of [this.main, this.blurred, ...(this.mips || []), ...(this.streakT || [])]) t?.dispose();
    this.main?.depthTexture?.dispose();
    this.main = null;
  }

  render(dt, time) {
    this.ensure();
    const r = this.r, cam = this.camera;
    r.setRenderTarget(this.main);
    r.render(this.scene, cam);

    let src = this.main;
    if (this.blurred) {
      cam.updateMatrixWorld();
      this.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this.invVP.copy(this.vp).invert();
      // a camera cut (intro, the look-back view, a teleport) must not smear
      if (this.cut || cam.position.distanceToSquared(this.prevPos) > 4) this.prevVP.copy(this.vp);
      this.cut = false;
      this.prevPos.copy(cam.position);
      const mu = this.motion.material.uniforms;
      mu.uPrevVP.value.copy(this.prevVP);
      mu.uAmount.value = this.blurAmount * Math.min(1, 1 / 90 / Math.max(dt, 1 / 400));
      mu.tColor.value = this.main.texture;
      mu.tDepth.value = this.main.depthTexture;
      this.prevVP.copy(this.vp);
      r.setRenderTarget(this.blurred);
      this.motion.render(r);
      src = this.blurred;
    }
    const color = src;

    // bloom down
    const du = this.down.material.uniforms;
    this.mips.forEach((t, i) => {
      du.tMap.value = src.texture;
      du.uPx.value.set(1 / src.width, 1 / src.height);
      du.uFirst.value = i === 0 ? 1 : 0;
      r.setRenderTarget(t);
      this.down.render(r);
      src = t;
    });

    // streak from mip 2, before the upsample changes it
    const su = this.streak.material.uniforms;
    su.tMap.value = this.mips[1].texture;
    su.uStep.value = 2.2 / this.streakT[0].width;
    r.setRenderTarget(this.streakT[0]);
    this.streak.render(r);
    su.tMap.value = this.streakT[0].texture;
    su.uStep.value = 9 / this.streakT[0].width;
    r.setRenderTarget(this.streakT[1]);
    this.streak.render(r);

    // bloom up, additive into each larger mip
    const auto = r.autoClear;
    r.autoClear = false;
    const uu = this.up.material.uniforms;
    for (let i = this.mips.length - 1; i > 0; i--) {
      const a = this.mips[i];
      uu.tMap.value = a.texture;
      uu.uPx.value.set(1.4 / a.width, 1.4 / a.height);
      uu.uK.value = 0.92;
      r.setRenderTarget(this.mips[i - 1]);
      this.up.render(r);
    }
    r.autoClear = auto;

    const fu = this.final.material.uniforms;
    fu.tColor.value = color.texture;
    fu.tBloom.value = this.mips[0].texture;
    fu.tStreak.value = this.streakT[1].texture;
    fu.uExposure.value = this.exposure;
    fu.uAb.value = this.aberration;
    fu.uTime.value = time;
    fu.uFlash.value = this.flash;
    fu.uSat.value = this.saturation;
    fu.uBloom.value = this.bloomMix;
    r.setRenderTarget(null);
    this.final.render(r);
  }
}
