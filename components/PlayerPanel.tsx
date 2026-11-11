"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Cube, Minus, Plus, Undo } from "griddy-icons";
import { RollOverlay, type RollSeatView } from "./RollOverlay";
import { useLifeGesture } from "./useLifeGesture";
import { COLOR_NAMES, MANA_COLORS, defeatReason } from "@/lib/game/rules";
import type { ManaColor } from "@/lib/game/types";
import { tick } from "@/lib/pwa/haptics";
import { gameStore, useGameStore } from "@/lib/store/gameStore";

export type Rotation = 0 | 90 | 180 | 270;

const REASON_TEXT = {
  life: "Out of life",
  poison: "Ten poison counters",
  commander: "Twenty-one commander damage",
} as const;

function LifeNumber({ life }: { life: number }) {
  // Derive roll direction from the previous value during render (no effect, no ref).
  const [seen, setSeen] = useState({ life, dir: 0 });
  if (seen.life !== life) setSeen({ life, dir: life > seen.life ? 1 : -1 });

  const text = String(life).replace("-", "−");
  return (
    <div className="life">
      <div
        key={life}
        className="life-num"
        data-dir={seen.dir}
        data-len={Math.min(4, text.length)}
        data-testid="life"
      >
        {text}
      </div>
    </div>
  );
}

interface Props {
  index: number;
  rotationPortrait: Rotation;
  rotationLandscape: Rotation;
  /** Present only while the roll-for-first step is open. */
  rollView: RollSeatView | null;
  onRoll: () => void;
  onRollLanded: () => void;
}

/** Subscribes to one player only, so a tap re-renders one panel. */
function PlayerPanelImpl({
  index,
  rotationPortrait,
  rotationLandscape,
  rollView,
  onRoll,
  onRollLanded,
}: Props) {
  const player = useGameStore((s) => s.players[index]);
  const isFirst = useGameStore(
    (s) => s.firstPlayerId !== null && s.firstPlayerId === s.players[index]?.id,
  );
  const [picking, setPicking] = useState(false);
  const [burst, setBurst] = useState({ delta: 0, key: 0, dir: 0 });
  const clearBurst = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (clearBurst.current && clearTimeout(clearBurst.current)), []);

  const id = player?.id;
  const onStep = useCallback(
    (delta: number) => {
      if (!id) return;
      gameStore.getState().changeLife(id, delta);
      tick(delta < 0 ? 12 : 8);
      setBurst((b) => ({ delta: b.delta + delta, key: b.key + 1, dir: Math.sign(delta) }));
      if (clearBurst.current) clearTimeout(clearBurst.current);
      clearBurst.current = setTimeout(
        () => setBurst((b) => ({ ...b, delta: 0 })),
        1300,
      );
    },
    [id],
  );
  const gesture = useLifeGesture(onStep);

  if (!player) return null;
  const reason = defeatReason(player);

  return (
    <section
      className="cell"
      style={{ "--pc": `var(--mana-${player.color})` } as React.CSSProperties}
      data-testid={`panel-${index}`}
    >
      <div
        className="seat"
        data-rp={rotationPortrait}
        data-rl={rotationLandscape}
        data-testid={`seat-${index}`}
      >
        <div className="zone" data-sign="-1" data-testid={`minus-${index}`} {...gesture(-1)} />
        <div className="zone" data-sign="1" data-testid={`plus-${index}`} {...gesture(1)} />
        <Minus className="glyph" data-sign="-1" />
        <Plus className="glyph" data-sign="1" />

        <LifeNumber life={player.life} />
        {burst.key > 0 && (
          <div key={burst.key} className="flash" data-dir={burst.dir} />
        )}
        {burst.delta !== 0 && (
          <div className="burst" data-neg={burst.delta < 0}>
            {burst.delta > 0 ? "+" : "−"}
            {Math.abs(burst.delta)}
          </div>
        )}

        <div className="head">
          <input
            className="name"
            value={player.name}
            maxLength={24}
            aria-label={`Player ${index + 1} name`}
            enterKeyHint="done"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => gameStore.getState().rename(player.id, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <button
            className="swatch"
            aria-label={`Color: ${COLOR_NAMES[player.color]}. Change`}
            aria-expanded={picking}
            onClick={() => setPicking((v) => !v)}
          >
            <i style={{ "--c": `var(--mana-${player.color})` } as React.CSSProperties} />
          </button>
        </div>

        {picking && (
          <div className="picker" role="group" aria-label="Player color">
            {MANA_COLORS.map((c: ManaColor) => (
              <button
                key={c}
                aria-label={COLOR_NAMES[c]}
                aria-pressed={c === player.color}
                onClick={() => {
                  gameStore.getState().recolor(player.id, c);
                  setPicking(false);
                }}
              >
                <i style={{ "--c": `var(--mana-${c})` } as React.CSSProperties} />
              </button>
            ))}
          </div>
        )}

        {isFirst && !rollView && (
          <div className="first-mark" data-testid={`first-${index}`}>
            <Cube size={16} /> First
          </div>
        )}

        {rollView && (
          <RollOverlay index={index} view={rollView} onRoll={onRoll} onLanded={onRollLanded} />
        )}

        {reason && (
          <div className="defeat" data-testid={`defeated-${index}`}>
            <h3>Defeated</h3>
            <p>{REASON_TEXT[reason]}</p>
            <button
              className="btn"
              onClick={() => gameStore.getState().undoLast(player.id)}
            >
              <Undo size={20} /> Undo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export const PlayerPanel = memo(PlayerPanelImpl);
