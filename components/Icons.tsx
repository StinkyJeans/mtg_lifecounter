/* Hand-cut icons: slightly off-true strokes, no icon pack. 24px grid, currentColor. */
import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const Plus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 12.4 L20.6 11.6" />
    <path d="M11.5 3.2 L12.6 20.8" />
  </svg>
);

export const Minus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 12.6 L20.5 11.4" />
  </svg>
);

/** Menu: three uneven strokes, like tally marks. */
export const Sigil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 6.5 L19 5.8" />
    <path d="M7 12.3 L17.5 11.9" />
    <path d="M5.5 18.2 L15 17.6" />
  </svg>
);

/** History: a clock face with a hand-cut return arrow. */
export const History = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.2 12.3 C4.4 7.6 8 4.3 12.3 4.5 C16.7 4.7 19.8 8.1 19.6 12.4 C19.4 16.7 16 19.8 11.8 19.6 C9.5 19.5 7.6 18.5 6.3 17" />
    <path d="M3.6 8.2 L4.2 12.3 L8 11.4" />
    <path d="M12 8.2 L12.1 12.4 L15 14.1" />
  </svg>
);

export const Undo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8.5 5 L4 9.6 L8.8 14" />
    <path d="M4.4 9.6 C10 8.6 19 8.8 19.6 16.4" />
  </svg>
);

export const Close = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5.5 5.2 L18.6 18.9" />
    <path d="M18.4 5.4 L5.3 18.7" />
  </svg>
);

export const Flame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12.4 2.8 C13 7 18 9 17.6 14.6 C17.3 18.6 14.6 21 11.8 21 C8.4 21 6.2 18.4 6.6 15 C6.8 13 8 11.8 8.8 10.2 C9.6 12 10.6 12.2 11.2 11.6 C12 9.6 11 6 12.4 2.8 Z" />
  </svg>
);

export const Download = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3.5 L11.8 14.5" />
    <path d="M7 10.2 L12 15 L17.2 10" />
    <path d="M4.6 19.8 L19.4 19.4" />
  </svg>
);

export const Mark = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden {...p}>
    <path d="M256 128 L318 262 L252 392 L196 262 Z M256 168 L224 262 L254 340 L292 262 Z" fillRule="evenodd" />
    <circle cx="256" cy="256" r="196" fill="none" stroke="currentColor" strokeWidth="14" />
  </svg>
);

/** d20 seen face-on: uneven hexagon with the inner triangle. */
export const Die = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 2.6 L20.4 7.4 L20.2 16.7 L12.1 21.5 L3.7 16.5 L3.8 7.3 Z" />
    <path d="M12 7.6 L16.6 15.4 L7.5 15.6 Z" />
  </svg>
);

/** Small solid diamond, for buttons and marks. */
export const Diamond = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12.2 2.4 L20.6 12.1 L11.9 21.7 L3.5 11.8 Z" />
  </svg>
);

export const Arrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12.4 L19.4 11.7" />
    <path d="M13.6 5.6 L19.8 11.8 L13.4 18.3" />
  </svg>
);

/** Folded-corner mark for a selected card. */
export const CornerMark = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 34 34" aria-hidden {...p}>
    <path d="M0.4 0.2 L33.8 0.4 L33.6 33.7 Z" fill="currentColor" />
    <path d="M24.2 8.2 L28.6 12.7 L24.1 17.4 L19.6 12.8 Z" fill="#14110d" />
  </svg>
);

/**
 * Seating diagrams: a table (uneven, hand-ruled) with chairs. Thin gold lines.
 * Two seats facing each other; four seats around the table.
 */
export const SeatsTwo = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 80 60" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <path d="M15.8 21.2 C15.6 18.8 17.6 17.2 20.6 17.1 L59.4 16.6 C62.8 16.5 64.6 18.2 64.5 21.4 L64.9 39 C65 41.8 63.2 43.5 59.8 43.5 L20.4 43.9 C17.4 44 15.7 42.4 15.9 39.6 Z" />
    <path d="M30.6 12.6 C34.4 8.4 45.6 8.1 49.7 12.4" />
    <path d="M33.6 5.8 L46.6 5.6" opacity=".55" />
    <path d="M30.3 47.7 C34.6 52 45.4 52.2 49.8 47.5" />
    <path d="M33.5 54.6 L46.8 54.8" opacity=".55" />
    <path d="M40.2 25.4 L40.1 34.6 M36.6 28.6 L40.2 25 L43.8 28.7" opacity=".5" />
  </svg>
);

export const SeatsFour = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 80 60" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <path d="M23.4 20.6 C23.3 18.9 24.6 17.9 26.6 17.9 L53.5 17.6 C55.5 17.6 56.7 18.7 56.6 20.5 L56.9 39.2 C57 41 55.7 42 53.8 42 L26.4 42.3 C24.5 42.4 23.3 41.3 23.5 39.4 Z" />
    <path d="M32.2 13.6 C35.6 10 44.4 9.9 48 13.4" />
    <path d="M32.4 46.4 C35.8 50 44.6 50.2 47.9 46.6" />
    <path d="M18.6 24.2 C14.6 27.6 14.7 34.2 18.5 37.6" />
    <path d="M61.5 24.1 C65.5 27.6 65.4 34.3 61.4 37.7" />
    <path d="M40.1 25 L40 35 M35.9 29 L40.1 24.8 L44.2 29" opacity=".45" />
  </svg>
);
