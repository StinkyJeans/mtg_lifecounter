/** Single game state model. Everything here is plain JSON so it persists and syncs trivially. */

export type ManaColor = "W" | "U" | "B" | "R" | "G";
export type GameMode = 2 | 4;
export type Layout4 = "flip" | "sides";

export interface Counters {
  poison: number;
  energy: number;
  experience: number;
}

export interface Player {
  id: string;
  name: string;
  color: ManaColor;
  life: number;
  counters: Counters;
  /** Damage taken from each opposing commander, keyed by source player id. */
  commanderDamage: Record<string, number>;
}

/** Append-only. `id` is a client-generated uuid so a later sync can upsert idempotently. */
export interface LifeEvent {
  id: string;
  playerId: string;
  delta: number;
  at: number;
}

export interface GameState {
  phase: "select" | "playing";
  mode: GameMode;
  startingLife: number;
  layout4: Layout4;
  players: Player[];
  history: LifeEvent[];
  startedAt: number | null;
}

export type DefeatReason = "life" | "poison" | "commander";
