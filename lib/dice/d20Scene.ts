import type { Quaternion } from "three";
import { MANA_HEX } from "../game/rules";
import { faceNormals, numberFaces, type Vec3 } from "./numbering";
import { GOLD, stoneFor } from "./palette";
import { buildRoll, samplePath, type Q } from "./rollPath";

export interface D20Options {
  /** Stone body color (already tinted for the seat). */
  color: string;
  /** Face to show immediately (restored roll), or null for the idle, unrolled pose. */
  value: number | null;
}

export interface D20Handle {
  /** Roll and land on `value`. The value was decided elsewhere; this only animates. */
  roll(value: number, onLanded: () => void): void;
  /** Static pose: `value` face-on, or the idle pose when null. */
  show(value: number | null): void;
  dispose(): void;
}

const CELL = 192; // atlas cell; faces are ~70-130 px on screen, so this stays crisp and is 44% smaller than 256
const K = CELL / 256; // the layout below is authored on a 256 grid
const COLS = 5;
const ROWS = 4;
const DIST = 5.2; // camera distance
const WALL_INSET_PX = 16; // the card frame the die bounces off
const MAX_PIXEL_RATIO = 1.5; // the die is soft-edged stone; 2x+ only costs fill rate

/* ───────────── warm resources, shared by every die on the page ───────────── */

let threeP: Promise<typeof import("three")> | null = null;
const loadThree = () => (threeP ??= import("three"));

let model: { normals: Vec3[]; values: number[] } | null = null;
async function getModel() {
  if (model) return model;
  const THREE = await loadThree();
  const g = new THREE.IcosahedronGeometry(1, 0);
  const normals = faceNormals(g.getAttribute("position").array);
  g.dispose();
  return (model = { normals, values: numberFaces(normals) });
}

let noiseTile: HTMLCanvasElement | null = null;
/** One small stone-grain tile, repeated as a pattern: ~20 fills instead of ~8,000 random flecks. */
function getNoiseTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d")!;
  for (let k = 0; k < 260; k++) {
    g.fillStyle = Math.random() < 0.5 ? "rgb(0 0 0 / 0.14)" : "rgb(255 240 210 / 0.07)";
    g.fillRect(Math.random() * 96, Math.random() * 96, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  return (noiseTile = c);
}

const atlasCache = new Map<string, HTMLCanvasElement>();
async function getAtlas(values: number[], color: string): Promise<HTMLCanvasElement> {
  const hit = atlasCache.get(color);
  if (hit) return hit;
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-cinzel").trim() ||
    "Georgia, serif";
  try {
    await document.fonts.load(`800 100px ${family}`);
  } catch {
    /* fall back to whatever resolves */
  }
  const c = document.createElement("canvas");
  c.width = CELL * COLS;
  c.height = CELL * ROWS;
  const g = c.getContext("2d")!;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const grain = g.createPattern(getNoiseTile(), "repeat")!;
  values.forEach((v, i) => {
    const x = (i % COLS) * CELL;
    const y = Math.floor(i / COLS) * CELL;
    g.fillStyle = color;
    g.fillRect(x, y, CELL, CELL);
    g.fillStyle = grain;
    g.fillRect(x, y, CELL, CELL);
    g.font = `800 ${(v >= 10 ? 100 : 120) * K}px ${family}`;
    const label = String(v);
    // engraved: dark cut offset down-right, gold fill, thin highlight on the lower lip
    g.fillStyle = "rgb(0 0 0 / 0.7)";
    g.fillText(label, x + 131 * K, y + 171 * K);
    g.fillStyle = GOLD;
    g.fillText(label, x + 128 * K, y + 168 * K);
    g.fillStyle = "rgb(255 236 180 / 0.25)";
    g.fillText(label, x + 128 * K, y + 166 * K);
    if (v === 6 || v === 9) {
      g.fillStyle = GOLD;
      g.fillRect(x + 104 * K, y + 226 * K, 48 * K, 8 * K); // underline, as on real dice
    }
  });
  atlasCache.set(color, c);
  return c;
}

let shadowCanvas: HTMLCanvasElement | null = null;
function getShadowCanvas(): HTMLCanvasElement {
  if (shadowCanvas) return shadowCanvas;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(48, 48, 3, 48, 48, 46);
  grad.addColorStop(0, "rgb(0 0 0 / 0.85)");
  grad.addColorStop(0.55, "rgb(0 0 0 / 0.4)");
  grad.addColorStop(1, "rgb(0 0 0 / 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 96, 96);
  return (shadowCanvas = c);
}

/**
 * Call while the player is still on the setup screen. Loads three.js, builds the
 * die model and the default seats' texture atlases, so the roll step opens with
 * nothing left to prepare.
 */
export async function warmUp(): Promise<void> {
  const { values } = await getModel();
  getShadowCanvas();
  for (const mana of ["R", "U", "G", "W"] as const) {
    await getAtlas(values, stoneFor(MANA_HEX[mana]));
    await new Promise((r) => setTimeout(r, 0)); // yield between atlases so input stays responsive
  }
}

/* ───────────── one die on one seat ───────────── */

export async function mountD20(host: HTMLElement, o: D20Options): Promise<D20Handle> {
  const [THREE, { normals, values }] = await Promise.all([loadThree(), getModel()]);

  // Geometry of the seat, in CSS px (layout sizes ignore the seat's rotation).
  const stage = host.parentElement as HTMLElement;
  const seat = (stage.offsetParent as HTMLElement | null) ?? stage;
  const sw = Math.max(80, seat.clientWidth);
  const sh = Math.max(80, seat.clientHeight);
  const unit = (0.72 * Math.min(stage.clientWidth, stage.clientHeight)) / 2; // px per die radius
  const dxPx = stage.offsetLeft + stage.clientWidth / 2 - sw / 2;
  const dyPx = stage.offsetTop + stage.clientHeight / 2 - sh / 2;
  const roomX = Math.max(0.3, (sw / 2 - WALL_INSET_PX - Math.abs(dxPx)) / unit - 1.05);
  const roomY = Math.max(0.3, (sh / 2 - WALL_INSET_PX - Math.abs(dyPx)) / unit - 1.05);

  // The canvas is only as big as the die's travel area, centered on its rest point
  // (the world origin). Fewer pixels to clear, shade and composite every frame.
  const halfW = Math.min((roomX + 1.15) * unit, sw / 2);
  const halfH = Math.min((roomY + 1.15) * unit, sh / 2);
  const cw = Math.round(halfW * 2);
  const ch = Math.round(halfH * 2);

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const renderer = new THREE.WebGLRenderer({
    antialias: dpr < 1.5, // MSAA only where pixels are big enough to need it
    alpha: true,
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(dpr);
  renderer.domElement.style.cssText = `position:absolute;left:${stage.clientWidth / 2 - cw / 2}px;top:${stage.clientHeight / 2 - ch / 2}px;pointer-events:none`;
  renderer.setSize(cw, ch);

  // ── model: icosahedron, one atlas cell per triangular face ──
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const pos = geo.getAttribute("position");
  const faceOf = (v: number) => values.indexOf(v);

  const uv = new Float32Array(pos.count * 2);
  const tri: [number, number][] = [
    [128, 22],
    [6, 233],
    [250, 233],
  ];
  for (let f = 0; f < 20; f++) {
    const ox = (f % COLS) * CELL;
    const oy = Math.floor(f / COLS) * CELL;
    tri.forEach(([px, py], k) => {
      const idx = (f * 3 + k) * 2;
      uv[idx] = (ox + px * K) / (CELL * COLS);
      uv[idx + 1] = 1 - (oy + py * K) / (CELL * ROWS);
    });
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  const atlas = await getAtlas(values, o.color);
  const map = new THREE.CanvasTexture(atlas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy());
  // Matte stone needs no PBR: Lambert has a much cheaper fragment shader and no shine.
  const mat = new THREE.MeshLambertMaterial({ map });
  const mesh = new THREE.Mesh(geo, mat);
  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(GOLD), transparent: true, opacity: 0.55 });
  mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));

  // soft contact shadow on the "table"; it spreads and fades as the die lifts
  const shadowMap = new THREE.CanvasTexture(getShadowCanvas());
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false });
  const shadowGeo = new THREE.PlaneGeometry(3, 3);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);

  const scene = new THREE.Scene();
  scene.add(shadow);
  scene.add(mesh);
  scene.add(new THREE.AmbientLight(0xfff4e0, 1.9));
  const key = new THREE.DirectionalLight(0xffe9c4, 2.6);
  key.position.set(-1.2, 3.6, 4.6); // near-overhead, like the spotlight on the table
  scene.add(key);

  const fov = (2 * Math.atan(ch / unit / 2 / DIST) * 180) / Math.PI;
  const camera = new THREE.PerspectiveCamera(fov, cw / ch, 0.1, 30);
  camera.position.set(0, 0, DIST);

  const zAxis = new THREE.Vector3(0, 0, 1);
  /** Orientation with `value` toward the camera and its number upright. */
  const restFor = (value: number): Quaternion => {
    const f = faceOf(value);
    const n = new THREE.Vector3(...normals[f]);
    const apex = new THREE.Vector3(pos.getX(f * 3), pos.getY(f * 3), pos.getZ(f * 3));
    const toCamera = new THREE.Quaternion().setFromUnitVectors(n, zAxis);
    const a2 = apex.clone().applyQuaternion(toCamera);
    const twist = new THREE.Quaternion().setFromAxisAngle(zAxis, Math.PI / 2 - Math.atan2(a2.y, a2.x));
    return twist.multiply(toCamera);
  };
  const idleQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, -0.6, 0.12));
  const current = new THREE.Quaternion();
  const toQ = (q: Quaternion): Q => [q.x, q.y, q.z, q.w];

  /** Place the die at an offset (die radii) from rest, `h` above the table. */
  const draw = (q: Quaternion | Q, ox = 0, oy = 0, h = 0) => {
    if (Array.isArray(q)) mesh.quaternion.set(q[0], q[1], q[2], q[3]);
    else mesh.quaternion.copy(q);
    mesh.position.set(ox, oy, h);
    shadow.position.set(ox + 0.12 + 0.3 * h, oy - 0.14 - 0.35 * h, -0.85);
    shadow.scale.setScalar(1 + 0.45 * h);
    shadowMat.opacity = 0.75 / (1 + 1.8 * h);
    renderer.render(scene, camera);
  };
  const rest = (q: Quaternion) => {
    current.copy(q);
    draw(q);
  };

  let raf = 0;
  let disposed = false;
  const stopAnim = () => cancelAnimationFrame(raf);

  const handle: D20Handle = {
    show(value) {
      stopAnim();
      rest(value == null ? idleQ : restFor(value));
    },

    roll(value, onLanded) {
      stopAnim();
      const target = restFor(value);
      // Cosmetic randomness only (direction, tumble axis). The landing face is `value`,
      // fixed before this runs, and the path is solved to end exactly on it.
      const path = buildRoll({ start: toQ(current), target: toQ(target), roomX, roomY });
      const t0 = performance.now();
      const frame = (now: number) => {
        if (disposed) return;
        const t = (now - t0) / (path.duration * 1000);
        if (t >= 1) {
          rest(target);
          onLanded();
          return;
        }
        const s = samplePath(path, t);
        draw(s.q, s.x, s.y, s.z);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    },

    dispose() {
      disposed = true;
      stopAnim();
      geo.dispose();
      edgeGeo.dispose();
      shadowGeo.dispose();
      mat.dispose();
      edgeMat.dispose();
      shadowMat.dispose();
      map.dispose();
      shadowMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };

  host.appendChild(renderer.domElement);
  handle.show(o.value);
  return handle;
}
