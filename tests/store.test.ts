import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY, createGameStore } from "@/lib/store/gameStore";

/** In-memory stand-in for localStorage, shared across "reloads" within a test. */
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

describe("game store", () => {
  it("starts a game with defaults per mode", () => {
    const s = createGameStore(storage);
    s.getState().startGame(4);
    expect(s.getState().players).toHaveLength(4);
    expect(s.getState().players.every((p) => p.life === 40)).toBe(true);
    s.getState().startGame(2);
    expect(s.getState().players.map((p) => p.life)).toEqual([20, 20]);
  });

  it("honours a custom starting life", () => {
    const s = createGameStore(storage);
    s.getState().startGame(2, 30);
    expect(s.getState().startingLife).toBe(30);
    expect(s.getState().players[0].life).toBe(30);
  });

  it("changes only the targeted player and logs an event", () => {
    const s = createGameStore(storage);
    s.getState().startGame(2);
    const [a, b] = s.getState().players;
    s.getState().changeLife(a.id, -3);
    const after = s.getState();
    expect(after.players[0].life).toBe(17);
    expect(after.players[1]).toBe(b); // same reference: other panels do not re-render
    expect(after.history).toHaveLength(1);
    expect(after.history[0]).toMatchObject({ playerId: a.id, delta: -3 });
  });

  it("undoes the last change, including out of a defeat", () => {
    const s = createGameStore(storage);
    s.getState().startGame(2);
    const a = s.getState().players[0];
    s.getState().changeLife(a.id, -20);
    expect(s.getState().players[0].life).toBe(0);
    s.getState().undoLast(a.id);
    expect(s.getState().players[0].life).toBe(20);
    expect(s.getState().history).toHaveLength(0);
  });

  it("resets totals but keeps names and colors", () => {
    const s = createGameStore(storage);
    s.getState().startGame(2);
    const a = s.getState().players[0];
    s.getState().rename(a.id, "Jace");
    s.getState().recolor(a.id, "U");
    s.getState().changeLife(a.id, -7);
    s.getState().resetGame();
    expect(s.getState().players[0]).toMatchObject({ name: "Jace", color: "U", life: 20 });
    expect(s.getState().history).toEqual([]);
  });

  it("returns to mode select and clears the game", () => {
    const s = createGameStore(storage);
    s.getState().startGame(2);
    s.getState().backToSelect();
    expect(s.getState().phase).toBe("select");
    expect(s.getState().players).toEqual([]);
  });
});

describe("state restore", () => {
  it("restores a game in progress after a simulated reload", async () => {
    const first = createGameStore(storage);
    first.getState().startGame(4);
    const p = first.getState().players[2];
    first.getState().changeLife(p.id, -12);
    first.getState().setLayout4("sides");

    const reloaded = createGameStore(storage);
    expect(reloaded.getState().phase).toBe("select"); // nothing until rehydrate
    await reloaded.persist.rehydrate();

    const s = reloaded.getState();
    expect(s.phase).toBe("playing");
    expect(s.mode).toBe(4);
    expect(s.layout4).toBe("sides");
    expect(s.players[2].life).toBe(28);
    expect(s.history).toHaveLength(1);
  });

  it("does not persist actions, only state", () => {
    const s = createGameStore(storage);
    s.getState().startGame(2);
    const saved = JSON.parse(storage.data.get(STORAGE_KEY)!);
    expect(saved.version).toBe(2);
    expect(Object.keys(saved.state).sort()).toEqual(
      ["diceRoll", "firstPlayerId", "history", "layout4", "mode", "phase", "players", "startedAt", "startingLife"].sort(),
    );
  });

  it("starts clean when storage is empty or corrupt", async () => {
    storage.data.set(STORAGE_KEY, "{not json");
    const s = createGameStore(storage);
    await s.persist.rehydrate();
    expect(s.getState().phase).toBe("select");
  });
});
