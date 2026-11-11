import { expect, test, type Page } from "@playwright/test";

const life = (page: Page, i: number) => page.getByTestId(`panel-${i}`).getByTestId("life");

/** Starts a game with Begin: straight to the life counter. */
async function begin(page: Page, mode: 2 | 4) {
  await page.goto("/");
  await page.getByTestId(`mode-${mode}`).click();
  await page.getByTestId("begin").click();
  await expect(page.getByTestId("board")).toBeVisible();
  await expect(page.getByTestId("roll-skip")).toHaveCount(0);
}

/** Starts a game with "Roll for first player" and stays on the roll step. */
async function beginWithRoll(page: Page, mode: 2 | 4) {
  await page.goto("/");
  await page.getByTestId(`mode-${mode}`).click();
  await page.getByTestId("roll-link").click();
  await expect(page.getByTestId("board")).toBeVisible();
  await expect(page.getByTestId("die-0")).toBeVisible();
}

type Snapshot = { winner: number; labels: string[]; values: number[] };

/** Read every die in ONE page call: after the reveal the game starts by itself, so don't read piecemeal. */
const snapshot = (page: Page) =>
  page.evaluate<Snapshot | null>(() => {
    const won = document.querySelector('.roll[data-won="true"]');
    if (!won) return null;
    const dice = [...document.querySelectorAll('[data-testid^="die-"]')];
    return {
      winner: Number(won.getAttribute("data-testid")!.replace("die-", "")),
      labels: dice.map((d) => d.querySelector(".verdict")?.textContent ?? ""),
      values: dice.map((d) => Number(d.querySelector("output")?.textContent)),
    };
  });

/** Taps every die that may roll, repeating through tie rounds, and returns the moment a winner is shown. */
async function rollUntilWinner(page: Page, seats: number): Promise<Snapshot> {
  for (let guard = 0; guard < 40; guard++) {
    const snap = await snapshot(page);
    if (snap) return snap;
    for (let i = 0; i < seats; i++) {
      const die = page.getByTestId(`die-${i}`);
      if ((await die.getAttribute("data-can-roll")) === "true") await die.click();
    }
    await page.waitForTimeout(300);
  }
  throw new Error("no winner after 40 attempts");
}

const dieValue = (page: Page, i: number) => page.getByTestId(`die-${i}`).locator("output").innerText();

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("manifest is valid and installable", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const m = await (await request.get(href!)).json();
  expect(m).toMatchObject({ display: "standalone", orientation: "portrait", start_url: "/" });
  expect(m.name).toBeTruthy();
  expect(m.short_name).toBeTruthy();
  const purposes = m.icons.map((i: { purpose?: string }) => i.purpose);
  expect(purposes).toContain("maskable");
  expect(purposes).toContain("any");
  for (const icon of m.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  expect(await page.locator('meta[name="viewport"]').getAttribute("content")).toContain("viewport-fit=cover");
});

test("service worker takes control and precaches the shell", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith("mtg-life-"))!);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached).toContain("/");
  expect(cached.some((p) => p.endsWith(".woff2"))).toBe(true); // self-hosted fonts
  expect(cached.some((p) => p.endsWith(".js"))).toBe(true);
});

test("loads and plays fully offline, and the game survives a reload", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled

  await context.setOffline(true);
  await page.reload();
  await begin(page, 2);
  await page.getByTestId("plus-1").click();
  await expect(life(page, 1)).toHaveText("21");

  await page.reload(); // restore from local storage, still offline
  await expect(page.getByTestId("board")).toBeVisible();
  await expect(life(page, 1)).toHaveText("21");
  await context.setOffline(false);
});

test("two players: top panel is rotated 180 and its tap zones rotate with it", async ({ page }) => {
  await begin(page, 2);

  const m = async (id: string) =>
    page.getByTestId(id).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform));
  const top = await m("seat-0");
  const bottom = await m("seat-1");
  expect([Math.round(top.a), Math.round(top.d)]).toEqual([-1, -1]);
  expect([Math.round(bottom.a), Math.round(bottom.d)]).toEqual([1, 1]);

  // Top player's "+" zone is local-right, which is screen-LEFT of the top half.
  const plus0 = (await page.getByTestId("plus-0").boundingBox())!;
  const minus0 = (await page.getByTestId("minus-0").boundingBox())!;
  expect(plus0.x).toBeLessThan(minus0.x);
  // Bottom player is the opposite.
  const plus1 = (await page.getByTestId("plus-1").boundingBox())!;
  const minus1 = (await page.getByTestId("minus-1").boundingBox())!;
  expect(plus1.x).toBeGreaterThan(minus1.x);

  // A real tap at the screen position of the top "+" zone hits player 0 only.
  await page.mouse.click(plus0.x + plus0.width / 2, plus0.y + plus0.height * 0.7);
  await expect(life(page, 0)).toHaveText("21");
  await expect(life(page, 1)).toHaveText("20");
});

test("four players: across layout rotates the top two; around layout rotates by 90", async ({ page }) => {
  await begin(page, 4);
  const a = async (i: number) =>
    page.getByTestId(`seat-${i}`).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect([await a(0), await a(1)].map(Math.round)).toEqual([-1, -1]);
  expect([await a(2), await a(3)].map(Math.round)).toEqual([1, 1]);

  await page.getByTestId("menu-button").click();
  await page.getByRole("button", { name: "Around" }).click();
  await page.getByRole("button", { name: "Back to the game" }).click();
  const b = async (i: number) =>
    page.getByTestId(`seat-${i}`).evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return [Math.round(m.a), Math.round(m.b)];
    });
  expect(await b(0)).toEqual([0, 1]); // +90
  expect(await b(1)).toEqual([0, -1]); // -90
  await expect(life(page, 0)).toHaveText("40");
});

test("hold repeats in steps of five; defeat shows and can be undone", async ({ page }) => {
  await begin(page, 2);
  const minus = (await page.getByTestId("minus-1").boundingBox())!;
  await page.mouse.move(minus.x + minus.width / 2, minus.y + minus.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  const after = Number(await life(page, 1).innerText().then((t) => t.replace("\u2212", "-")));
  // one -1 on press, then whole steps of -5 while held (how many depends on machine speed)
  const drop = 20 - after;
  expect(drop).toBeGreaterThanOrEqual(6);
  expect((drop - 1) % 5).toBe(0);

  for (let i = 0; i < 6 && !(await page.getByTestId("defeated-1").isVisible()); i++) {
    await page.mouse.move(minus.x + minus.width / 2, minus.y + minus.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1300);
    await page.mouse.up();
  }
  await expect(page.getByTestId("defeated-1")).toBeVisible();
  // Each undo reverts one life event; holding produced several, so undo until alive.
  for (let i = 0; i < 40 && (await page.getByTestId("defeated-1").count()) > 0; i++) {
    await page.getByTestId("defeated-1").getByRole("button", { name: "Undo" }).click();
  }
  await expect(page.getByTestId("defeated-1")).toHaveCount(0);
  expect(Number(await life(page, 1).innerText())).toBeGreaterThan(0);
});

test("reset and leave both ask for confirmation", async ({ page }) => {
  await begin(page, 2);
  await page.getByTestId("plus-1").click();
  await page.getByTestId("menu-button").click();
  await page.getByTestId("reset").click();
  await page.getByRole("button", { name: "Keep playing" }).click(); // back to the menu sheet
  await page.getByTestId("reset").click();
  await page.getByTestId("confirm").click();
  await expect(life(page, 1)).toHaveText("20");

  await page.getByTestId("menu-button").click();
  await page.getByTestId("leave").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("mode-select")).toBeVisible();
});

test("the roll step opens from 'Roll for first player' and Skip is always visible", async ({ page }) => {
  await beginWithRoll(page, 2);
  await expect(page.getByTestId("roll-skip")).toBeVisible();
  await page.getByTestId("die-0").click(); // mid-roll, Skip is still there
  await expect(page.getByTestId("roll-skip")).toBeVisible();
  await page.getByTestId("roll-skip").click();
  await expect(page.getByTestId("die-0")).toHaveCount(0);
  await expect(page.locator(".first-mark")).toHaveCount(0); // skipped: no first player
  await expect(life(page, 0)).toHaveText("20");
});

test("2 players: each taps their own die once; highest goes first; the game then starts by itself", async ({ page }) => {
  await beginWithRoll(page, 2);
  await expect(page.getByTestId("die-0")).toHaveAttribute("data-can-roll", "true");

  await page.getByTestId("die-1").click();
  await expect(page.getByTestId("die-1")).toHaveAttribute("data-can-roll", "false");
  const locked = await dieValue(page, 1);
  expect(Number(locked)).toBeGreaterThanOrEqual(1);
  expect(Number(locked)).toBeLessThanOrEqual(20);
  await page.getByTestId("die-1").click({ force: true }); // accidental extra taps
  await page.getByTestId("die-1").click({ force: true });
  expect(await dieValue(page, 1)).toBe(locked); // never re-rolls

  const snap = await rollUntilWinner(page, 2);
  expect(snap.labels.filter((l) => l === "Goes first")).toHaveLength(1);
  expect(snap.labels.filter((l) => l === "Second")).toHaveLength(1);
  expect(snap.values[snap.winner]).toBeGreaterThan(snap.values[1 - snap.winner]);

  // No tap needed: the dice close and the life counter is there.
  await expect(page.getByTestId("die-0")).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByTestId("roll-skip")).toHaveCount(0);
  await expect(page.getByTestId(`first-${snap.winner}`)).toBeVisible();
  await expect(page.getByTestId(`first-${1 - snap.winner}`)).toHaveCount(0);
  await expect(life(page, 0)).toHaveText("20"); // life counter untouched
  await page.getByTestId("plus-1").click(); // and it is playable straight away
  await expect(life(page, 1)).toHaveText("21");
});

test("Start game skips the short wait and starts immediately", async ({ page }) => {
  await beginWithRoll(page, 2);
  await rollUntilWinner(page, 2);
  await page.getByTestId("roll-start").click();
  await expect(page.getByTestId("die-0")).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator(".first-mark")).toHaveCount(1);
});

test("4 players: every seat has a die and turn order runs clockwise from the winner", async ({ page }) => {
  await beginWithRoll(page, 4);
  for (let i = 0; i < 4; i++) await expect(page.getByTestId(`die-${i}`)).toBeVisible();
  const { labels } = await rollUntilWinner(page, 4);
  expect([...labels].sort()).toEqual(["Fourth", "Goes first", "Second", "Third"]);

  const ring = [0, 1, 3, 2]; // TL, TR, BR, BL
  const start = ring.indexOf(labels.indexOf("Goes first"));
  const expected = ["Goes first", "Second", "Third", "Fourth"];
  ring.forEach((seat, k) => expect(labels[seat]).toBe(expected[(k - start + 4) % 4]));
  await expect(page.getByTestId("die-0")).toHaveCount(0, { timeout: 5000 }); // then it just starts
});

test("dice are rotated toward their seats like the life panels", async ({ page }) => {
  await beginWithRoll(page, 2);
  const top = await page
    .getByTestId("seat-0")
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform));
  expect([Math.round(top.a), Math.round(top.d)]).toEqual([-1, -1]);
  // The die sits inside the rotated seat, so a tap at its screen position hits that seat.
  const box = (await page.getByTestId("die-0").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("die-0")).toHaveAttribute("data-can-roll", "false");
  await expect(page.getByTestId("die-1")).toHaveAttribute("data-can-roll", "true");
});

test("d6 setting: a CSS 3D cube rolls 1 to 6", async ({ page }) => {
  await beginWithRoll(page, 2);
  await page.getByTestId("roll-d6").click();
  await expect(page.getByTestId("d6")).toHaveCount(2);
  const { values } = await rollUntilWinner(page, 2);
  for (const n of values) {
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(6);
  }
});

test("Reroll all restarts the round", async ({ page }) => {
  await beginWithRoll(page, 2);
  await expect(page.getByTestId("roll-reroll")).toHaveCount(0); // nothing rolled yet
  await page.getByTestId("die-0").click();
  await page.getByTestId("roll-reroll").click();
  await expect(page.getByTestId("die-0")).toHaveAttribute("data-can-roll", "true");
});

test("a reload mid-roll restores the locked dice", async ({ page }) => {
  await beginWithRoll(page, 4);
  await page.getByTestId("die-0").click();
  await page.getByTestId("die-2").click();
  const v0 = await dieValue(page, 0);
  const v2 = await dieValue(page, 2);
  await page.waitForTimeout(1500); // let both land
  await page.reload();
  await expect(page.getByTestId("die-0")).toBeVisible();
  expect(await dieValue(page, 0)).toBe(v0);
  expect(await dieValue(page, 2)).toBe(v2);
  await expect(page.getByTestId("die-0")).toHaveAttribute("data-can-roll", "false");
  await expect(page.getByTestId("die-1")).toHaveAttribute("data-can-roll", "true");
});

test("the roll step is reachable from the in-game menu", async ({ page }) => {
  await begin(page, 2);
  await page.getByTestId("menu-button").click();
  await page.getByTestId("roll-first").click();
  await expect(page.getByTestId("die-0")).toBeVisible();
  await expect(page.getByTestId("roll-skip")).toBeVisible();
  await page.getByTestId("roll-skip").click();
  await expect(life(page, 1)).toHaveText("20");
});

test("rolling works fully offline (3D chunk is precached)", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await beginWithRoll(page, 2);
  const snap = await rollUntilWinner(page, 2);
  expect(snap.labels.filter((l) => l === "Goes first")).toHaveLength(1);
  await expect(page.getByTestId("die-0")).toHaveCount(0, { timeout: 5000 }); // starts by itself, offline too
  await page.getByTestId("menu-button").click();
  await page.getByTestId("roll-first").click(); // a die view again, to see what rendered
  await expect(page.getByTestId("die-0")).toBeVisible();
  // WebGL ran (canvas) or, on a GPU-less CI box, the flat fallback did.
  const rendered =
    (await page.locator(".die-host canvas").count()) + (await page.locator(".die-flat").count());
  expect(rendered).toBeGreaterThan(0);
  await context.setOffline(false);
});

test("the die always rolls, even when the OS asks for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // e.g. Windows "Animation effects" off
  await page.goto("/");
  await page.getByTestId("mode-2").click();
  await page.getByTestId("roll-link").click();
  await expect(page.locator('[data-testid="die-1"] canvas')).toBeVisible();
  await page.waitForTimeout(400); // let the scene finish its first paint
  await page.getByTestId("die-1").click();
  const verdict = page.getByTestId("die-1").locator(".verdict");
  // A fade would have landed instantly. A real roll takes ~1.15 s.
  await page.waitForTimeout(700);
  await expect(verdict).toHaveText("");
  await expect(verdict).toHaveText("Rolled", { timeout: 3000 });
});

test.describe("mode select screen", () => {
  test("warm ink background, not flat black, and it fills the screen", async ({ page }) => {
    await page.goto("/");
    const bg = await page.getByTestId("mode-select").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(20, 17, 13)"); // #14110d
    const vh = page.viewportSize()!.height;
    const begin = (await page.getByTestId("begin").boundingBox())!;
    const link = (await page.getByTestId("roll-link").boundingBox())!;
    expect(link.y + link.height).toBeGreaterThan(vh - 40); // actions sit at the bottom
    expect(begin.height).toBeGreaterThanOrEqual(56);
    const cards = [(await page.getByTestId("mode-2").boundingBox())!, (await page.getByTestId("mode-4").boundingBox())!];
    for (const c of cards) expect(c.height).toBeGreaterThanOrEqual(139);
    // cards share the free height instead of leaving a dead gap
    const lifeBox = (await page.getByTestId("starting-life").boundingBox())!;
    expect(lifeBox.y - (cards[1].y + cards[1].height)).toBeLessThan(120);
  });

  test("selected card is clearly marked; text never sits under the ghost numeral", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("mode-2")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("mode-4").click();
    await expect(page.getByTestId("mode-4")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("mode-2")).toHaveAttribute("aria-pressed", "false");
    for (const m of [2, 4]) {
      const card = page.getByTestId(`mode-${m}`);
      const text = (await card.locator(".slab-text").boundingBox())!;
      const ghost = (await card.locator(".ghost").boundingBox())!;
      expect(text.x + text.width).toBeLessThanOrEqual(ghost.x + 1);
      await expect(card.locator("svg.seats")).toBeVisible(); // seating diagram
    }
  });

  test("starting life follows the mode until the player changes it; big buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("starting-life")).toHaveText("20");
    await page.getByTestId("mode-4").click();
    await expect(page.getByTestId("starting-life")).toHaveText("40");
    await page.getByTestId("mode-2").click();
    await expect(page.getByTestId("starting-life")).toHaveText("20");

    for (const id of ["life-minus", "life-plus"]) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(56);
      expect(box.height).toBeGreaterThanOrEqual(56);
    }
    await page.getByTestId("life-plus").click();
    await expect(page.getByTestId("starting-life")).toHaveText("25");
    await page.getByTestId("mode-4").click();
    await expect(page.getByTestId("starting-life")).toHaveText("25"); // touched: no longer follows the mode
    await page.getByTestId("preset-40").click();
    await expect(page.getByTestId("starting-life")).toHaveText("40");
    await page.getByTestId("preset-20").click();
    await expect(page.getByTestId("starting-life")).toHaveText("20");
  });

  test("Begin goes straight to the game; the link opens the roll step", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("begin").click();
    await expect(page.getByTestId("board")).toBeVisible();
    await expect(page.getByTestId("die-0")).toHaveCount(0);
    await expect(life(page, 0)).toHaveText("20");

    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await page.getByTestId("roll-link").click();
    await expect(page.getByTestId("die-0")).toBeVisible();
  });

  test("no 'Resume game' entry without a saved game; all targets are at least 48px", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("resume")).toHaveCount(0);
    for (const id of ["mode-2", "mode-4", "life-minus", "life-plus", "preset-20", "preset-40", "begin", "roll-link"]) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.height, id).toBeGreaterThanOrEqual(48);
      expect(box.width, id).toBeGreaterThanOrEqual(48);
    }
  });

  test("the texture assets are cached for offline use", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const cache = await caches.open(keys.find((k) => k.startsWith("mtg-life-"))!);
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });
    expect(cached).toContain("/textures/grain-paper.svg");
    expect(cached).toContain("/textures/ruled-diamonds.svg");
  });
});
