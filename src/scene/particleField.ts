import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Plane,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { formationLooks, formations } from "./formations";
import { particleFragmentShader, particleVertexShader } from "./shaders";

const MAX_MORPH = formations.length - 1;

/** Frame-rate independent damping. `rate` is roughly "fraction closed per 60fps frame". */
function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.pow(1 - rate, dt * 60));
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

/**
 * Particle budget scaled to the device. A phone GPU chokes long before a
 * desktop one does, and the field reads fine at a third of the count.
 */
function particleBudget(): number {
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (width < 700) return 24_000;
  if (width < 1200 || cores <= 4) return 60_000;
  return 130_000;
}

export type ParticleFieldHandle = {
  /** 0 at the top of the page, 1 at the bottom. */
  setScrollProgress(progress: number): void;
  dispose(): void;
};

export function createParticleField(
  canvas: HTMLCanvasElement,
): ParticleFieldHandle | null {
  if (!supportsWebGL()) return null;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const count = reducedMotion ? 40_000 : particleBudget();

  // ---- geometry -----------------------------------------------------------
  const geometry = new BufferGeometry();
  const targets = formations.map((build) => build(count));

  // three needs `position` for its bounding sphere; the shader ignores it.
  geometry.setAttribute("position", new BufferAttribute(targets[0].slice(), 3));
  targets.forEach((data, i) => {
    geometry.setAttribute(`aPos${i}`, new BufferAttribute(data, 3));
  });

  const scales = new Float32Array(count);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Squared random keeps most particles small with a few bright standouts.
    const r = Math.random();
    scales[i] = 0.45 + r * r * 1.8;
    seeds[i] = Math.random();
  }
  geometry.setAttribute("aScale", new BufferAttribute(scales, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));

  // ---- material -----------------------------------------------------------
  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uSize: { value: 2.6 },
    uPixelRatio: { value: 1 },
    uTurbulence: { value: reducedMotion ? 0.12 : 0.55 },
    uCursor: { value: new Vector3(9999, 9999, 9999) },
    uCursorStrength: { value: 0 },
    uCursorRadius: { value: 3.4 },
    uColorA: { value: new Color(formationLooks[0].colorA) },
    uColorB: { value: new Color(formationLooks[0].colorB) },
    uOpacity: { value: 0 },
  };

  const material = new ShaderMaterial({
    uniforms,
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;

  const scene = new Scene();
  scene.add(points);

  // ---- renderer -----------------------------------------------------------
  const camera = new PerspectiveCamera(
    52,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  camera.position.set(0, 2.2, formationLooks[0].distance);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Restrained on purpose: body copy sits on top of this, and anything
  // stronger turns dense regions into an unreadable white wash.
  const bloom = new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    0.34, // strength
    0.55, // radius
    0.36, // threshold
  );
  composer.addPass(bloom);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Bloom is fill-rate bound, so cap DPR rather than rendering 3x on phones.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    bloom.setSize(width, height);

    uniforms.uPixelRatio.value = dpr;
    uniforms.uSize.value = width < 700 ? 3.4 : 2.6;
  }
  resize();

  // ---- input --------------------------------------------------------------
  const pointerNdc = new Vector2(0, 0);
  let pointerActive = false;
  const cursorLocal = new Vector3(9999, 9999, 9999);
  const cursorTarget = new Vector3(9999, 9999, 9999);

  const raycaster = new Raycaster();
  // A plane through the origin facing the camera. Intersecting the pointer ray
  // with it gives the world point the cursor is actually over, at the depth the
  // field sits at.
  const focalPlane = new Plane();
  const cameraForward = new Vector3();

  function onPointerMove(event: PointerEvent) {
    pointerNdc.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -((event.clientY / window.innerHeight) * 2 - 1);
    pointerActive = true;
  }
  function onPointerLeave() {
    pointerActive = false;
  }

  // Touch devices get the drift and morph but no cursor repulsion.
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  if (!isCoarsePointer) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
  }
  window.addEventListener("resize", resize);

  // ---- state --------------------------------------------------------------
  let scrollTarget = 0;
  let scrollCurrent = 0;
  let running = true;
  let frame = 0;
  let last = performance.now();
  let elapsed = 0;

  const colorA = new Color(formationLooks[0].colorA);
  const colorB = new Color(formationLooks[0].colorB);
  const targetA = new Color();
  const targetB = new Color();
  const scratch = new Color();

  function onVisibility() {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(frame);
    } else if (!running) {
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  function tick(now: number) {
    frame = requestAnimationFrame(tick);

    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += reducedMotion ? dt * 0.25 : dt;

    scrollCurrent = damp(scrollCurrent, scrollTarget, 0.08, dt);
    const morph = scrollCurrent * MAX_MORPH;

    uniforms.uTime.value = elapsed;
    uniforms.uMorph.value = morph;
    uniforms.uOpacity.value = damp(uniforms.uOpacity.value, 0.6, 0.03, dt);

    // Blend the look of the two formations we sit between.
    const lower = Math.min(Math.floor(morph), MAX_MORPH);
    const upper = Math.min(lower + 1, MAX_MORPH);
    const blend = morph - lower;
    const a = formationLooks[lower];
    const b = formationLooks[upper];

    targetA.set(a.colorA).lerp(scratch.set(b.colorA), blend);
    targetB.set(a.colorB).lerp(scratch.set(b.colorB), blend);
    colorA.lerp(targetA, 0.06);
    colorB.lerp(targetB, 0.06);
    uniforms.uColorA.value.copy(colorA);
    uniforms.uColorB.value.copy(colorB);

    // Camera dollies out and drifts down as the page advances.
    const targetDistance = a.distance + (b.distance - a.distance) * blend;
    camera.position.z = damp(camera.position.z, targetDistance, 0.05, dt);
    camera.position.y = damp(
      camera.position.y,
      2.2 - scrollCurrent * 1.6 + (pointerActive ? pointerNdc.y * 0.9 : 0),
      0.04,
      dt,
    );
    camera.position.x = damp(
      camera.position.x,
      pointerActive ? pointerNdc.x * 1.4 : 0,
      0.04,
      dt,
    );
    camera.lookAt(0, 0, 0);

    /**
     * Below the hero every section puts its copy in a left column, so the
     * field slides right to sit beside the text rather than under it. The
     * hero is the one place the two are meant to overlap.
     */
    const clearance = Math.min(scrollCurrent / 0.14, 1);
    points.position.x = damp(
      points.position.x,
      clearance * clearance * (3 - 2 * clearance) * 5.5,
      0.05,
      dt,
    );

    if (!reducedMotion) {
      points.rotation.y = elapsed * 0.035 + scrollCurrent * 0.9;
      points.rotation.x = Math.sin(elapsed * 0.08) * 0.06;
    }

    /**
     * Cursor repulsion, resolved last so it uses this frame's camera and mesh
     * transforms rather than the previous frame's.
     *
     * The shader compares `uCursor` against positions in the mesh's own local
     * space, but the mesh is rotated every frame and slid sideways on scroll.
     * Raycasting to a plane through the field and then converting the hit with
     * `worldToLocal` is what keeps the push centred under the pointer instead
     * of drifting off to one side.
     */
    if (pointerActive) {
      camera.updateMatrixWorld();
      points.updateMatrixWorld();

      camera.getWorldDirection(cameraForward);
      focalPlane.setFromNormalAndCoplanarPoint(cameraForward, points.position);

      raycaster.setFromCamera(pointerNdc, camera);
      if (raycaster.ray.intersectPlane(focalPlane, cursorTarget)) {
        points.worldToLocal(cursorTarget);
        cursorLocal.lerp(cursorTarget, 0.22);
        uniforms.uCursor.value.copy(cursorLocal);
      }

      uniforms.uCursorStrength.value = damp(
        uniforms.uCursorStrength.value,
        reducedMotion ? 0 : 1.9,
        0.06,
        dt,
      );
    } else {
      uniforms.uCursorStrength.value = damp(
        uniforms.uCursorStrength.value,
        0,
        0.06,
        dt,
      );
    }

    composer.render();
  }

  frame = requestAnimationFrame(tick);

  return {
    setScrollProgress(progress: number) {
      scrollTarget = Math.min(Math.max(progress, 0), 1);
    },
    dispose() {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      geometry.dispose();
      material.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
