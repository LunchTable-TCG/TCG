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

async function signUp(page: Page, prefix: string) {
  const tag = uniqueTag(prefix);
  const username = tag.replace(/[^a-z0-9_]/gi, "").slice(0, 24);
  const email = `${tag}@example.com`;

  await page.goto("/");
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

  await page.getByRole("button", { name: "Open coach" }).click();
  await expect(page.getByText("Coach thread ready")).toBeVisible();

  await page.getByRole("button", { name: "Send prompt" }).click();
  await expect(page.getByText("Coach reply generated")).toBeVisible();
  await expect(
    page
      .locator(".agent-message-text")
      .filter({ hasText: "Coach mode is advisory only." })
      .first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open commentator" }).click();
  await expect(page.getByText("Commentator thread ready")).toBeVisible();
  await expect(page.getByText("Commentator conversation")).toBeVisible();
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
