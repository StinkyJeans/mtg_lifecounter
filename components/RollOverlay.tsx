"use client";

import { useState } from "react";
import { D20Die } from "./dice/D20Die";
import { D6Die } from "./dice/D6Die";
import type { DieSides, ManaColor } from "@/lib/game/types";

export interface RollSeatView {
  sides: DieSides;
  color: ManaColor;
  /** Player name, shown in the seat's own orientation. */
  name: string;
  /** The die has landed, so the number may be shown beneath it. */
  settled: boolean;
  /** Locked result, or null if this player has not rolled this round. */
  value: number | null;
  /** This player may tap to roll right now. */
  canRoll: boolean;
  /** Locked from an earlier round (not part of a tie re-roll). */
  dim: boolean;
  /** Revealed winner: gold border. */
  won: boolean;
  /** "Tap to roll", "Goes first", "Second", "Tie", ... */
  label: string;
}

interface Props {
  index: number;
  view: RollSeatView;
  onRoll: () => void;
  onLanded: () => void;
}

/**
 * One seat's die. The whole panel is the tap target; Pointer Events fire on
 * press so it rolls instantly. The store rejects a second roll in the same
 * round, so a double tap can never re-roll.
 */
export function RollOverlay({ index, view, onRoll, onLanded }: Props) {
  const [flash, setFlash] = useState(0);

  return (
    <div
      className="roll"
      data-won={view.won}
      data-dim={view.dim}
      data-can-roll={view.canRoll}
      data-testid={`die-${index}`}
      onPointerDown={(e) => {
        if (e.button > 0 || !view.canRoll) return;
        setFlash((n) => n + 1); // visual feedback where vibration does not exist (iOS)
        onRoll();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <i className="seam-rule" aria-hidden />
      <div className="who">
        <span className="pip" aria-hidden />
        <span>{view.name}</span>
      </div>
      <div className="die-stage">
        {view.sides === 20 ? (
          <D20Die color={view.color} value={view.value} onLanded={onLanded} />
        ) : (
          <D6Die value={view.value} onLanded={onLanded} />
        )}
      </div>
      <div className="result" data-show={view.settled && view.value !== null} aria-hidden>
        {view.settled ? (view.value ?? "") : ""}
      </div>
      <output className="sr-only">{view.value ?? ""}</output>
      <div className="verdict" aria-live="polite">
        {view.label}
      </div>
      {flash > 0 && <div key={flash} className="flash" data-dir="1" />}
    </div>
  );
}
