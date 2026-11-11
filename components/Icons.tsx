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
