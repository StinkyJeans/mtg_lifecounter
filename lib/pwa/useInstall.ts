"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "mtg-life:ios-hint-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOs;
}

export interface InstallState {
  /** Android/desktop Chromium: native prompt is ready. */
  canPrompt: boolean;
  /** iOS Safari, not installed, hint not dismissed. */
  showIosHint: boolean;
  promptInstall(): Promise<void>;
  dismissIosHint(): void;
}

export function useInstall(): InstallState {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only detection, must run after mount
    setShowIosHint(isIos() && !isStandalone() && !dismissed);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  }, [event]);

  const dismissIosHint = useCallback(() => {
    setShowIosHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  return { canPrompt: event !== null, showIosHint, promptInstall, dismissIosHint };
}
