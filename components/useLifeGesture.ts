"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import { HOLD_STEP, TAP_STEP } from "@/lib/game/rules";

const HOLD_DELAY_MS = 450;
const REPEAT_MS = 200;

/**
 * Pointer-event tap and hold. Press applies +/-1 immediately (no click delay);
 * holding past HOLD_DELAY_MS then repeats +/-5 until release.
 * Returns props to spread onto a zone for a given sign.
 */
export function useLifeGesture(onStep: (delta: number) => void) {
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  });

  const stop = useCallback(() => {
    if (delay.current) clearTimeout(delay.current);
    if (repeat.current) clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  return useCallback(
    (sign: 1 | -1) => ({
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.button > 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        stop();
        step.current(sign * TAP_STEP);
        delay.current = setTimeout(() => {
          step.current(sign * HOLD_STEP);
          repeat.current = setInterval(() => step.current(sign * HOLD_STEP), REPEAT_MS);
        }, HOLD_DELAY_MS);
      },
      onPointerUp: stop,
      onPointerCancel: stop,
      onLostPointerCapture: stop,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    }),
    [stop],
  );
}
