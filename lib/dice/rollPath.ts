/**
 * Physically-motivated roll, shared by the 3D d20 (three.js) and the CSS d6.
 * Pure math, no rendering. The caller supplies the starting pose and the pose
 * that shows the already-decided result; this only decides how it gets there.
 *
 * What it models
 *  - The die is flung along a line, slows under friction, hits the tray wall,
 *    loses energy, and rolls back to the center where it stops.
 *  - Rolling without slipping: rotation is tied to distance travelled, about the
 *    axis (up x direction). Reverse direction after the wall and it rolls back.
 *  - It drops and bounces (restitution 0.6) and tumbles about a random axis while airborne.
 *  - A small correction rotation, eased in over the whole roll, makes it end on
 *    exactly the requested face. It is a fraction of the total spin, so it is invisible.
 *
 * Coordinates: x right, z toward the viewer, y whichever way the renderer
 * uses (the formulas are the same in both). Distances are in die radii.
 */
export type Q = [number, number, number, number]; // x, y, z, w (unit quaternion)

export const Q_IDENTITY: Q = [0, 0, 0, 1];

export function qMul(a: Q, b: Q): Q {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export const qConj = (q: Q): Q => [-q[0], -q[1], -q[2], q[3]];

export function qAxisAngle(axis: [number, number, number], angle: number): Q {
  const len = Math.hypot(...axis) || 1;
  const s = Math.sin(angle / 2) / len;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

export function qSlerp(a: Q, b: Q, t: number): Q {
  let [bx, by, bz, bw] = b;
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let k0: number;
  let k1: number;
  if (cos > 0.9995) {
    k0 = 1 - t;
    k1 = t;
  } else {
    const theta = Math.acos(cos);
    const sin = Math.sin(theta);
    k0 = Math.sin((1 - t) * theta) / sin;
    k1 = Math.sin(t * theta) / sin;
  }
  const q: Q = [k0 * a[0] + k1 * bx, k0 * a[1] + k1 * by, k0 * a[2] + k1 * bz, k0 * a[3] + k1 * bw];
  const n = Math.hypot(...q) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

export interface RollOptions {
  /** Pose when the roll begins (what is on screen now). */
  start: Q;
  /** Pose that shows the rolled face. The path ends exactly here. */
  target: Q;
  /** Free travel from the rest point to the tray wall, in die radii. */
  roomX: number;
  roomY: number;
  rng?: () => number;
  /** Seconds. */
  duration?: number;
  samples?: number;
}

export interface RollPath {
  duration: number;
  count: number;
  /** Offsets from the rest point, in die radii. z is height toward the viewer. */
  x: number[];
  y: number[];
  z: number[];
  q: Q[];
}

const ROLL_RADIUS = 0.6; // a bit under the real ~0.85: an irregular die turns faster than a ball per distance
const WALL_RESTITUTION = 0.6;
const BOUNCE_RESTITUTION = 0.6;
const DROP_HEIGHT = 0.9;
const smooth = (t: number) => t * t * (3 - 2 * t);

export function buildRoll(o: RollOptions): RollPath {
  const rng = o.rng ?? Math.random;
  const N = Math.max(8, o.samples ?? 72);
  const T = o.duration ?? 1.15;

  // Direction: prefer the axis with more room, with some randomness.
  let phi = 0;
  let room = 0;
  let bestScore = -1;
  for (let k = 0; k < 24; k++) {
    const p = rng() * Math.PI * 2;
    const c = Math.abs(Math.cos(p));
    const s = Math.abs(Math.sin(p));
    const L = Math.min(c > 1e-6 ? o.roomX / c : Infinity, s > 1e-6 ? o.roomY / s : Infinity);
    const score = L * (0.6 + 0.8 * rng());
    if (score > bestScore) {
      bestScore = score;
      phi = p;
      room = L;
    }
  }
  const dx = Math.cos(phi);
  const dy = Math.sin(phi);
  const A = Math.max(0.4, room * 0.92); // out-and-back distance to the wall

  // Friction (constant deceleration, a = 1 in normalized time). Pick the launch
  // speed so that after the wall rebound the die stops exactly at the rest point.
  const e = WALL_RESTITUTION;
  const v1 = Math.sqrt(2 * A * (1 + 1 / (e * e)));
  const vWall = Math.sqrt(v1 * v1 - 2 * A);
  const v2 = e * vWall;
  const tOut = v1 - vWall;
  const tBack = v2;
  const total = tOut + tBack;
  const along = (t: number) => {
    const n = (t / T) * total;
    if (n <= tOut) return v1 * n - (n * n) / 2;
    const u = Math.min(n - tOut, tBack);
    return A - v2 * u + (u * u) / 2;
  };

  // Drop and decaying bounces; the series fills the duration.
  let sum = 1;
  for (let k = 1; k <= 8; k++) sum += 2 * Math.pow(BOUNCE_RESTITUTION, k);
  const t0 = T / sum;
  const height = (t: number) => {
    if (t < t0) return DROP_HEIGHT * (1 - (t / t0) ** 2);
    let start = t0;
    for (let k = 1; k <= 8; k++) {
      const d = 2 * t0 * Math.pow(BOUNCE_RESTITUTION, k);
      if (t < start + d) {
        const x = (t - start) / (d / 2) - 1;
        return DROP_HEIGHT * Math.pow(BOUNCE_RESTITUTION, 2 * k) * (1 - x * x);
      }
      start += d;
    }
    return 0;
  };

  const airAxis: [number, number, number] = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
  if (Math.hypot(...airAxis) < 0.05) airAxis[0] = 1;
  const rollAxis: [number, number, number] = [-dy, dx, 0]; // up x direction

  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const spin: Q[] = [];
  let R: Q = Q_IDENTITY;
  let prevS = 0;
  let prevZ = height(0);

  for (let i = 0; i < N; i++) {
    const t = (T * i) / (N - 1);
    const last = i === N - 1;
    const s = last ? 0 : along(t);
    const z = last ? 0 : height(t);
    if (i > 0) {
      R = qMul(qAxisAngle(rollAxis, (s - prevS) / ROLL_RADIUS), R);
      if (z > 0.02 && prevZ > 0.02) {
        R = qMul(qAxisAngle(airAxis, 15 * (1 - t / T) * (T / (N - 1))), R);
      }
    }
    spin.push(R);
    xs.push(dx * s);
    ys.push(dy * s);
    zs.push(z);
    prevS = s;
    prevZ = z;
  }

  // Land on the requested face: spread the leftover rotation across the whole roll.
  const endPose = qMul(spin[N - 1], o.start);
  const fix = qMul(o.target, qConj(endPose));
  const q = spin.map((r, i) => {
    const corr = qSlerp(Q_IDENTITY, fix, smooth(i / (N - 1)));
    return qMul(corr, qMul(r, o.start));
  });
  q[N - 1] = o.target;

  return { duration: T, count: N, x: xs, y: ys, z: zs, q };
}

/** Interpolated sample at normalized time t in [0,1]. */
export function samplePath(p: RollPath, t: number) {
  const f = Math.min(1, Math.max(0, t)) * (p.count - 1);
  const i = Math.min(p.count - 2, Math.floor(f));
  const u = f - i;
  const lerp = (a: number[]) => a[i] + (a[i + 1] - a[i]) * u;
  return { x: lerp(p.x), y: lerp(p.y), z: lerp(p.z), q: qSlerp(p.q[i], p.q[i + 1], u) };
}
