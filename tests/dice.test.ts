import { beforeEach, describe, expect, it } from "vitest";
import {
  advanceTie,
  applyRoll,
  clockwiseOrder,
  createDiceRoll,
  getTiedPlayers,
  resolveRound,
  rollDie,
  secureRandomInt,
} from "@/lib/game/dice";
import { STORAGE_KEY, createGameStore } from "@/lib/store/gameStore";

const ids4 = ["a", "b", "c", "d"];

describe("rollDie", () => {
  it("stays within 1..sides over many samples, and hits both ends", () => {
    for (const sides of [6, 20] as const) {
      const seen = new Set<number>();
      for (let i = 0; i < 20000; i++) {
        const v = rollDie(sides);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(sides);
        seen.add(v);
      }
      expect(seen.size).toBe(sides);
    }
  });

  it("is roughly uniform (chi-square sanity check, d20)", () => {
    const counts = new Array(20).fill(0);
    const n = 40000;
    for (let i = 0; i < n; i++) counts[rollDie(20) - 1]++;
    const expected = n / 20;
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi).toBeLessThan(60); // df=19; p~1e-5 at 60, so this never flakes in practice
  });

  it("rejects values that would bias the result (rejection sampling)", () => {
    // n=6: 2^32 % 6 = 4, so draws >= 2^32 - 4 must be rejected, then the next used.
    const draws = [0xffffffff, 0xfffffffc, 7];
    let i = 0;
    const fill = (a: Uint32Array) => {
      a[0] = draws[i++];
      return a;
    };
    expect(secureRandomInt(6, fill)).toBe(7 % 6);
    expect(i).toBe(3);
  });

  it("rejects invalid dice", () => {
    expect(() => rollDie(1)).toThrow();
    expect(() => rollDie(2.5)).toThrow();
  });
});

describe("getTiedPlayers / resolveRound", () => {
  it("2 players: highest roll wins", () => {
    expect(resolveRound({ a: 7, b: 15 }, ["a", "b"])).toEqual({ status: "done", winnerId: "b", tied: [] });
    expect(resolveRound({ a: 20, b: 3 }, ["a", "b"]).winnerId).toBe("a");
  });

  it("4 players: highest roll wins", () => {
    const r = resolveRound({ a: 4, b: 18, c: 9, d: 18 - 1 }, ids4);
    expect(r).toEqual({ status: "done", winnerId: "b", tied: [] });
  });

  it("waits until every contender has rolled", () => {
    expect(resolveRound({ a: 5 }, ["a", "b"]).status).toBe("rolling");
    expect(resolveRound({}, ["a", "b"]).status).toBe("rolling");
  });

  it("ties return only the tied leaders, not equal lower rolls", () => {
    const rolls = { a: 20, b: 20, c: 5, d: 5 };
    expect(getTiedPlayers(rolls)).toEqual(["a", "b"]);
    expect(resolveRound(rolls, ids4)).toEqual({ status: "tied", winnerId: null, tied: ["a", "b"] });
  });

  it("three-way tie for the top", () => {
    expect(getTiedPlayers({ a: 9, b: 9, c: 9, d: 2 })).toEqual(["a", "b", "c"]);
  });

  it("ignores locked players outside the round (a later tie round)", () => {
    // c locked at 15 from round 1; tied a,b re-rolled to 15 and 3. c must not tie with a.
    const rolls = { a: 15, b: 3, c: 15 };
    expect(getTiedPlayers(rolls)).toEqual(["a", "c"]); // naive view is wrong...
    expect(resolveRound(rolls, ["a", "b"])).toEqual({ status: "done", winnerId: "a", tied: [] }); // ...round view is right
  });
});

describe("a round of rolling", () => {
  const fresh = () => createDiceRoll(ids4, 20, true);

  it("a player cannot roll twice in one round", () => {
    const d = applyRoll(fresh(), "a", 10);
    expect(d.rolls).toEqual({ a: 10 });
    const again = applyRoll(d, "a", 20);
    expect(again).toBe(d); // same reference: rejected
    expect(again.rolls.a).toBe(10);
  });

  it("rejects unknown players, bad values, a closed step, and a finished round", () => {
    const d = fresh();
    expect(applyRoll(d, "zzz", 5)).toBe(d);
    expect(applyRoll(d, "a", 21)).toBe(d);
    expect(applyRoll(d, "a", 0)).toBe(d);
    const closed = { ...d, active: false };
    expect(applyRoll(closed, "a", 5)).toBe(closed);
    let done = fresh();
    for (const [i, id] of ids4.entries()) done = applyRoll(done, id, i + 1);
    expect(done.status).toBe("done");
    expect(applyRoll(done, "a", 9)).toBe(done);
  });

  it("goes idle -> rolling -> done with a winner", () => {
    let d = fresh();
    expect(d.status).toBe("idle");
    d = applyRoll(d, "a", 3);
    expect(d.status).toBe("rolling");
    d = applyRoll(d, "b", 12);
    d = applyRoll(d, "c", 7);
    d = applyRoll(d, "d", 1);
    expect(d).toMatchObject({ status: "done", winnerId: "b" });
  });

  it("tie: only the tied re-roll, others stay locked, and it repeats until resolved", () => {
    let d = fresh();
    d = applyRoll(d, "a", 20);
    d = applyRoll(d, "b", 20);
    d = applyRoll(d, "c", 11);
    d = applyRoll(d, "d", 2);
    expect(d.status).toBe("tied");
    expect(d.winnerId).toBeNull();

    d = advanceTie(d);
    expect(d).toMatchObject({ status: "idle", round: 2, contenders: ["a", "b"] });
    expect(d.rolls).toEqual({ c: 11, d: 2 }); // locked, kept

    expect(applyRoll(d, "c", 20)).toBe(d); // a locked player cannot roll
    d = applyRoll(d, "a", 8);
    d = applyRoll(d, "b", 8); // tie again
    expect(d.status).toBe("tied");
    d = advanceTie(d);
    expect(d).toMatchObject({ round: 3, contenders: ["a", "b"] });
    d = applyRoll(d, "a", 9);
    d = applyRoll(d, "b", 4);
    expect(d).toMatchObject({ status: "done", winnerId: "a" });
  });

  it("repeated ties always resolve eventually with real dice", () => {
    for (let trial = 0; trial < 300; trial++) {
      let d = createDiceRoll(ids4, 6, true); // d6 ties often: worst case for termination
      let guard = 0;
      while (d.status !== "done") {
        if (d.status === "tied") d = advanceTie(d);
        for (const id of d.contenders) d = applyRoll(d, id, rollDie(6));
        expect(++guard).toBeLessThan(200);
      }
      expect(ids4).toContain(d.winnerId);
    }
  });

  it("advanceTie is a no-op unless tied", () => {
    const d = fresh();
    expect(advanceTie(d)).toBe(d);
  });
});

describe("clockwiseOrder", () => {
  it("2 players", () => {
    expect(clockwiseOrder(0, 2)).toEqual([0, 1]);
    expect(clockwiseOrder(1, 2)).toEqual([1, 0]);
  });
  it("4 players run clockwise around the table (TL, TR, BR, BL)", () => {
    expect(clockwiseOrder(0, 4)).toEqual([0, 1, 3, 2]);
    expect(clockwiseOrder(3, 4)).toEqual([3, 2, 0, 1]);
    expect(clockwiseOrder(2, 4)).toEqual([2, 0, 1, 3]);
  });
});

/* ───────────── store integration ───────────── */

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  storage = memoryStorage();
});

describe("roll step in the store", () => {
  it("opens right after Begin, with Skip leaving no winner and no marker", () => {
    const s = createGameStore(storage);
    s.getState().startGame(2);
    expect(s.getState().diceRoll).toMatchObject({ active: true, status: "idle", sides: 20, round: 1 });
    s.getState().closeRoll();
    expect(s.getState().diceRoll.active).toBe(false);
    expect(s.getState().firstPlayerId).toBeNull();
  });

  it("decides the result in the store, once per player per round", () => {
    const s = createGameStore(storage);
    s.getState().startGame(2);
    const [a] = s.getState().players;
    expect(s.getState().rollFor(a.id)).toBe(true);
    const v = s.getState().diceRoll.rolls[a.id];
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(20);
    expect(s.getState().rollFor(a.id)).toBe(false);
    expect(s.getState().diceRoll.rolls[a.id]).toBe(v); // unchanged
  });

  it("completes a roll, records the first player, and closes with Start game", () => {
    const s = createGameStore(storage);
    s.getState().startGame(2);
    const [a, b] = s.getState().players;
    for (let guard = 0; s.getState().diceRoll.status !== "done"; guard++) {
      if (s.getState().diceRoll.status === "tied") s.getState().nextRound();
      for (const id of s.getState().diceRoll.contenders) s.getState().rollFor(id);
      expect(guard).toBeLessThan(500);
    }
    const { winnerId, rolls } = s.getState().diceRoll;
    expect(s.getState().firstPlayerId).toBe(winnerId);
    expect(rolls[winnerId!]).toBeGreaterThan(Math.min(rolls[a.id], rolls[b.id]) - 1);
    s.getState().closeRoll();
    expect(s.getState().diceRoll.active).toBe(false);
    expect(s.getState().firstPlayerId).toBe(winnerId); // marker kept for the game
  });

  it("Reroll all and switching dice restart the round", () => {
    const s = createGameStore(storage);
    s.getState().startGame(4);
    s.getState().rollFor(s.getState().players[0].id);
    s.getState().startRoll();
    expect(s.getState().diceRoll).toMatchObject({ round: 1, rolls: {}, status: "idle", active: true });
    s.getState().rollFor(s.getState().players[0].id);
    s.getState().setDiceSides(6);
    expect(s.getState().diceRoll).toMatchObject({ sides: 6, rolls: {}, status: "idle" });
    s.getState().rollFor(s.getState().players[1].id);
    expect(s.getState().diceRoll.rolls[s.getState().players[1].id]).toBeLessThanOrEqual(6);
  });

  it("a reload mid-roll restores the dice exactly", async () => {
    const first = createGameStore(storage);
    first.getState().startGame(4);
    const ps = first.getState().players;
    first.getState().rollFor(ps[0].id);
    first.getState().rollFor(ps[2].id);
    const before = first.getState().diceRoll;

    const reloaded = createGameStore(storage);
    await reloaded.persist.rehydrate();
    expect(reloaded.getState().diceRoll).toEqual(before);
    expect(reloaded.getState().diceRoll.active).toBe(true);
    // and the restored round keeps its rules
    expect(reloaded.getState().rollFor(ps[0].id)).toBe(false);
    expect(reloaded.getState().rollFor(ps[1].id)).toBe(true);
  });

  it("migrates a v1 save (no dice slice) without losing the game", async () => {
    storage.data.set(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          phase: "playing",
          mode: 2,
          startingLife: 20,
          layout4: "flip",
          players: [
            { id: "x", name: "A", color: "R", life: 13, counters: { poison: 0, energy: 0, experience: 0 }, commanderDamage: {} },
            { id: "y", name: "B", color: "U", life: 20, counters: { poison: 0, energy: 0, experience: 0 }, commanderDamage: {} },
          ],
          history: [],
          startedAt: 1,
        },
      }),
    );
    const s = createGameStore(storage);
    await s.persist.rehydrate();
    expect(s.getState().phase).toBe("playing");
    expect(s.getState().players[0].life).toBe(13);
    expect(s.getState().diceRoll.active).toBe(false);
    expect(s.getState().firstPlayerId).toBeNull();
  });
});
