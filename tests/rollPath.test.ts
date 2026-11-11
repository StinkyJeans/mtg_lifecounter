import { describe, expect, it } from "vitest";
import {
  Q_IDENTITY,
  buildRoll,
  qAxisAngle,
  qConj,
  qMul,
  qSlerp,
  samplePath,
  type Q,
} from "@/lib/dice/rollPath";

/** Deterministic rng so a failure is reproducible. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const norm = (q: Q) => Math.hypot(...q);
/** Angle between two orientations, radians. */
const angleBetween = (a: Q, b: Q) => 2 * Math.acos(Math.min(1, Math.abs(qMul(a, qConj(b))[3])));

const start = qAxisAngle([0.3, 1, 0.2], 0.7);
const target = qAxisAngle([1, -0.4, 0.5], 2.1);

describe("quaternion helpers", () => {
  it("rotation then its inverse is identity", () => {
    const q = qAxisAngle([1, 2, 3], 1.234);
    const r = qMul(q, qConj(q));
    expect(r[3]).toBeCloseTo(1, 10);
    expect(Math.hypot(r[0], r[1], r[2])).toBeCloseTo(0, 10);
  });

  it("slerp hits both ends and stays unit length", () => {
    const a = qAxisAngle([0, 1, 0], 0.2);
    const b = qAxisAngle([1, 0, 0], 2.5);
    expect(angleBetween(qSlerp(a, b, 0), a)).toBeCloseTo(0, 6);
    expect(angleBetween(qSlerp(a, b, 1), b)).toBeCloseTo(0, 6);
    expect(norm(qSlerp(a, b, 0.37))).toBeCloseTo(1, 10);
  });
});

describe("buildRoll", () => {
  const run = (seed: number, roomX = 1.6, roomY = 2.4) =>
    buildRoll({ start, target, roomX, roomY, rng: seeded(seed) });

  it("starts at the current pose, at rest position, and lands exactly on the target face", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = run(seed);
      expect(angleBetween(p.q[0], start)).toBeLessThan(0.05); // continuous at launch
      expect(angleBetween(p.q[p.count - 1], target)).toBeLessThan(1e-9); // exact landing
      expect(p.x[p.count - 1]).toBeCloseTo(0, 9);
      expect(p.y[p.count - 1]).toBeCloseTo(0, 9);
      expect(p.z[p.count - 1]).toBe(0);
    }
  });

  it("the result never depends on the animation randomness", () => {
    const ends = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const p = run(seed * 7919);
      ends.add(p.q[p.count - 1].map((v) => v.toFixed(9)).join(","));
    }
    expect(ends.size).toBe(1);
  });

  it("stays inside the tray, never goes below the table, and does bounce", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = run(seed, 1.6, 2.4);
      let maxZ = 0;
      for (let i = 0; i < p.count; i++) {
        expect(Math.abs(p.x[i])).toBeLessThanOrEqual(1.6 + 1e-6);
        expect(Math.abs(p.y[i])).toBeLessThanOrEqual(2.4 + 1e-6);
        expect(p.z[i]).toBeGreaterThanOrEqual(-1e-9);
        maxZ = Math.max(maxZ, p.z[i]);
      }
      expect(maxZ).toBeGreaterThan(0.5); // dropped from a real height
    }
  });

  it("rolls out, hits the wall, and comes back (moves away then returns)", () => {
    const p = run(42);
    const dist = p.x.map((x, i) => Math.hypot(x, p.y[i]));
    const peak = Math.max(...dist);
    const peakAt = dist.indexOf(peak);
    expect(peak).toBeGreaterThan(0.8);
    expect(peakAt).toBeGreaterThan(2);
    expect(peakAt).toBeLessThan(p.count - 8);
    expect(dist[p.count - 1]).toBeCloseTo(0, 9);
  });

  it("rotation is smooth: no jump between consecutive samples", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = run(seed);
      for (let i = 1; i < p.count; i++) {
        expect(angleBetween(p.q[i - 1], p.q[i])).toBeLessThan(1.1); // < ~63 degrees per ~16 ms step
      }
    }
  });

  it("really rolls: it turns several revolutions over the path", () => {
    let total = 0;
    const p = run(5);
    for (let i = 1; i < p.count; i++) total += angleBetween(p.q[i - 1], p.q[i]);
    expect(total).toBeGreaterThan(2 * Math.PI * 1.5);
  });

  it("rolling is tied to distance travelled (rolls without slipping)", () => {
    // Out and back along the same line: the roll axis flips with the direction.
    const p = buildRoll({ start: Q_IDENTITY, target: Q_IDENTITY, roomX: 3, roomY: 3, rng: seeded(9), samples: 200 });
    const dist = p.x.map((x, i) => Math.hypot(x, p.y[i]));
    const wall = dist.indexOf(Math.max(...dist));
    expect(wall).toBeGreaterThan(5);
    expect(dist[wall]).toBeGreaterThan(dist[wall - 5]);
    expect(dist[wall]).toBeGreaterThan(dist[Math.min(p.count - 1, wall + 5)]);
  });

  it("tolerates a cramped tray (narrow seat)", () => {
    const p = buildRoll({ start, target, roomX: 0.3, roomY: 0.3, rng: seeded(3) });
    expect(angleBetween(p.q[p.count - 1], target)).toBeLessThan(1e-9);
    expect(samplePath(p, 0.5).z).toBeGreaterThanOrEqual(0);
  });

  it("samplePath interpolates and clamps", () => {
    const p = run(11);
    const s0 = samplePath(p, -1);
    const s1 = samplePath(p, 2);
    expect(angleBetween(s0.q, p.q[0])).toBeLessThan(1e-9);
    expect(angleBetween(s1.q, target)).toBeLessThan(1e-9);
    const mid = samplePath(p, 0.5);
    expect(norm(mid.q)).toBeCloseTo(1, 9);
  });
});
