"use client";

import { gameStore, useGameStore } from "@/lib/store/gameStore";

const when = (t: number) =>
  new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const length = (a: number, b: number) => {
  const min = Math.max(1, Math.round((b - a) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
};

/** Past games saved on this device, newest first. Opened from the seam beside the menu button. */
export function MatchHistory({ onClose }: { onClose: () => void }) {
  const matches = useGameStore((s) => s.matches);
  const list = [...matches].reverse();

  return (
    <div className="scrim" onClick={onClose} data-testid="matches-scrim">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Match history" onClick={(e) => e.stopPropagation()}>
        <h2>Match history</h2>
        {list.length === 0 ? (
          <p data-testid="matches-empty">No finished matches yet. A game is saved here when you reset or start a new table.</p>
        ) : (
          <ol className="matches" data-testid="matches">
            {list.map((m) => (
              <li key={m.id}>
                <div className="m-top">
                  <span className={m.winner ? "m-win" : undefined}>{m.winner ? `${m.winner} won` : "Unfinished"}</span>
                  <span>{m.mode} players</span>
                </div>
                <div className="m-sub">
                  {m.players.map((p, i) => (
                    <span key={i}>
                      <i style={{ "--c": `var(--mana-${p.color})` } as React.CSSProperties} />
                      {p.name} {p.life}
                    </span>
                  ))}
                </div>
                <div className="m-sub">
                  <span>{when(m.endedAt)}</span>
                  <span>{length(m.startedAt, m.endedAt)}</span>
                  <span>{m.changes} changes</span>
                </div>
              </li>
            ))}
          </ol>
        )}
        {list.length > 0 && (
          <button className="btn btn-danger" onClick={() => gameStore.getState().clearMatches()} data-testid="matches-clear">
            Clear history
          </button>
        )}
        <button className="btn btn-solid" onClick={onClose} data-testid="matches-back">
          Back to the game
        </button>
      </div>
    </div>
  );
}
