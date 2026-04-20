import {
  type Browser,
  type BrowserContext,
  type Page,
  expect,
  test,
} from "@playwright/test";

function uniqueTag(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

async function signUp(
  page: Page,
  prefix: string,
  options?: {
    email?: string;
  },
) {
  const tag = uniqueTag(prefix);
  const username = tag.replace(/[^a-z0-9_]/gi, "").slice(0, 24);
  const email = options?.email ?? `${tag}@example.com`;

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Summon the card. Break the board. Take the table.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Wallet auth ready")).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Create wallet seat" }).click();

  await expect(page.getByText("Signup complete")).toBeVisible();
  await expect(page.getByText("Private key reveal")).toBeVisible();

  return {
    email,
    username,
  };
}

async function createStarterDeck(page: Page) {
  const createStarterDeckButton = page.getByRole("button", {
    name: "Create starter deck",
  });

  await expect(createStarterDeckButton).toBeEnabled();
  await createStarterDeckButton.click();
  await expect(page.getByText("Starter deck created")).toBeVisible();
}

async function createPracticeMatch(page: Page) {
  await expect(page.getByRole("heading", { name: "Game Lobby" })).toBeVisible();

  const createPracticeMatchButton = page.getByRole("button", {
    name: "Create practice match",
  });

  await expect(createPracticeMatchButton).toBeEnabled();
  await createPracticeMatchButton.click();
  await expect(page.getByText("Practice match created")).toBeVisible();
  await expect(
    page.getByText("Live Match Shell", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Replay frames: \d+/)).toBeVisible();
}

async function keepOpeningHand(page: Page) {
  const keepButton = page.getByRole("button", { name: "keep" });

  await expect(keepButton).toBeVisible();
  await keepButton.click();
  await expect(page.getByText("Intent applied")).toBeVisible();
}

async function clickControl(page: Page, name: string) {
  const control = page.getByRole("button", { name });
  await control.scrollIntoViewIfNeeded();
  await control.click({ force: true });
}

async function createSignedInDeckedUser(page: Page, prefix: string) {
  await signUp(page, prefix);
  await createStarterDeck(page);
}

async function newPage(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await browser.newContext();
  const page = await context.newPage();
  return {
    context,
    page,
  };
}

test.describe.configure({ mode: "serial" });

test("creates a starter deck, a practice match, and non-authoritative agent threads", async ({
  page,
}) => {
  await createSignedInDeckedUser(page, "practice");
  await createPracticeMatch(page);

  await clickControl(page, "Open coach");
  await expect(page.getByText("Coach thread ready")).toBeVisible();

  await page.getByLabel("Prompt").fill("Explain the strongest line.");
  await clickControl(page, "Send prompt");
  await expect(page.getByText("Coach reply generated")).toBeVisible();
  await expect(
    page
      .locator(".agent-message-text")
      .filter({ hasText: "Coach mode is advisory only." })
      .first(),
  ).toBeVisible();

  await clickControl(page, "Open commentator");
  await expect(page.getByText("Commentator thread ready")).toBeVisible();
  await expect(page.getByText("Commentator conversation")).toBeVisible();
});

test("connects a live gameplay agent to a practice match and advances through mulligan", async ({
  page,
}) => {
  await createSignedInDeckedUser(page, "bot-practice");
  await createPracticeMatch(page);

  const liveArena = page.locator(".site-arena-stage .match-shell").first();
  await keepOpeningHand(page);
  await expect(
    liveArena.getByText("main1 · turn 1", { exact: true }),
  ).toBeVisible();
  await expect(liveArena.getByText("Phase: mulligan -> main1")).toBeVisible();
});

test("completes a practice match by concession and refreshes replay status", async ({
  page,
}) => {
  await createSignedInDeckedUser(page, "practice-complete");
  await createPracticeMatch(page);
  await keepOpeningHand(page);

  const liveArena = page.locator(".site-arena-stage .match-shell").first();
  const replaySection = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Deterministic spectator frames",
      }),
    })
    .first();

  await liveArena
    .getByRole("button", { name: "Concede match" })
    .click({ force: true });

  await expect(page.getByText("Intent applied")).toBeVisible();
  await expect(page.getByText(/Replay frames: \d+ · complete/)).toBeVisible();
  await expect(replaySection.getByText("complete")).toBeVisible();
  await expect(replaySection.getByText("seat-1")).toBeVisible();
});

test("restores a completed practice match after reload", async ({ page }) => {
  await createSignedInDeckedUser(page, "practice-resume");
  await createPracticeMatch(page);
  await keepOpeningHand(page);

  const replaySection = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Deterministic spectator frames",
      }),
    })
    .first();

  await page
    .locator(".site-arena-stage .match-shell")
    .first()
    .getByRole("button", { name: "Concede match" })
    .click({ force: true });

  await expect(page.getByText(/Replay frames: \d+ · complete/)).toBeVisible();
  await expect(replaySection.getByText("seat-1")).toBeVisible();

  await page.reload();

  await expect(
    page.getByText("Live Match Shell", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Viewing live shell" }),
  ).toBeVisible();
  await expect(page.getByText(/Replay frames: \d+ · complete/)).toBeVisible();
  await expect(replaySection.getByText("complete")).toBeVisible();
  await expect(replaySection.getByText("seat-1")).toBeVisible();
});

test("creates and resolves a private lobby match across two isolated users", async ({
  browser,
}) => {
  const host = await newPage(browser);
  const guest = await newPage(browser);

  try {
    await createSignedInDeckedUser(host.page, "host");
    await createSignedInDeckedUser(guest.page, "guest");

    await host.page
      .getByRole("button", { name: "Create private lobby" })
      .click();
    await expect(host.page.getByText("Private lobby created")).toBeVisible();

    const joinCode = await host.page.getByLabel("Join with code").inputValue();

    await guest.page.getByLabel("Join with code").fill(joinCode);
    await guest.page.getByRole("button", { name: "Join" }).click();
    await expect(guest.page.getByText("Private lobby joined")).toBeVisible();

    await guest.page.getByRole("button", { name: "Set ready" }).click();
    await expect(guest.page.getByText("Ready state updated")).toBeVisible();

    await host.page.getByRole("button", { name: "Set ready" }).click();
    await expect(host.page.getByText("Private match created")).toBeVisible();
    await expect(
      host.page.getByText("Live Match Shell", { exact: true }),
    ).toBeVisible();
    await expect(host.page.getByText(/Replay frames: \d+/)).toBeVisible();

    await guest.page.reload();
    await expect(guest.page.getByText(/Match created:/)).toBeVisible();
  } finally {
    await host.context.close();
    await guest.context.close();
  }
});

test("creates and resolves a private lobby match against a table bot from the shared lobby surface", async ({
  page,
}) => {
  await createSignedInDeckedUser(page, "lobby-bot");

  await page.getByRole("button", { name: "Create private lobby" }).click();
  await expect(page.getByText("Private lobby created")).toBeVisible();

  await page.getByRole("button", { name: "Add table bot" }).click();
  await expect(page.getByText("Table bot added")).toBeVisible();
  await expect(page.getByText("Table Bot · guest · agent")).toBeVisible();

  await page.getByRole("button", { name: "Set ready" }).click();
  await expect(page.getByText("Private match created")).toBeVisible();

  await keepOpeningHand(page);

  const liveArena = page.locator(".site-arena-stage .match-shell").first();
  await expect(
    liveArena.getByText("main1 · turn 1", { exact: true }),
  ).toBeVisible();
  await expect(liveArena.getByText("Phase: mulligan -> main1")).toBeVisible();
});

test("enters the casual queue and resolves into a live match when an opponent is available", async ({
  browser,
}) => {
  const host = await newPage(browser);
  const guest = await newPage(browser);

  try {
    await createSignedInDeckedUser(host.page, "queue-host");
    await createSignedInDeckedUser(guest.page, "queue-guest");

    const hostQueuePanel = host.page
      .locator("section")
      .filter({
        has: host.page.getByRole("heading", {
          name: "Deterministic pairing",
        }),
      })
      .first();

    await host.page.getByRole("button", { name: "Enter casual queue" }).click();

    let hostMatchedImmediately = false;
    try {
      await expect(host.page.getByText("Entered casual queue")).toBeVisible({
        timeout: 3_000,
      });
    } catch {
      await expect(hostQueuePanel.getByText("matched")).toBeVisible();
      await expect(
        host.page.getByText("Live Match Shell", { exact: true }),
      ).toBeVisible();
      hostMatchedImmediately = true;
    }

    if (hostMatchedImmediately) {
      return;
    }

    await guest.page
      .getByRole("button", { name: "Enter casual queue" })
      .click();
    await expect(guest.page.getByText("Casual match created")).toBeVisible();
    await expect(
      guest.page.getByText("Live Match Shell", { exact: true }),
    ).toBeVisible();

    await host.page.reload();
    await expect(
      host.page.getByText("Live Match Shell", { exact: true }),
    ).toBeVisible();
    await expect(host.page.getByText(/Replay frames: \d+/)).toBeVisible();
  } finally {
    await host.context.close();
    await guest.context.close();
  }
});

test("shows operator controls for allowlisted accounts and can toggle format publication", async ({
  page,
}) => {
  const operatorEmail = `${uniqueTag("operator")}@example.com`;

  await signUp(page, "operator", {
    email: operatorEmail,
  });
  await createStarterDeck(page);

  await expect(page.getByText("Operator Controls")).toBeVisible();

  const unpublishButton = page.getByRole("button", {
    name: "Unpublish format",
  });
  await unpublishButton.scrollIntoViewIfNeeded();
  await unpublishButton.click();
  await expect(page.getByText("Format status updated")).toBeVisible();

  const publishButton = page.getByRole("button", {
    name: "Publish format",
  });
  await expect(publishButton).toBeVisible();
  await publishButton.click();
  await expect(
    page.getByRole("button", { name: "Unpublish format" }),
  ).toBeVisible();
  await expect(
    page.getByText("Stale matches and telemetry feed"),
  ).toBeVisible();
});
