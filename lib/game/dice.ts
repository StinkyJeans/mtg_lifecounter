/**
 * Roll-for-first rules. Pure and framework-free: the store only calls these.
 * The result of a roll is decided here (crypto RNG) BEFORE any animation runs;
 * the 3D die is told which face to land on and never decides anything.
 */
import type { DiceRoll, DieSides } from "./types";

type FillRandom = (a: Uint32Array) => Uint32Array;

/** Unbiased integer in [0, maxExclusive) via rejection sampling over crypto.getRandomValues. */
export function secureRandomInt(
  maxExclusive: number,
  fill: FillRandom = (a) => crypto.getRandomValues(a),
): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new RangeError("maxExclusive must be an integer in 1..2^32");
  }
  const range = 0x100000000;
  const limit = range - (range % maxExclusive); // largest multiple of n that fits: reject above it
  const buf = new Uint32Array(1);
  for (;;) {
    const x = fill(buf)[0];
    if (x < limit) return x % maxExclusive;
  }
}

/** One die roll, 1..sides inclusive. */
export function rollDie(
  sides: number,
  randomInt: (maxExclusive: number) => number = secureRandomInt,
): number {
  if (!Number.isInteger(sides) || sides < 2) throw new RangeError("sides must be an integer >= 2");
  return 1 + randomInt(sides);
}

/**
 * Players tied for the highest roll (empty when the top roll is unique).
 * `among` restricts the comparison, so earlier, lower, locked dice are ignored.
 */
export function getTiedPlayers(rolls: Record<string, number>, among?: string[]): string[] {
  const ids = (among ?? Object.keys(rolls)).filter((id) => id in rolls);
  if (ids.length === 0) return [];
  const top = Math.max(...ids.map((id) => rolls[id]));
  const leaders = ids.filter((id) => rolls[id] === top);
  return leaders.length > 1 ? leaders : [];
}

export interface RoundResult {
  status: "rolling" | "tied" | "done";
  winnerId: string | null;
  tied: string[];
}

/** Outcome of a round: still waiting, a tie among the leaders, or a single winner. */
export function resolveRound(rolls: Record<string, number>, contenders: string[]): RoundResult {
  if (contenders.length === 0 || contenders.some((id) => !(id in rolls))) {
    return { status: "rolling", winnerId: null, tied: [] };
  }
  const tied = getTiedPlayers(rolls, contenders);
  if (tied.length > 0) return { status: "tied", winnerId: null, tied };
  const top = Math.max(...contenders.map((id) => rolls[id]));
  return { status: "done", winnerId: contenders.find((id) => rolls[id] === top)!, tied: [] };
}

export function createDiceRoll(playerIds: string[], sides: DieSides, active: boolean): DiceRoll {
  return {
    active,
    sides,
    round: 1,
    contenders: [...playerIds],
    rolls: {},
    winnerId: null,
    status: "idle",
  };
}

/**
 * Locks in a die result. Returns the SAME object when the roll is not allowed
 * (step closed, round over, not a contender, or already rolled this round),
 * so callers can detect a rejected roll by reference.
 */
export function applyRoll(d: DiceRoll, playerId: string, value: number): DiceRoll {
  const open = d.status === "idle" || d.status === "rolling";
  if (!d.active || !open) return d;
  if (!d.contenders.includes(playerId) || playerId in d.rolls) return d;
  if (!Number.isInteger(value) || value < 1 || value > d.sides) return d;

  const rolls = { ...d.rolls, [playerId]: value };
  const result = resolveRound(rolls, d.contenders);
  return { ...d, rolls, status: result.status, winnerId: result.winnerId };
}

/** After a tie: only the tied players roll again; everyone else stays locked. */
export function advanceTie(d: DiceRoll): DiceRoll {
  if (d.status !== "tied") return d;
  const tied = getTiedPlayers(d.rolls, d.contenders);
  const rolls = { ...d.rolls };
  for (const id of tied) delete rolls[id];
  return { ...d, round: d.round + 1, contenders: tied, rolls, status: "idle", winnerId: null };
}

/**
 * Seat order around the table, clockwise as seen from above, starting at `first`.
 * Seats are laid out TL, TR / BL, BR (indexes 0..3), so a 4-player table runs 0,1,3,2.
 */
export function clockwiseOrder(first: number, count: number): number[] {
  const ring = count === 4 ? [0, 1, 3, 2] : Array.from({ length: count }, (_, i) => i);
  const at = ring.indexOf(first);
  if (at < 0) return ring;
  return [...ring.slice(at), ...ring.slice(0, at)];
}
