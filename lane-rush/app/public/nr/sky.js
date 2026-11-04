/* Neon Rush · sky: a matte painted cloudscape pushed into HDR, a real sun, ridgelines and the far city.
   The same shader feeds the screen, the road reflection and the car's environment map. */
import * as THREE from 'three';
import { U, FLOW_GLSL, noiseTexture } from './shared.js';

const fragment = `
  varying vec3 vDir;
  uniform sampler2D tSky, tLine;
  uniform vec3 uSkyTint; uniform float uNight, uTime, uZoom;
  ${FLOW_GLSL}
  const vec3 S = normalize(vec3(0., .085, -1.));
  float h1(float x){ return fract(sin(x*127.1)*43758.5453); }
  float n1(float x){ float i = floor(x), f = fract(x); f = f*f*(3. - 2.*f); return mix(h1(i), h1(i + 1.), f); }
  float ridge(float x){ float a = 0., w = .55; for (int i = 0; i < 6; i++){ a += w*(1. - abs(n1(x)*2. - 1.)); x = x*2.03 + 7.1; w *= .5; } return a; }
  float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
  void main(){
    vec3 d = normalize(vDir);
    float az = atan(d.x, -d.z)/uZoom, el = asin(clamp(d.y, -1., 1.))/uZoom;
    float u = az/1.1; u = abs(mod(u + 1., 4.) - 2.) - 1.;
    float v = max(el, 0.)/.92;
    float aloft = smoothstep(.02, .22, v);                            // the clouds drift, the horizon glow stays
    vec3 c = flowSky(tSky, vec2(u*.5 + .5, min(v, .999)), vec2(.05, .006)*aloft, uTime, .016*aloft);
    float L = luma(c);
    c *= .78 + 4.2*smoothstep(.40, .95, L)*L;                       // lift the painted highlights into HDR
    vec3 zenith = vec3(.012, .012, .05);
    c *= vec3(.92, .74, 1.12);                                         // push the painting toward magenta
    c = mix(c, zenith, smoothstep(.72, 1.25, v));
    vec3 haze = vec3(.62, .24, .27)*(1. + 2.4*exp(-abs(az)*3.2));
    c = mix(c, haze, exp(-max(el, 0.)*26.)*.8);
    c *= uSkyTint;
    haze *= mix(uSkyTint, vec3(1.), .25);

    // sun, half sunk behind the horizon haze
    float a = acos(clamp(dot(d, S), -1., 1.))/uZoom, sun = 1. - uNight;
    const float R = .135;
    float disc = smoothstep(R, R - .0035, a);
    float yy = clamp((el - .085)/R, -1., 1.);
    vec3 sc = mix(vec3(11., 2.2, 2.8), vec3(13., 10., 4.6), smoothstep(-.8, .9, yy));
    float bars = 1.;
    c = mix(c, sc, disc*sun*smoothstep(-.03, .03, el));
    c += vec3(1., .30, .20)*exp(-a*5.)*.7*sun + vec3(1., .5, .28)*exp(-a*16.)*1.5*sun;

    // two layers of ridgeline, furthest first, leaving a notch for the sun
    float px = fwidth(el) + .0005;
    float keep = smoothstep(.10, .62, abs(az));
    float r1 = (.012 + .085*ridge(az*3.1 + 11.)*keep);
    float m1 = smoothstep(r1 + px, r1 - px, el);
    c = mix(c, mix(haze*.62, haze*.34, smoothstep(0., .09, el)), m1);
    float r2 = (.006 + .05*ridge(az*5.3 + 2.4)*keep);
    float m2 = smoothstep(r2 + px, r2 - px, el);
    vec3 rock = mix(vec3(.17, .07, .15), vec3(.34, .12, .2), exp(-abs(az)*2.));
    c = mix(c, rock*mix(uSkyTint, vec3(1.), .4), m2);

    // the far megacity: alpha is its true silhouette
    float lu = az/.92;
    if (abs(lu) < 1.){
      float lv = el/.205;
      vec4 l = texture2D(tLine, vec2(lu*.5 + .5, clamp(lv, .001, .999)));
      if (lv > 0. && lv < 1.){
        vec3 tower = mix(haze*.30, haze*.12, smoothstep(0., .5, lv));
        vec3 lights = l.rgb*l.rgb*vec3(1.5, 1.5, 1.8)*(1.3 + uNight*2.6);
        c = mix(c, tower + lights, l.a);
      }
    }

    if (el < 0.) c = mix(haze*.9, vec3(.03, .02, .05), smoothstep(0., -.3, el));
    gl_FragColor = vec4(c, 1.);
  }`;

export function makeSky(tSky, tLine){
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, toneMapped: false, fog: false,
    uniforms: { tSky: { value: tSky }, tLine: { value: tLine }, uSkyTint: U.uSkyTint, uNight: U.uNight, uTime: U.uTime, uZoom: U.uZoom, tN: { value: noiseTexture() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: fragment,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 24), mat);
  mesh.frustumCulled = false; mesh.renderOrder = 100;
  mesh.layers.enable(1);
  return mesh;
}

/* Bakes the sky into a blurred environment map for the car and the props */
export function bakeEnvironment(renderer, sky){
  const envScene = new THREE.Scene();
  const clone = new THREE.Mesh(sky.geometry, sky.material);
  clone.frustumCulled = false;
  envScene.add(clone);
  // a band of cool city light so paint has something to catch on its sides
  const band = new THREE.Mesh(new THREE.BoxGeometry(60, .6, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(.8, 1.3, 2), side: THREE.BackSide, toneMapped: false }));
  band.position.y = 12;
  envScene.add(band);
  const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(.1, 200, rt);
  cubeCam.update(renderer, envScene);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(rt.texture).texture;
  rt.dispose(); pmrem.dispose();
  band.geometry.dispose(); band.material.dispose();
  return env;
}
