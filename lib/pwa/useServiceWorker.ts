"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Registers /sw.js (production only) and surfaces the update flow: a new worker
 * waits instead of taking over mid-game; `applyUpdate` activates it and reloads.
 */
export function useServiceWorker(): { updateReady: boolean; applyUpdate(): void } {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    // First install claims the page too; only an *update* should reload.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const incoming = reg.installing;
          incoming?.addEventListener("statechange", () => {
            if (incoming.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(incoming);
            }
          });
        });
        // Long-lived installed PWAs rarely reload: check again when foregrounded.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => {});
        });
      })
      .catch(() => {
        /* offline-first still works without it on first load */
      });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  const applyUpdate = useCallback(() => {
    waiting?.postMessage({ type: "SKIP_WAITING" });
  }, [waiting]);

  return { updateReady: waiting !== null, applyUpdate };
}
