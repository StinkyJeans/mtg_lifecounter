# Ledger — MTG life counter (offline PWA)

Local-first Magic: The Gathering life counter. 2 or 4 players, installable, plays fully offline. No account, no network required.

```
npm run dev         # dev server (service worker is disabled in dev)
npm run build       # stamps public/sw.js, then next build
npm start           # production server (needed to test PWA behaviour)
npm test            # Vitest: life math, win/loss rules, state restore
npm run test:e2e    # Playwright: manifest, SW, offline, rotation (builds + serves on :3100)
```

On Windows, run Vitest from a path with an upper-case drive letter (`C:\...`); a lower-case `c:` cwd breaks its runner.

## Design direction

Dark battlefield tabletop. One base (charred oak `#14110d`), one accent (worn brass `#c9a24b`), seats colored by the five mana colors. Cinzel for life totals, Spectral for text. Paper grain is a 600-byte inline SVG filter; card-frame borders are two uneven rules. Icons are hand-cut SVG paths. Motion is a 140 ms number roll, a 260 ms flash, and a 600 ms defeat fade (transform/opacity only).

## Wireframes (phone, portrait)

```
MODE SELECT              2 PLAYERS               4 PLAYERS (across)      4 PLAYERS (around)
┌────────────────────┐   ┌────────────────────┐  ┌──────────┬─────────┐  ┌──────────┬─────────┐
│ ◇ LEDGER           │   │ ◇ P1 (upside down) │  │ ◇ P1  ↕  │  P2 ↕ ◇ │  │ P1 →     │     ← P2│
│                    │   │        21          │  │   40     │   40    │  │ (turned  │ (turned │
│ WHO IS AT THE      │   │ +              −   │  │ +     −  │ +    −  │  │  90° CW) │ 90° CCW)│
│ TABLE?             │   ├────── ( ≡ ) ───────┤  ├───── ( ≡ ) ────────┤  ├───── ( ≡ ) ────────┤
│ ┌────────────────┐ │   │ −              +   │  │ −     +  │ −    +  │  │ P3 →     │     ← P4│
│ │ Two players  2 │ │   │        17          │  │   40     │   40    │  │          │         │
│ └────────────────┘ │   │ P2 ◇               │  │ ◇ P3     │    P4 ◇ │  │          │         │
│ ┌────────────────┐ │   └────────────────────┘  └──────────┴─────────┘  └──────────┴─────────┘
│ │ Four players 4 │ │   Left half of a seat = −, right half = +,
│ └────────────────┘ │   in the seat's own orientation. ( ≡ ) opens the menu.
│ STARTING LIFE      │
│ [−]  20  [+] 20 40 │
│ [ BEGIN          ] │
└────────────────────┘
```

**Tablet / landscape:** every layout is container-query sized, so panels scale. In landscape the 2-player table switches to left/right seats turned 90°, since players then sit at the short ends. 4-player keeps its 2×2 grid. The manifest asks for portrait; the layouts still handle both, and nothing relies on the orientation-lock API.

## Folder structure

```
app/              layout (fonts, viewport), manifest.ts, page, globals.css
components/       UI only: App, ModeSelect, GameBoard, PlayerPanel, Menu, PwaNotices, Icons, useLifeGesture
lib/game/         types.ts (state model), rules.ts (pure life math + win/loss)
lib/store/        gameStore.ts (Zustand + persist; createGameStore(storage) for tests)
lib/pwa/          useWakeLock, useInstall, useServiceWorker, haptics
sw/               sw.template.js -> public/sw.js via scripts/stamp-sw.mjs at build
tests/  e2e/      Vitest / Playwright
```

## Data model

`GameState { phase, mode, startingLife, layout4, players[], history[], startedAt }`
`Player { id, name, color: W|U|B|R|G, life, counters{poison,energy,experience}, commanderDamage{sourceId:n} }`
`LifeEvent { id (uuid), playerId, delta, at }` — append-only; `history` is capped at 500 locally.

Poison, energy, experience and commander damage already exist in the model and in `defeatReason()` (10 poison, 21 from one commander), so the next phase only needs UI plus store actions. Undo is already per-player over `history`.

## Persistence

Zustand `persist` to localStorage, key `mtg-life:v1`, versioned. `skipHydration` + a manual `rehydrate()` after mount keeps SSR and first paint identical; a corrupt or empty store starts clean. IndexedDB is not needed at this size; swap `createJSONStorage` if history grows.

## PWA notes

- `public/sw.js` is generated per build. On install it fetches `/`, parses every `/_next/static/...` URL, walks the CSS for the self-hosted font files, and caches all of it plus the icons and manifest in one versioned cache. Navigation is cache-first from that cache, so HTML and chunk hashes always match.
- Update flow: the new worker waits. `useServiceWorker` shows "A new version is ready" and, on Reload, posts `SKIP_WAITING`; the page reloads on `controllerchange` (not on first install).
- After the build, `stamp-sw.mjs --post` embeds every file Next emitted under `/_next/static` into the precache list, so lazily loaded chunks (three.js for the dice) work offline without ever having been used online.
- **Roll for first player** opens after Begin (and from the menu); Skip is always visible. Each player taps their own die once per round; the highest roll gets a gold frame and "Goes first", and the turn order runs clockwise from them. Ties re-roll only the tied players while the rest stay locked and dimmed. The state (`diceRoll`, `firstPlayerId`) is persisted, so a reload mid-roll restores the dice.
  - Results come from `rollDie()` in `lib/game/dice.ts` (`crypto.getRandomValues`, rejection sampling, no modulo bias) and are written to the store before any animation starts. The 3D die is only told which face to land on.
  - d20 is three.js (`lib/dice/`, loaded only on this screen): an icosahedron with opposite faces summing to 21, matte stone with engraved gold numerals. d6 is a CSS 3D cube. Both roll for ~1.15 s using transforms only (thrown, bounce off the card frame, roll back, land on the chosen face); the roll always plays, whatever the OS motion setting is. After the winner is shown the game starts by itself (tap Start game to skip the wait); Without WebGL a flat number is shown.
- The service worker only registers in production builds.
- Wake lock is held while a game is on screen and re-requested on `visibilitychange`. `navigator.vibrate` is a bonus on Android; the visible flash is the real feedback (iOS has no vibration).
- iOS: no `beforeinstallprompt`, so a dismissible "Share, then Add to Home Screen" hint is shown. `viewport-fit=cover`, safe-area padding, `black-translucent` status bar.
- `user-scalable=no` is set deliberately to stop double-tap zoom during play; the app's own controls are all large.

## Mode select screen

Background recipe, bottom to top: warm ink `#14110d`, a darker vignette toward the edges, a lighter warm center, ~4% paper grain (`public/textures/grain-paper.svg`) and a faint diamond lattice fading up from the bottom (`public/textures/ruled-diamonds.svg`, ~9% stroke opacity). Nothing animates. Both textures are in the service worker's shell list, so they work offline.

Begin goes straight to the life counter; "Roll for first player" starts the game with the roll step open. The cards share the free height (min 140 px), the starting life defaults to 20/40 per mode until the player changes it, and Begin plus the link stay pinned in the thumb zone on short phones. "Resume game" appears only when a saved game is sitting on the setup screen.

## Dice performance notes

- `warmUp()` (in `lib/dice/d20Scene.ts`) runs at idle on the setup screen: loads three.js, builds the model and the default seats' texture atlases, so the roll step opens with nothing left to prepare.
- Each die's canvas is only as large as its travel area, at pixel ratio <= 1.5, with a Lambert (not PBR) material and a cached, smaller texture atlas.
- While the roll step is open, its overlay is fully opaque and the life panels underneath are not painted.

## PWA verification checklist

Use a production build served over HTTPS (or `localhost`). `npm run build && npm start`, then tunnel or deploy.

**Android Chrome**
- [ ] DevTools > Application > Manifest: no errors; maskable icon preview looks right.
- [ ] Menu > Install app (or the in-app "Install" prompt) installs; opens standalone with no URL bar.
- [ ] Open once online, switch to airplane mode, kill the app, reopen: it loads and plays.
- [ ] Application > Service Workers: activated and running; Cache Storage has `mtg-life-*` with `.woff2` fonts.
- [ ] Play a game, force-close, reopen offline: scores restored.
- [ ] Screen stays awake during a game; lock and unlock, it stays awake again.
- [ ] Hold a zone: steps of 5, light vibration. No text selection or context menu on long press; no pull-to-refresh.
- [ ] Deploy a new build, reopen online: "A new version is ready" appears; Reload applies it.

**iOS Safari (installed)**
- [ ] Share > Add to Home Screen; the hint shows in Safari before install and not after.
- [ ] Launches full screen; status bar overlays; content clears the notch and home indicator.
- [ ] Airplane mode, launch from the home screen: loads, plays, restores after force-quit.
- [ ] No double-tap zoom, no rubber-band scroll, no callout on long-press.
- [ ] Screen stays awake (iOS 16.4+ installed apps).
- [ ] Rotation: both orientations lay out correctly (2-player turns to side seats in landscape).
- [ ] Note: iOS may evict storage for PWAs unused for ~7 days in-browser; an installed app is exempt.

**Devices to cover:** ~5" phone (360x640), ~6.7" phone (430x932), one tablet. Playwright covers the first two viewports.
