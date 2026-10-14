export const curlGLSL = /* glsl */ `
// Analytic curl of a sinusoidal vector potential: cheap, smooth, divergence-free.
vec3 curlSin(vec3 p, float t) {
  float k1 = 1.7, k2 = 2.3;
  return vec3(
    k2 * cos(p.y * k2 + t * 0.8) - k1 * cos(p.z * k1 + t * 1.1),
    k2 * cos(p.z * k2 - t * 0.7) - k1 * cos(p.x * k1 - t * 0.9),
    k2 * cos(p.x * k2 + t * 0.6) - k1 * cos(p.y * k1 + t)
  );
}
vec3 curl2(vec3 p, float t) {
  const mat3 R = mat3(0.80, 0.36, -0.48, -0.60, 0.48, -0.64, 0.00, 0.80, 0.60);
  return curlSin(p, t) * 0.6 + curlSin(R * p * 2.1, t * 1.3) * 0.4;
}
`

export const particleVertex = /* glsl */ `
uniform float uTime;
uniform float uFlow;
uniform float uFlowSpeed;
uniform float uStreak;
uniform float uMorph;
uniform float uAssemble;
uniform float uRadius;
uniform float uHold;
uniform vec3 uPointer;
uniform float uPointerAmt;
uniform float uFilter;
uniform float uFilterMix;
uniform float uDensity; // >1 when fewer particles (mobile)
uniform vec3 uBeaconPos;
uniform float uBeaconAngle;
uniform float uBeaconPower;

attribute vec3 aSph;
attribute vec4 aShelf;
attribute vec3 aColA;
attribute vec3 aColB;
attribute vec4 aRnd;

varying vec2 vUv;
varying vec2 vDim;
varying vec3 vColor;
varying float vAlpha;
varying float vOrb;

${curlGLSL}

vec3 rotAxis(vec3 p, vec3 a, float ang) {
  float c = cos(ang), s = sin(ang);
  return p * c + cross(a, p) * s + a * dot(a, p) * (1.0 - c);
}

float inOutCubic(float x) {
  return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) * 0.5;
}

void main() {
  // ---------- outer mind: flowing on a sphere ----------
  vec3 axis = normalize(vec3(0.42, 1.0, 0.18));
  float spd = 0.7 + 0.6 * aRnd.x;
  vec3 s = rotAxis(aSph, axis, uFlow * spd);

  vec3 wP = s * uRadius;
  float pd = distance(wP, uPointer);
  float pf = exp(-pd * pd * 0.55) * uPointerAmt;
  vec3 cu = curl2(s * 1.4, uTime * 0.22);
  s = normalize(s + cu * (0.010 + 0.04 * pf));

  float radius = uRadius * (1.0 - 0.045 * uHold) * (1.0 + 0.05 * pf);
  vec3 A = s * radius;

  // assembly from nothing (loading screen)
  float as = clamp(uAssemble * 1.6 - aRnd.w * 0.6, 0.0, 1.0);
  as = 1.0 - pow(1.0 - as, 3.0);
  vec3 scatter = aSph * uRadius * (2.5 + 7.0 * aRnd.x) + cu * 1.5;
  A = mix(scatter, A, as);

  // ---------- memory hall: shelves ----------
  bool dust = aShelf.w < -0.5;
  float m = clamp(uMorph * 1.75 - aRnd.w * 0.75, 0.0, 1.0);
  m = inOutCubic(m);
  vec3 B = aShelf.xyz + vec3(0.0, sin(uTime * 0.6 + aRnd.z * 6.2831) * 0.035, 0.0);
  if (dust) B += curl2(B * 0.06, uTime * 0.08) * 0.9;
  vec3 arc = (aSph * (3.0 + 7.0 * aRnd.x) + vec3(0.0, 2.0 + 5.0 * aRnd.z, 0.0)) * sin(m * 3.14159);
  vec3 pos = mix(A, B, m) + arc;

  // ---------- billboard / streak in view space ----------
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dir = uFlowSpeed >= 0.0 ? 1.0 : -1.0;
  vec3 tangW = cross(axis, s) * dir;
  vec3 tv = mat3(modelViewMatrix) * tangW;
  float tl = length(tv.xy);
  vec2 t2 = tl > 1e-5 ? tv.xy / tl : vec2(1.0, 0.0);
  vec2 n2 = vec2(-t2.y, t2.x);

  vec3 nv = normalize(mat3(modelViewMatrix) * s);
  float facing = dot(nv, normalize(-mv.xyz));
  float rim = 1.0 - abs(facing);

  float speedK = clamp(abs(uFlowSpeed) / 0.32, 0.0, 1.6);
  float w0 = 0.0135 * uDensity * (0.7 + 0.6 * aRnd.y) * (1.0 + rim * rim * 1.6);
  // tl = screen-projected tangential speed (distance from axis, foreshortened)
  float streakL = (0.05 + 0.11 * spd) * speedK * tl;
  float l0 = w0 + streakL * uStreak;

  float orbR = dust ? (0.028 + 0.05 * aRnd.y) : (0.19 + 0.11 * aRnd.y);
  float w = mix(w0, orbR * 2.0, m);
  float l = mix(l0, orbR * 2.0, m);

  mv.xy += t2 * position.x * l + n2 * position.y * w;
  gl_Position = projectionMatrix * mv;

  vUv = position.xy;
  vDim = vec2(l, w);

  // ---------- colour ----------
  float ir = facing * 1.4 + uTime * 0.04 + aRnd.z;
  vec3 iri = 0.62 + 0.38 * cos(6.2831 * (ir + vec3(0.0, 0.33, 0.67)));
  vec3 colA = mix(aColA, aColA * iri * 1.3, 0.28) * 1.4;
  vec3 colB = aColB;
  if (aShelf.w > 4.5) colB = mix(aColB, iri * 1.1, 0.45); // pearl / wonder
  vColor = mix(colA, colB, m) * (1.0 + 0.35 * uHold * (1.0 - m)) * (1.0 + 0.6 * pf * (1.0 - m));
  // Founder HQ's beacon: anything in the sweeping beam lights up for a moment
  vec2 bd = aShelf.xz - uBeaconPos.xz;
  float bdiff = abs(mod(atan(bd.y, bd.x) - uBeaconAngle + 3.14159, 6.28318) - 3.14159);
  float beam = smoothstep(0.16, 0.0, bdiff) * uBeaconPower * m;
  vColor *= 1.0 + beam * 2.2;

  float back = smoothstep(-0.35, 0.35, facing);
  float rimFade = max(pow(smoothstep(0.02, 0.6, abs(facing)), 1.4), 0.03);
  float alphaA = mix(0.2, 0.85, back) * rimFade * as * mix(1.0, 1.35, uDensity - 1.0);
  float tw = 0.75 + 0.25 * sin(uTime * (0.6 + aRnd.x) + aRnd.z * 40.0);
  float alphaB = dust ? 0.32 * tw : 0.92;

  // emotion filter
  float keep = (uFilter < -0.5 || abs(aShelf.w - uFilter) < 0.5) ? 1.0 : 0.1;
  alphaB *= mix(1.0, keep, uFilterMix);

  // hall fog fades additive orbs to nothing
  float fd = length(mv.xyz);
  float fog = 1.0 - exp(-0.000036 * fd * fd);
  vAlpha = mix(alphaA, alphaB * (1.0 - fog), m);
  vOrb = dust ? 0.0 : m;
}
`

export const particleFragment = /* glsl */ `
varying vec2 vUv;
varying vec2 vDim;
varying vec3 vColor;
varying float vAlpha;
varying float vOrb;

void main() {
  vec2 q = vUv * vDim;
  float hw = vDim.y * 0.5;
  float hl = max(vDim.x * 0.5 - hw, 0.0);
  vec2 d = vec2(max(abs(q.x) - hl, 0.0), q.y);
  float r = length(d) / hw;
  if (r > 1.0) discard;

  // streak: soft gaussian with a brighter head
  float head = smoothstep(-0.5, 0.5, vUv.x);
  float streak = exp(-r * r * 3.2) * mix(0.3, 1.0, head);

  // orb: sphere impostor with fresnel rim
  float nz = sqrt(max(1.0 - r * r, 0.0));
  float fres = pow(1.0 - nz, 2.0);
  float core = exp(-r * r * 2.2);
  vec2 hp = q / hw - vec2(-0.32, 0.36);
  float spec = exp(-dot(hp, hp) * 14.0);
  vec3 orb = vColor * (0.28 + 0.55 * core) + vColor * fres * 1.7 + vec3(1.0) * (pow(fres, 5.0) * 0.5 + spec * 0.55);
  float edge = smoothstep(1.0, 0.86, r);

  vec3 col = mix(vColor * streak * 1.5, orb * edge, vOrb);
  float a = mix(streak, edge * (0.6 + 0.4 * fres), vOrb) * vAlpha;
  gl_FragColor = vec4(col, a);
}
`
