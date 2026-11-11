"use client";

import { Close } from "griddy-icons";
import { useInstall } from "@/lib/pwa/useInstall";
import { useServiceWorker } from "@/lib/pwa/useServiceWorker";

/** Update prompt (always) and the iOS add-to-home-screen hint (mode select only). */
export function PwaNotices({ showInstallHint }: { showInstallHint: boolean }) {
  const { updateReady, applyUpdate } = useServiceWorker();
  const install = useInstall();

  if (updateReady) {
    return (
      <div className="toast" role="status">
        <span style={{ flex: 1 }}>A new version is ready.</span>
        <button className="btn btn-solid" onClick={applyUpdate}>
          Reload
        </button>
      </div>
    );
  }

  if (showInstallHint && install.showIosHint) {
    return (
      <div className="toast" role="status" style={{ top: "auto", bottom: "calc(150px + env(safe-area-inset-bottom))" }}>
        <span style={{ flex: 1 }}>To install: tap Share, then Add to Home Screen.</span>
        <button className="btn" aria-label="Dismiss" onClick={install.dismissIosHint}>
          <Close size={18} />
        </button>
      </div>
    );
  }

  if (showInstallHint && install.canPrompt) {
    return (
      <div className="toast" role="status" style={{ top: "auto", bottom: "calc(150px + env(safe-area-inset-bottom))" }}>
        <span style={{ flex: 1 }}>Install for offline play.</span>
        <button className="btn btn-solid" onClick={() => void install.promptInstall()}>
          Install
        </button>
      </div>
    );
  }

  return null;
}
