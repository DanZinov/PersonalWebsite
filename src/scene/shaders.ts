/**
 * GLSL for the particle field.
 *
 * The 3D simplex noise below is Ashima Arts / Stefan Gustavson's
 * implementation (MIT), the standard one used across WebGL projects.
 */

const SIMPLEX_NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/**
 * Each particle carries four "home" positions, one per formation. `uMorph`
 * walks continuously from 0 to 3 as the page scrolls, and the shader blends
 * between the two formations it currently sits between. Everything else
 * (drift, turbulence, cursor repulsion) is layered on top of that blend.
 */
export const particleVertexShader = /* glsl */ `
${SIMPLEX_NOISE}

attribute vec3 aPos0;
attribute vec3 aPos1;
attribute vec3 aPos2;
attribute vec3 aPos3;
attribute float aScale;
attribute float aSeed;

uniform float uTime;
uniform float uMorph;
uniform float uSize;
uniform float uPixelRatio;
uniform float uTurbulence;
uniform vec3  uCursor;
uniform float uCursorStrength;
uniform float uCursorRadius;
uniform vec3  uColorA;
uniform vec3  uColorB;

varying float vGlow;
varying vec3  vColor;

vec3 formationAt(float m) {
  float seg = clamp(m, 0.0, 3.0);
  float k = fract(seg);
  // smoothstep keeps the handover between formations from looking mechanical
  float t = k * k * (3.0 - 2.0 * k);
  float idx = floor(seg);

  vec3 a = aPos0;
  vec3 b = aPos1;
  if (idx >= 2.5) { a = aPos3; b = aPos3; }
  else if (idx >= 1.5) { a = aPos2; b = aPos3; }
  else if (idx >= 0.5) { a = aPos1; b = aPos2; }
  return mix(a, b, t);
}

void main() {
  vec3 home = formationAt(uMorph);

  // Slow organic drift so the field never looks frozen.
  float n = uTime * 0.08 + aSeed * 6.2831;
  vec3 flow = vec3(
    snoise(home * 0.18 + vec3(n, 0.0, 0.0)),
    snoise(home * 0.18 + vec3(0.0, n + 17.3, 0.0)),
    snoise(home * 0.18 + vec3(0.0, 0.0, n + 43.7))
  );
  vec3 pos = home + flow * uTurbulence;

  // Cursor pushes particles out of the way in world space.
  vec3 away = pos - uCursor;
  float dist = length(away);
  float push = 1.0 - smoothstep(0.0, uCursorRadius, dist);
  pos += normalize(away + 1e-4) * push * uCursorStrength;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float displaced = length(pos - home);
  vGlow = clamp(displaced * 0.55 + push * 1.2, 0.0, 1.6);
  vColor = mix(uColorA, uColorB, clamp(aSeed * 0.7 + vGlow * 0.5, 0.0, 1.0));

  gl_PointSize = uSize * aScale * uPixelRatio * (14.0 / max(-mvPosition.z, 0.001));
}
`;

export const particleFragmentShader = /* glsl */ `
precision mediump float;

uniform float uOpacity;

varying float vGlow;
varying vec3  vColor;

void main() {
  // Round sprite with a soft falloff. Cheaper and crisper than a texture.
  vec2 uv = gl_PointCoord - 0.5;
  float d = dot(uv, uv);
  if (d > 0.25) discard;

  float alpha = smoothstep(0.25, 0.0, d);
  // Additive blending stacks fast in dense regions; keeping the per-particle
  // contribution low is what stops the core blowing out to flat white.
  vec3 color = vColor + vGlow * 0.16;
  gl_FragColor = vec4(color, alpha * uOpacity);
}
`;
