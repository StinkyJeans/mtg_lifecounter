"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuAlt01, TimeBack } from "griddy-icons";
import { LifeLog } from "./LifeLog";
import { Menu } from "./Menu";
import { PlayerPanel, type Rotation } from "./PlayerPanel";
import type { RollSeatView } from "./RollOverlay";
import { RollControls } from "./RollControls";
import { clockwiseOrder } from "@/lib/game/dice";
import type { GameMode, Layout4, ManaColor } from "@/lib/game/types";
import { tick } from "@/lib/pwa/haptics";
import { gameStore, useGameStore } from "@/lib/store/gameStore";

type Pair = [portrait: Rotation, landscape: Rotation];

/**
 * Seat rotations per layout. Landscape only changes the 2-player table: players
 * sit on the short ends of the phone, so panels turn 90 degrees instead of 180.
 */
function rotations(mode: GameMode, layout4: Layout4): Pair[] {
  if (mode === 2) {
    return [
      [180, 90],
      [0, 270],
    ];
  }
  return layout4 === "flip"
    ? [[180, 180], [180, 180], [0, 0], [0, 0]]
    : [[90, 90], [270, 270], [90, 90], [270, 270]];
}

const TURN_LABEL = ["Goes first", "Second", "Third", "Fourth"];
const TIE_ADVANCE_MS = 1700;
/** Long enough to read who goes first, then the game starts by itself. */
const AUTO_START_MS = 1600;

export function GameBoard() {
  const mode = useGameStore((s) => s.mode);
  const layout4 = useGameStore((s) => s.layout4);
  const roll = useGameStore((s) => s.diceRoll);
  // Primitive selectors: life taps change `players`, but not these, so the board stays still.
  const idKey = useGameStore((s) => s.players.map((p) => p.id).join("|"));
  const nameKey = useGameStore((s) => s.players.map((p) => p.name).join("\u0001"));
  const colorKey = useGameStore((s) => s.players.map((p) => p.color).join(""));
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const rot = rotations(mode, layout4);

  // Dice still tumbling. Results are already in the store; this only delays the
  // reveal (gold border, labels, tie handling) until every die has landed.
  const [pending, setPending] = useState({ active: roll.active, ids: [] as string[] });
  if (pending.active !== roll.active) setPending({ active: roll.active, ids: [] });
  const revealed = roll.active && pending.ids.length === 0;

  const landed = (id: string) =>
    setPending((p) => (p.ids.includes(id) ? { ...p, ids: p.ids.filter((x) => x !== id) } : p));

  const rollSeat = (i: number) => {
    const id = idKey.split("|")[i];
    if (gameStore.getState().rollFor(id)) {
      setPending((p) => ({ ...p, ids: [...p.ids, id] }));
      tick(14);
    }
  };

  // Tie: once every die has landed, pause briefly, then only the tied players roll again.
  useEffect(() => {
    if (!roll.active || roll.status !== "tied" || pending.ids.length > 0) return;
    const t = setTimeout(() => gameStore.getState().nextRound(), TIE_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [roll.active, roll.status, roll.round, pending.ids.length]);

  // Winner decided and every die has landed: start the game without another tap.
  useEffect(() => {
    if (!roll.active || roll.status !== "done" || pending.ids.length > 0) return;
    const t = setTimeout(() => gameStore.getState().closeRoll(), AUTO_START_MS);
    return () => clearTimeout(t);
  }, [roll.active, roll.status, pending.ids.length]);

  const views = useMemo<RollSeatView[] | null>(() => {
    if (!roll.active) return null;
    const ids = idKey.split("|");
    const colors = colorKey.split("") as ManaColor[];
    const names = nameKey.split("\u0001");
    const open = roll.status === "idle" || roll.status === "rolling";
    const order =
      roll.status === "done" && roll.winnerId
        ? clockwiseOrder(ids.indexOf(roll.winnerId), mode)
        : [];

    return ids.map((id, i) => {
      const value = roll.rolls[id] ?? null;
      const contender = roll.contenders.includes(id);
      const settling = pending.ids.includes(id);
      const canRoll = open && contender && value === null;

      let label = "";
      if (!settling) {
        if (canRoll) label = "Tap to roll";
        else if (roll.status === "done" && revealed) label = TURN_LABEL[order.indexOf(i)] ?? "";
        else if (roll.status === "tied" && revealed && contender) label = "Roll again";
        else if (open && contender && value !== null) label = "Rolled";
      }
      const won = revealed && roll.status === "done" && id === roll.winnerId;
      const dim = revealed
        ? roll.status === "done"
          ? id !== roll.winnerId
          : !contender
        : !contender;
      return { sides: roll.sides, color: colors[i], name: names[i] || `Player ${i + 1}`, settled: !settling, value, canRoll, dim, won, label };
    });
  }, [roll, idKey, colorKey, nameKey, mode, pending.ids, revealed]);

  return (
    <>
      <main className="board" data-mode={mode} data-rolling={roll.active} data-testid="board">
        {rot.map(([portrait, landscape], i) => (
          <PlayerPanel
            key={i}
            index={i}
            rotationPortrait={portrait}
            rotationLandscape={landscape}
            rollView={views?.[i] ?? null}
            onRoll={() => rollSeat(i)}
            onRollLanded={() => landed(idKey.split("|")[i])}
          />
        ))}
        {roll.active ? (
          <RollControls />
        ) : (
          <>
          <button
            className="medallion side"
            aria-label="Life log"
            onClick={() => setLogOpen(true)}
            data-testid="open-log"
          >
            <TimeBack size={24} />
          </button>
          <button
            className="medallion"
            aria-label="Game menu"
            onClick={() => setMenuOpen(true)}
            data-testid="menu-button"
          >
            <MenuAlt01 size={26} />
          </button>
          </>
        )}
      </main>
      {menuOpen && !roll.active && <Menu onClose={() => setMenuOpen(false)} />}
      {logOpen && !roll.active && <LifeLog onClose={() => setLogOpen(false)} />}
    </>
  );
}
