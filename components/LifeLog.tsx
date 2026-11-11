"use client";

import { useGameStore } from "@/lib/store/gameStore";

/** Taps on the same player within this window read as one change ("loses 5", not five lines). */
const MERGE_MS = 3000;

interface LogLine {
  key: string;
  name: string;
  delta: number;
  at: number;
}

function LifeLogList() {
  const players = useGameStore((s) => s.players);
  const history = useGameStore((s) => s.history);

  const lines: LogLine[] = [];
  for (const e of history) {
    const name = players.find((p) => p.id === e.playerId)?.name ?? "Player";
    const last = lines[lines.length - 1];
    if (last && last.name === name && Math.sign(last.delta) === Math.sign(e.delta) && e.at - last.at < MERGE_MS) {
      last.delta += e.delta;
      last.at = e.at;
    } else {
      lines.push({ key: e.id, name, delta: e.delta, at: e.at });
    }
  }
  lines.reverse(); // newest first

  if (lines.length === 0) return <p data-testid="log-empty">No life changes yet.</p>;
  return (
    <ol className="log" data-testid="log">
      {lines.map((l) => (
        <li key={l.key} data-gain={l.delta > 0}>
          <span>
            {l.name} {l.delta > 0 ? "gains" : "loses"} {Math.abs(l.delta)} life
          </span>
          <time>{new Date(l.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
        </li>
      ))}
    </ol>
  );
}

/** Life history sheet, opened from the seam beside the menu button. */
export function LifeLog({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose} data-testid="log-scrim">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Life log" onClick={(e) => e.stopPropagation()}>
        <h2>Life log</h2>
        <LifeLogList />
        <button className="btn btn-solid" onClick={onClose} data-testid="log-back">
          Back to the game
        </button>
      </div>
    </div>
  );
}
