/**
 * Four "home" layouts the particle field morphs between as you scroll.
 * Each returns a flat xyz Float32Array of length count * 3.
 */

type Formation = (count: number) => Float32Array;

/** Deterministic PRNG so every reload produces the identical field. */
function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Loose spiral disc. The opening view: wide, slow, and non-competing with text. */
const galaxy: Formation = (count) => {
  const out = new Float32Array(count * 3);
  const rand = makeRandom(0x5eed);
  const arms = 4;
  const radius = 13;
  const spin = 1.15;

  for (let i = 0; i < count; i++) {
    // pow < 1 biases toward the rim, which keeps the core from turning into a blob
    const r = Math.pow(rand(), 0.62) * radius;
    const armAngle = ((i % arms) / arms) * Math.PI * 2;
    const angle = armAngle + r * spin;

    // Scatter tightens toward the centre so the arms stay legible outward.
    const spread = 0.55 + r * 0.075;
    const sx = (rand() + rand() + rand() - 1.5) * spread;
    const sy = (rand() + rand() + rand() - 1.5) * spread * 0.32;
    const sz = (rand() + rand() + rand() - 1.5) * spread;

    out[i * 3 + 0] = Math.cos(angle) * r + sx;
    out[i * 3 + 1] = sy;
    out[i * 3 + 2] = Math.sin(angle) * r + sz;
  }
  return out;
};

/** Even shell via the Fibonacci sphere, with a little thickness. */
const sphere: Formation = (count) => {
  const out = new Float32Array(count * 3);
  const rand = makeRandom(0xbeef);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const radius = 7.4;

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const r = radius * (0.94 + rand() * 0.12);

    out[i * 3 + 0] = Math.cos(theta) * ring * r;
    out[i * 3 + 1] = y * r;
    out[i * 3 + 2] = Math.sin(theta) * ring * r;
  }
  return out;
};

/** (2,3) torus knot, particles scattered through the tube volume. */
const torusKnot: Formation = (count) => {
  const out = new Float32Array(count * 3);
  const rand = makeRandom(0xc0ffee);
  const p = 2;
  const q = 3;
  const R = 6.2;
  const tube = 1.6;

  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2 * q;

    const cu = Math.cos(t);
    const su = Math.sin(t);
    const quOverP = (q / p) * t;
    const cs = Math.cos(quOverP);

    const cx = R * (2 + cs) * 0.5 * cu;
    const cy = R * (2 + cs) * 0.5 * su;
    const cz = R * Math.sin(quOverP) * 0.5;

    // Random point in a ball around the curve gives the tube its volume.
    const rr = Math.cbrt(rand()) * tube;
    const phi = rand() * Math.PI * 2;
    const cosTheta = rand() * 2 - 1;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);

    out[i * 3 + 0] = cx + rr * sinTheta * Math.cos(phi);
    out[i * 3 + 1] = cy + rr * sinTheta * Math.sin(phi);
    out[i * 3 + 2] = cz + rr * cosTheta;
  }
  return out;
};

/** Interference wave grid. Reads as a landscape under the last section. */
const wave: Formation = (count) => {
  const out = new Float32Array(count * 3);
  const side = Math.ceil(Math.sqrt(count));
  const extent = 22;

  for (let i = 0; i < count; i++) {
    const gx = i % side;
    const gz = Math.floor(i / side);
    const x = (gx / (side - 1) - 0.5) * extent;
    const z = (gz / (side - 1) - 0.5) * extent;
    const d = Math.sqrt(x * x + z * z);

    const y =
      Math.sin(x * 0.55) * 0.85 +
      Math.cos(z * 0.48) * 0.85 +
      Math.sin(d * 0.9) * 1.5;

    out[i * 3 + 0] = x;
    out[i * 3 + 1] = y - 1.5;
    out[i * 3 + 2] = z;
  }
  return out;
};

export const formations: Formation[] = [galaxy, sphere, torusKnot, wave];

/** Per-formation camera distance and palette, blended the same way positions are. */
export const formationLooks = [
  { distance: 20, colorA: "#3b82f6", colorB: "#a855f7" },
  { distance: 17, colorA: "#22d3ee", colorB: "#6366f1" },
  { distance: 18, colorA: "#f472b6", colorB: "#818cf8" },
  { distance: 21, colorA: "#34d399", colorB: "#38bdf8" },
] as const;
