"use client";

import { useEffect, useState } from "react";
import { GameBoard } from "./GameBoard";
import { ModeSelect } from "./ModeSelect";
import { PwaNotices } from "./PwaNotices";
import { useWakeLock } from "@/lib/pwa/useWakeLock";
import { gameStore, useGameStore } from "@/lib/store/gameStore";

export function App() {
  const [hydrated, setHydrated] = useState(false);
  const phase = useGameStore((s) => s.phase);

  // Restore after mount so server HTML and first client render agree.
  useEffect(() => {
    let live = true;
    Promise.resolve(gameStore.persist.rehydrate()).finally(() => live && setHydrated(true));
    return () => {
      live = false;
    };
  }, []);

  useWakeLock(hydrated && phase === "playing");

  if (!hydrated) return <div className="select" aria-busy="true" />;

  return (
    <>
      {phase === "playing" ? <GameBoard /> : <ModeSelect />}
      <PwaNotices showInstallHint={phase === "select"} />
    </>
  );
}
