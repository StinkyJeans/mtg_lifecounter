"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Minus, Plus } from "griddy-icons";
import { CornerMark, Diamond, Mark, SeatsFour, SeatsTwo } from "./Icons";
import { clampLife, defaultStartingLife } from "@/lib/game/rules";
import type { GameMode } from "@/lib/game/types";
import { gameStore, useGameStore } from "@/lib/store/gameStore";

const MODES: {
  mode: GameMode;
  title: string;
  sub: string;
  Seats: typeof SeatsTwo;
  /** Slightly different corner radii so the cards do not look machine-cut. */
  edge: string;
}[] = [
  { mode: 2, title: "Two players", sub: "Across the table", Seats: SeatsTwo, edge: "4px 22px 3px 17px" },
  { mode: 4, title: "Four players", sub: "Commander pod", Seats: SeatsFour, edge: "3px 17px 4px 22px" },
];

/** The starting-life numeral. A changed value remounts it so it rolls in from the direction of change. */
function RollingNumber({ value }: { value: number }) {
  const [seen, setSeen] = useState({ value, dir: 0 });
  if (seen.value !== value) setSeen({ value, dir: value > seen.value ? 1 : -1 });
  return (
    <output key={value} className="life-hero" data-dir={seen.dir} data-testid="starting-life" aria-live="polite">
      {value}
    </output>
  );
}

export function ModeSelect() {
  const [mode, setMode] = useState<GameMode>(2);
  const [life, setLife] = useState(20);
  const [touched, setTouched] = useState(false);
  const hasSavedGame = useGameStore((s) => s.players.length > 0);

  // While the player picks a mode, quietly prepare the 3D dice so the roll step opens instantly.
  useEffect(() => {
    const prepare = () => void import("@/lib/dice/d20Scene").then((m) => m.warmUp()).catch(() => {});
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    if (idle) {
      const id = idle(prepare, { timeout: 1500 });
      return () => (window as Window & { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback?.(id);
    }
    const t = setTimeout(prepare, 600);
    return () => clearTimeout(t);
  }, []);

  const pick = (m: GameMode) => {
    setMode(m);
    if (!touched) setLife(defaultStartingLife(m)); // follows the mode until the player changes it
  };
  const adjust = (d: number) => {
    setTouched(true);
    setLife((l) => Math.max(1, clampLife(l + d)));
  };
  const preset = (v: number) => {
    setTouched(true);
    setLife(v);
  };

  return (
    <div className="select" data-testid="mode-select">
      <div className="select-scroll">
        <div className="select-inner">
          <header className="select-head">
            <div className="select-brand">
              <Mark width={46} height={46} style={{ color: "var(--brass)" }} />
              <span className="select-wordmark">Ledger</span>
              {hasSavedGame && (
                <button className="resume" onClick={() => gameStore.getState().resumeGame()} data-testid="resume">
                  Resume game <ArrowRight size={18} />
                </button>
              )}
            </div>
            <svg className="select-rule" viewBox="0 0 320 8" preserveAspectRatio="none" aria-hidden>
              <path d="M1 4.6 C60 2.8 120 5.6 180 4 S280 3 319 4.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </header>

          <section className="select-modes" aria-label="Players">
            {MODES.map(({ mode: m, title, sub, Seats, edge }) => (
              <button
                key={m}
                className="slab"
                style={{ borderRadius: edge }}
                aria-pressed={mode === m}
                onClick={() => pick(m)}
                data-testid={`mode-${m}`}
              >
                <span className="slab-text">
                  <b>{title}</b>
                  <span className="sub">{sub}</span>
                  <Seats className="seats" />
                </span>
                <span className="ghost" aria-hidden>
                  {m}
                </span>
                <CornerMark className="corner" aria-hidden />
              </button>
            ))}
          </section>

          <section className="select-life" aria-label="Starting life">
            <div className="label">Starting life</div>
            <div className="life-row">
              <button className="step-btn" aria-label="Lower starting life by 5" onClick={() => adjust(-5)} data-testid="life-minus">
                <Minus size={30} />
              </button>
              <RollingNumber value={life} />
              <button className="step-btn" aria-label="Raise starting life by 5" onClick={() => adjust(5)} data-testid="life-plus">
                <Plus size={30} />
              </button>
            </div>
            <div className="chips">
              {[20, 40].map((v) => (
                <button key={v} className="chip" aria-pressed={life === v} onClick={() => preset(v)} data-testid={`preset-${v}`}>
                  {v}
                </button>
              ))}
            </div>
          </section>

          <div className="select-actions">
            <button
              className="begin"
              onClick={() => gameStore.getState().startGame(mode, life, { roll: false })}
              data-testid="begin"
            >
              <span>Begin</span>
              <Diamond width={14} height={14} />
            </button>
            <button
              className="text-link"
              onClick={() => gameStore.getState().startGame(mode, life, { roll: true })}
              data-testid="roll-link"
            >
              Roll for first player
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
