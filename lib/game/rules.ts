import type {
  Counters,
  DefeatReason,
  GameMode,
  ManaColor,
  Player,
} from "./types";

export const MIN_LIFE = -999;
export const MAX_LIFE = 9999;
export const POISON_LOSS = 10;
export const COMMANDER_LOSS = 21;
export const TAP_STEP = 1;
export const HOLD_STEP = 5;

export const MANA_COLORS: ManaColor[] = ["W", "U", "B", "R", "G"];

export const DEFAULT_COLORS: Record<GameMode, ManaColor[]> = {
  2: ["R", "U"],
  4: ["R", "U", "G", "W"],
};

export const COLOR_NAMES: Record<ManaColor, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

export function defaultStartingLife(mode: GameMode): number {
  return mode === 4 ? 40 : 20;
}

export function clampLife(life: number): number {
  return Math.min(MAX_LIFE, Math.max(MIN_LIFE, Math.trunc(life)));
}

export function emptyCounters(): Counters {
  return { poison: 0, energy: 0, experience: 0 };
}

export function createPlayer(
  index: number,
  mode: GameMode,
  startingLife: number,
  idFactory: () => string,
): Player {
  return {
    id: idFactory(),
    name: `Player ${index + 1}`,
    color: DEFAULT_COLORS[mode][index],
    life: clampLife(startingLife),
    counters: emptyCounters(),
    commanderDamage: {},
  };
}

export function createPlayers(
  mode: GameMode,
  startingLife: number,
  idFactory: () => string,
): Player[] {
  return Array.from({ length: mode }, (_, i) =>
    createPlayer(i, mode, startingLife, idFactory),
  );
}

/** Returns the player with life changed by delta (clamped). Same reference if nothing changed. */
export function applyLifeDelta(player: Player, delta: number): Player {
  const life = clampLife(player.life + delta);
  return life === player.life ? player : { ...player, life };
}

export function defeatReason(player: Player): DefeatReason | null {
  if (player.life <= 0) return "life";
  if (player.counters.poison >= POISON_LOSS) return "poison";
  const worst = Math.max(0, ...Object.values(player.commanderDamage));
  if (worst >= COMMANDER_LOSS) return "commander";
  return null;
}

export const isDefeated = (player: Player): boolean =>
  defeatReason(player) !== null;

/** Players still in the game; a winner exists when exactly one remains. */
export function survivors(players: Player[]): Player[] {
  return players.filter((p) => !isDefeated(p));
}

export function winner(players: Player[]): Player | null {
  const alive = survivors(players);
  return players.length > 1 && alive.length === 1 ? alive[0] : null;
}
