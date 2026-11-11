"use client";

import { useState } from "react";
import { Cube, Download, LogOut, Refresh } from "griddy-icons";
import { useInstall } from "@/lib/pwa/useInstall";
import { gameStore, useGameStore } from "@/lib/store/gameStore";

type Confirming = null | "reset" | "leave";

export function Menu({ onClose }: { onClose: () => void }) {
  const mode = useGameStore((s) => s.mode);
  const layout4 = useGameStore((s) => s.layout4);
  const startingLife = useGameStore((s) => s.startingLife);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const install = useInstall();

  const run = () => {
    const s = gameStore.getState();
    if (confirming === "reset") s.resetGame();
    if (confirming === "leave") s.backToSelect();
    onClose();
  };

  return (
    <div className="scrim" onClick={onClose} data-testid="scrim">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={confirming ? "Confirm" : "Game menu"}
        onClick={(e) => e.stopPropagation()}
      >
        {confirming ? (
          <>
            <h2>{confirming === "reset" ? "Reset this game?" : "Leave this game?"}</h2>
            <p>
              {confirming === "reset"
                ? `Every player returns to ${startingLife} life. Names and colors stay.`
                : "The current game is discarded and you return to the table setup."}
            </p>
            <div className="row">
              <button className="btn seg" onClick={() => setConfirming(null)}>
                Keep playing
              </button>
              <button className="btn btn-danger seg" onClick={run} data-testid="confirm">
                {confirming === "reset" ? "Reset" : "Leave"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Game</h2>
            {mode === 4 && (
              <div>
                <div className="label" style={{ marginBottom: 8 }}>
                  Seating
                </div>
                <div className="row">
                  <button
                    className="btn seg"
                    aria-pressed={layout4 === "flip"}
                    onClick={() => gameStore.getState().setLayout4("flip")}
                  >
                    Across
                  </button>
                  <button
                    className="btn seg"
                    aria-pressed={layout4 === "sides"}
                    onClick={() => gameStore.getState().setLayout4("sides")}
                  >
                    Around
                  </button>
                </div>
              </div>
            )}
            <button
              className="btn"
              data-testid="roll-first"
              onClick={() => {
                gameStore.getState().startRoll();
                onClose();
              }}
            >
              <Cube size={22} /> Roll for first player
            </button>
            <div className="row">
              <button className="btn seg" onClick={() => setConfirming("reset")} data-testid="reset">
                <Refresh size={20} /> Reset game
              </button>
              <button className="btn seg" onClick={() => setConfirming("leave")} data-testid="leave">
                <LogOut size={20} /> New table
              </button>
            </div>
            {install.canPrompt && (
              <button className="btn" onClick={() => void install.promptInstall()}>
                <Download size={20} /> Install app
              </button>
            )}
            {install.showIosHint && (
              <p>Install: tap Share, then Add to Home Screen.</p>
            )}
            <button className="btn btn-solid" onClick={onClose}>
              Back to the game
            </button>
          </>
        )}
      </div>
    </div>
  );
}
