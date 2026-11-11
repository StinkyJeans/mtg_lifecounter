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

export type DieSides = 6 | 20;
export type RollStatus = "idle" | "rolling" | "tied" | "done";

/** The "roll for first player" step. Persisted, so a reload mid-roll restores it. */
export interface DiceRoll {
  /** The roll step is on screen. */
  active: boolean;
  sides: DieSides;
  round: number;
  /** Players who must roll this round (everyone in round 1, then only the tied). */
  contenders: string[];
  /** Locked results by player id. Tied players are cleared when the next round starts. */
  rolls: Record<string, number>;
  winnerId: string | null;
  status: RollStatus;
}

export interface GameState {
  phase: "select" | "playing";
  mode: GameMode;
  startingLife: number;
  layout4: Layout4;
  players: Player[];
  history: LifeEvent[];
  diceRoll: DiceRoll;
  /** Winner of the last completed roll, shown as a small marker during the game. */
  firstPlayerId: string | null;
  startedAt: number | null;
}

export type DefeatReason = "life" | "poison" | "commander";
