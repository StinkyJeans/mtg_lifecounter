import { describe, expect, it } from "vitest";
import {
  MAX_LIFE,
  MIN_LIFE,
  applyLifeDelta,
  clampLife,
  createPlayers,
  defaultStartingLife,
  defeatReason,
  isDefeated,
  winner,
} from "@/lib/game/rules";

let n = 0;
const ids = () => `p${n++}`;
const mk = (life: number) => ({ ...createPlayers(2, 20, ids)[0], life });

describe("life math", () => {
  it("defaults to 20 for two players and 40 for four", () => {
    expect(defaultStartingLife(2)).toBe(20);
    expect(defaultStartingLife(4)).toBe(40);
  });

  it("applies positive and negative deltas", () => {
    expect(applyLifeDelta(mk(20), -1).life).toBe(19);
    expect(applyLifeDelta(mk(20), 5).life).toBe(25);
  });

  it("goes below zero (defeat is a state, not a floor)", () => {
    expect(applyLifeDelta(mk(2), -5).life).toBe(-3);
  });

  it("clamps to the supported range and truncates fractions", () => {
    expect(clampLife(1e9)).toBe(MAX_LIFE);
    expect(clampLife(-1e9)).toBe(MIN_LIFE);
    expect(clampLife(7.9)).toBe(7);
  });

  it("returns the same reference when nothing changes", () => {
    const p = mk(20);
    expect(applyLifeDelta(p, 0)).toBe(p);
    expect(applyLifeDelta(mk(MAX_LIFE), 1).life).toBe(MAX_LIFE);
  });

  it("does not mutate the input", () => {
    const p = mk(20);
    applyLifeDelta(p, -3);
    expect(p.life).toBe(20);
  });
});

describe("win and loss rules", () => {
  it("is defeated at 0 or less life", () => {
    expect(isDefeated(mk(1))).toBe(false);
    expect(defeatReason(mk(0))).toBe("life");
    expect(defeatReason(mk(-4))).toBe("life");
  });

  it("is defeated at 10 poison counters", () => {
    const p = mk(20);
    expect(isDefeated({ ...p, counters: { ...p.counters, poison: 9 } })).toBe(false);
    expect(defeatReason({ ...p, counters: { ...p.counters, poison: 10 } })).toBe("poison");
  });

  it("is defeated at 21 damage from a single commander, not cumulative", () => {
    const p = mk(40);
    expect(isDefeated({ ...p, commanderDamage: { a: 20, b: 20 } })).toBe(false);
    expect(defeatReason({ ...p, commanderDamage: { a: 21 } })).toBe("commander");
  });

  it("finds a winner only when exactly one player is left", () => {
    const [a, b] = createPlayers(2, 20, ids);
    expect(winner([a, b])).toBeNull();
    expect(winner([a, { ...b, life: 0 }])?.id).toBe(a.id);
    expect(winner([{ ...a, life: 0 }, { ...b, life: 0 }])).toBeNull();
  });
});

import { faceNormals, numberFaces } from "@/lib/dice/numbering";
import { IcosahedronGeometry } from "three";

describe("d20 numbering", () => {
  const normals = faceNormals(new IcosahedronGeometry(1, 0).getAttribute("position").array);
  const values = numberFaces(normals);

  it("has 20 faces numbered 1..20 exactly once", () => {
    expect(normals).toHaveLength(20);
    expect([...values].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("puts opposite faces on sum-21 pairs, like a real die", () => {
    normals.forEach((n, i) => {
      const j = normals.findIndex((m, k) => k !== i && n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < -0.99);
      expect(values[i] + values[j]).toBe(21);
    });
  });
});
