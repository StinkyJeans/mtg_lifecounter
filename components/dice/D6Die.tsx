"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { buildRoll, qAxisAngle, qMul, type Q } from "@/lib/dice/rollPath";

interface Props {
  value: number | null;
  onLanded: () => void;
}

const deg = (r: number) => (r * Math.PI) / 180;
const rx = (d: number) => qAxisAngle([1, 0, 0], deg(d));
const ry = (d: number) => qAxisAngle([0, 1, 0], deg(d));

/**
 * Cube orientation that brings each face to the viewer, as [rotateX, rotateY].
 * Faces: 1 front, 6 back, 3 right, 4 left, 2 top, 5 bottom (opposites sum to 7).
 */
const FACE: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0],
};
const IDLE: [number, number] = [-34, 42]; // corner toward the viewer: 1, 3 and 2 visible
const TILT = "rotateX(-12deg) rotateY(16deg)"; // resting tilt so the cube reads as solid
const WALL_INSET_PX = 16;

const poseQ = (f: [number, number]): Q => qMul(rx(f[0]), ry(f[1]));
const quatFor = (value: number | null): Q => poseQ(value == null ? IDLE : FACE[value]);

/** One constant function list, so every keyframe interpolates the same way. */
function css(q: Q, x = 0, y = 0, z = 0): string {
  const w = Math.min(1, Math.max(-1, q[3]));
  const angle = 2 * Math.acos(w);
  const s = Math.sqrt(1 - w * w);
  const axis = s < 1e-6 ? [0, 0, 1] : [q[0] / s, q[1] / s, q[2] / s];
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) ${TILT} rotate3d(${axis[0].toFixed(5)}, ${axis[1].toFixed(5)}, ${axis[2].toFixed(5)}, ${((angle * 180) / Math.PI).toFixed(3)}deg)`;
}

/** CSS 3D d6. Transform-only animation along the shared roll path; the result is decided by the caller. */
export function D6Die({ value, onLanded }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const cube = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const prev = useRef(value);
  const landed = useRef(onLanded);
  useEffect(() => {
    landed.current = onLanded;
  });

  // Layout effect: start the animation before the first paint of the new pose.
  useLayoutEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    prev.current = value;
    const el = cube.current;
    const st = stage.current;
    if (!el || !st || value == null) return; // reset: the style below already shows the idle pose

    // The cube rolls across the whole seat and bounces off the card frame.
    const unit = el.offsetWidth / 2;
    const dieStage = st.parentElement as HTMLElement;
    const seat = (dieStage.offsetParent as HTMLElement | null) ?? dieStage;
    const dxPx = dieStage.offsetLeft + dieStage.offsetWidth / 2 - seat.clientWidth / 2;
    const dyPx = dieStage.offsetTop + dieStage.offsetHeight / 2 - seat.clientHeight / 2;
    const roomX = Math.max(0.3, (seat.clientWidth / 2 - WALL_INSET_PX - Math.abs(dxPx)) / unit - 1.3);
    const roomY = Math.max(0.3, (seat.clientHeight / 2 - WALL_INSET_PX - Math.abs(dyPx)) / unit - 1.3);

    const path = buildRoll({ start: quatFor(from), target: quatFor(value), roomX, roomY, samples: 64 });
    const ms = path.duration * 1000;

    const cubeAnim = el.animate(
      path.q.map((q, i) => ({ transform: css(q, path.x[i] * unit, path.y[i] * unit, path.z[i] * unit) })),
      { duration: ms, easing: "linear" },
    );
    // shadow stays on the table: it follows x/y, spreads and fades with height
    shadow.current?.animate(
      path.q.map((_, i) => {
        const h = path.z[i];
        return {
          transform: `translate(${(path.x[i] + 0.1 + 0.3 * h) * unit}px, ${(path.y[i] + 0.14 + 0.35 * h) * unit}px) scale(${1 + 0.45 * h})`,
          opacity: 0.8 / (1 + 1.8 * h),
        };
      }),
      { duration: ms, easing: "linear" },
    );
    cubeAnim.onfinish = () => landed.current();
    return () => cubeAnim.cancel();
  }, [value]);

  return (
    <div ref={stage} className="d6-stage">
      <div ref={shadow} className="d6-shadow" />
      <div ref={cube} className="d6" style={{ transform: css(quatFor(value)) }} data-testid="d6">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="d6-face" data-face={n}>
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
