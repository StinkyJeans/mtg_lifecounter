import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import {
  applyLifeDelta,
  clampLife,
  createPlayers,
  defaultStartingLife,
  emptyCounters,
} from "../game/rules";
import type {
  GameMode,
  GameState,
  Layout4,
  LifeEvent,
  ManaColor,
} from "../game/types";

export const STORAGE_KEY = "mtg-life:v1";
const HISTORY_CAP = 500;

export interface GameActions {
  startGame(mode: GameMode, startingLife?: number): void;
  /** Same mode and life, fresh totals (names and colors kept). */
  resetGame(): void;
  backToSelect(): void;
  changeLife(playerId: string, delta: number): void;
  /** Reverts the most recent life event for a player. */
  undoLast(playerId: string): void;
  rename(playerId: string, name: string): void;
  recolor(playerId: string, color: ManaColor): void;
  setLayout4(layout: Layout4): void;
}

export type GameStore = GameState & GameActions;

const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const initial: GameState = {
  phase: "select",
  mode: 2,
  startingLife: 20,
  layout4: "flip",
  players: [],
  history: [],
  startedAt: null,
};

export function createGameStore(storage?: StateStorage): StoreApi<GameStore> {
  return createStore<GameStore>()(
    persist(
      (set, get) => ({
        ...initial,

        startGame(mode, startingLife) {
          const life = clampLife(startingLife ?? defaultStartingLife(mode));
          set({
            phase: "playing",
            mode,
            startingLife: life,
            players: createPlayers(mode, life, uid),
            history: [],
            startedAt: Date.now(),
          });
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
            startedAt: Date.now(),
          });
        },

        backToSelect() {
          set({ phase: "select", players: [], history: [], startedAt: null });
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
      }),
      {
        name: STORAGE_KEY,
        version: 1,
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
