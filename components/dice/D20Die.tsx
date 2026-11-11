"use client";

import { useEffect, useRef, useState } from "react";
import { Die } from "../Icons";
import { MANA_HEX } from "@/lib/game/rules";
import type { ManaColor } from "@/lib/game/types";
import { stoneFor } from "@/lib/dice/palette";
import type { D20Handle } from "@/lib/dice/d20Scene";

interface Props {
  color: ManaColor;
  /** The already-decided result, or null before this player has rolled. */
  value: number | null;
  /** Called once the die has finished landing (immediately when WebGL is unavailable). */
  onLanded: () => void;
}

/**
 * 3D d20 (three.js, loaded only here). The component never picks a number: when
 * `value` goes from null to a number it tumbles and lands on exactly that face.
 * A value present at mount (restored after a reload) is shown landed, no tumble.
 */
export function D20Die({ color, value, onLanded }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<D20Handle | null>(null);
  const todo = useRef<{ roll: boolean; value: number | null }>({ roll: false, value });
  const prev = useRef(value);
  const landed = useRef(onLanded);
  const [ready, setReady] = useState(false);
  const [flat, setFlat] = useState(false);
  const flatRef = useRef(false);

  useEffect(() => {
    landed.current = onLanded;
  });

  const apply = () => {
    const h = handle.current;
    const t = todo.current;
    if (!h) return;
    if (t.roll && t.value != null) h.roll(t.value, () => landed.current());
    else h.show(t.value);
  };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    import("@/lib/dice/d20Scene")
      .then(({ mountD20 }) =>
        mountD20(el, {
          color: stoneFor(MANA_HEX[color]),
          value: null,
        }),
      )
      .then((h) => {
        if (cancelled) return h.dispose();
        handle.current = h;
        setReady(true);
        apply();
      })
      .catch(() => {
        if (cancelled) return;
        flatRef.current = true;
        setFlat(true); // no WebGL or chunk unavailable: show the number flat
        if (todo.current.roll) landed.current();
      });
    return () => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
    };
    // The scene is built once per seat color; value changes are handled below.
  }, [color]);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    todo.current = { roll: value != null, value };
    if (flatRef.current) {
      if (value != null) landed.current();
      return;
    }
    apply();
  }, [value]);

  return (
    <div ref={host} className="die-host" data-ready={ready}>
      {!ready && !flat && <Die className="die-ph" strokeWidth={0.8} />}
      {flat && <div className="die-flat">{value ?? "?"}</div>}
    </div>
  );
}
