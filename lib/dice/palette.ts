/** Die look: dark stone tinted by the seat's mana color, engraved gold numerals. */
export const GOLD = "#c9a24b";
export const STONE = "#1d1913";

const parse = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

/** Blend `hex` into `base` by `amount` (0..1). */
export function mixHex(base: string, hex: string, amount: number): string {
  const a = parse(base);
  const b = parse(hex);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

export const stoneFor = (manaHex: string): string => mixHex(STONE, manaHex, 0.3);
