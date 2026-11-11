import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import {
  applyLifeDelta,
  clampLife,
  createPlayers,
  defaultStartingLife,
  emptyCounters,
} from "../game/rules";
import { advanceTie, applyRoll, createDiceRoll, rollDie } from "../game/dice";
import type {
  DiceRoll,
  DieSides,
  GameMode,
  GameState,
  Layout4,
  LifeEvent,
  ManaColor,
} from "../game/types";

export const STORAGE_KEY = "mtg-life:v1";
const STORE_VERSION = 2;
const HISTORY_CAP = 500;

export interface GameActions {
  /** `roll: false` goes straight to the life counter; the default opens the optional roll step. */
  startGame(mode: GameMode, startingLife?: number, options?: { roll?: boolean }): void;
  /** Back to a saved game that is on the setup screen (players exist, phase is select). */
  resumeGame(): void;
  /** Same mode and life, fresh totals (names and colors kept). */
  resetGame(): void;
  backToSelect(): void;
  changeLife(playerId: string, delta: number): void;
  /** Reverts the most recent life event for a player. */
  undoLast(playerId: string): void;
  rename(playerId: string, name: string): void;
  recolor(playerId: string, color: ManaColor): void;
  setLayout4(layout: Layout4): void;

  // ── roll for first player ──
  /** Opens the step with a fresh round (also used by "Reroll all" and the menu). */
  startRoll(): void;
  /** Switches d20/d6; restarts the round. */
  setDiceSides(sides: DieSides): void;
  /**
   * Rolls one player's die, once per round. The value is decided here, before any
   * animation. Returns false when the roll is not allowed (already rolled, etc).
   */
  rollFor(playerId: string): boolean;
  /** After a tie: clears only the tied dice and starts the next round. */
  nextRound(): void;
  /** Start game (after a winner) or Skip (no winner, no marker). Closes the step. */
  closeRoll(): void;
}

export type GameStore = GameState & GameActions;

const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const idleRoll: DiceRoll = createDiceRoll([], 20, false);

const initial: GameState = {
  phase: "select",
  mode: 2,
  startingLife: 20,
  layout4: "flip",
  players: [],
  history: [],
  diceRoll: idleRoll,
  firstPlayerId: null,
  startedAt: null,
};

export function createGameStore(storage?: StateStorage) {
  return createStore<GameStore>()(
    persist(
      (set, get) => ({
        ...initial,

        startGame(mode, startingLife, options) {
          const life = clampLife(startingLife ?? defaultStartingLife(mode));
          const players = createPlayers(mode, life, uid);
          set({
            phase: "playing",
            mode,
            startingLife: life,
            players,
            history: [],
            // The optional roll step opens right after Begin; Skip is always available.
            diceRoll: createDiceRoll(
              players.map((p) => p.id),
              get().diceRoll.sides,
              options?.roll ?? true,
            ),
            firstPlayerId: null,
            startedAt: Date.now(),
          });
        },

        resumeGame() {
          if (get().players.length > 0) set({ phase: "playing" });
        },

        resetGame() {
          const { players, startingLife } = get();
          set({
            players: players.map((p) => ({
              ...p,
              life: startingLife,
              counters: emptyCounters(),
              commanderDamage: {},
            })),
            history: [],
            diceRoll: createDiceRoll([], get().diceRoll.sides, false),
            firstPlayerId: null,
            startedAt: Date.now(),
          });
        },

        backToSelect() {
          set({
            phase: "select",
            players: [],
            history: [],
            diceRoll: createDiceRoll([], get().diceRoll.sides, false),
            firstPlayerId: null,
            startedAt: null,
          });
        },

        changeLife(playerId, delta) {
          const { players, history } = get();
          const i = players.findIndex((p) => p.id === playerId);
          if (i < 0 || delta === 0) return;
          const next = applyLifeDelta(players[i], delta);
          if (next === players[i]) return;
          const event: LifeEvent = {
            id: uid(),
            playerId,
            delta: next.life - players[i].life,
            at: Date.now(),
          };
          set({
            players: players.map((p, idx) => (idx === i ? next : p)),
            history: [...history, event].slice(-HISTORY_CAP),
          });
        },

        undoLast(playerId) {
          const { players, history } = get();
          const at = history.findLastIndex((e) => e.playerId === playerId);
          const i = players.findIndex((p) => p.id === playerId);
          if (at < 0 || i < 0) return;
          const reverted = applyLifeDelta(players[i], -history[at].delta);
          set({
            players: players.map((p, idx) => (idx === i ? reverted : p)),
            history: history.filter((_, idx) => idx !== at),
          });
        },

        rename(playerId, name) {
          set({
            players: get().players.map((p) =>
              p.id === playerId ? { ...p, name: name.slice(0, 24) } : p,
            ),
          });
        },

        recolor(playerId, color) {
          set({
            players: get().players.map((p) =>
              p.id === playerId ? { ...p, color } : p,
            ),
          });
        },

        setLayout4(layout4) {
          set({ layout4 });
        },

        startRoll() {
          const { players, diceRoll } = get();
          set({
            diceRoll: createDiceRoll(
              players.map((p) => p.id),
              diceRoll.sides,
              true,
            ),
            firstPlayerId: null,
          });
        },

        setDiceSides(sides) {
          const { players } = get();
          set({
            diceRoll: createDiceRoll(
              players.map((p) => p.id),
              sides,
              true,
            ),
            firstPlayerId: null,
          });
        },

        rollFor(playerId) {
          const { diceRoll } = get();
          const next = applyRoll(diceRoll, playerId, rollDie(diceRoll.sides));
          if (next === diceRoll) return false;
          set({
            diceRoll: next,
            firstPlayerId: next.status === "done" ? next.winnerId : null,
          });
          return true;
        },

        nextRound() {
          const { diceRoll } = get();
          const next = advanceTie(diceRoll);
          if (next !== diceRoll) set({ diceRoll: next });
        },

        closeRoll() {
          const { diceRoll, players } = get();
          if (diceRoll.status === "done") {
            set({ diceRoll: { ...diceRoll, active: false } });
          } else {
            // Skipped: forget any partial rolls and leave no first-player marker.
            set({
              diceRoll: createDiceRoll(
                players.map((p) => p.id),
                diceRoll.sides,
                false,
              ),
              firstPlayerId: null,
            });
          }
        },
      }),
      {
        name: STORAGE_KEY,
        version: STORE_VERSION,
        migrate: (persisted, version) => {
          // v1 had no roll step. Keep the saved game, add the new slice.
          const old = (persisted ?? {}) as Partial<GameState>;
          return version < 2
            ? { ...old, diceRoll: idleRoll, firstPlayerId: null }
            : old;
        },
        storage: createJSONStorage(() => storage ?? localStorage),
        // Rehydrated manually after mount so SSR and first client render match.
        skipHydration: true,
        partialize: (s) => ({
          phase: s.phase,
          mode: s.mode,
          startingLife: s.startingLife,
          layout4: s.layout4,
          players: s.players,
          history: s.history,
          diceRoll: s.diceRoll,
          firstPlayerId: s.firstPlayerId,
          startedAt: s.startedAt,
        }),
      },
    ),
  );
}

export const gameStore = createGameStore();

export function useGameStore<T>(selector: (s: GameStore) => T): T {
  return useStore(gameStore, selector);
}
