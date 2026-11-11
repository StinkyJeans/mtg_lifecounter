/**
 * Haptic tick where the Vibration API exists (Android). iOS has none, so the
 * visible flash in the panel is the real feedback; this only adds to it.
 */
export function tick(ms = 8): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}
