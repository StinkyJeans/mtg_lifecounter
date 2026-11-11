"use client";

import { gameStore, useGameStore } from "@/lib/store/gameStore";

/**
 * The only controls on the roll step. It sits on the seam between seats, well
 * clear of each die's tap area, and Skip is always one tap away.
 */
export function RollControls() {
  const sides = useGameStore((s) => s.diceRoll.sides);
  const status = useGameStore((s) => s.diceRoll.status);
  const anyRolled = useGameStore((s) => Object.keys(s.diceRoll.rolls).length > 0);
  const done = status === "done";
  const s = gameStore.getState();

  return (
    <div className="roll-bar" role="group" aria-label="Roll for first player">
      {!done && (
        <button className="btn bar-btn" onClick={() => s.closeRoll()} data-testid="roll-skip">
          Skip
        </button>
      )}
      {!done && (
        <div className="bar-seg" role="group" aria-label="Die">
          {([20, 6] as const).map((n) => (
            <button
              key={n}
              className="bar-btn"
              aria-pressed={sides === n}
              onClick={() => sides !== n && s.setDiceSides(n)}
              data-testid={`roll-d${n}`}
            >
              d{n}
            </button>
          ))}
        </div>
      )}
      {anyRolled && (
        <button className="btn bar-btn bar-small" onClick={() => s.startRoll()} data-testid="roll-reroll">
          Reroll all
        </button>
      )}
      {done && (
        <button className="btn btn-solid bar-btn" onClick={() => s.closeRoll()} data-testid="roll-start">
          Start game
        </button>
      )}
    </div>
  );
}
