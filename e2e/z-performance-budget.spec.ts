import { type Page, expect, test } from "@playwright/test";

const BROWSER_BUDGETS_MS = {
  cinematicPreviewReady: 4_000,
  cinematicSwap: 2_500,
  homepageHeroReady: 3_000,
  practiceMatchMount: 12_000,
} as const;

function uniqueTag(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

async function signUp(page: Page, prefix: string) {
  const tag = uniqueTag(prefix);

  await page.goto("/");
  await page.getByLabel("Email").fill(`${tag}@example.com`);
  await page
    .getByLabel("Username")
    .fill(tag.replace(/[^a-z0-9_]/gi, "").slice(0, 24));
  await page.getByRole("button", { name: "Create wallet seat" }).click();
  await expect(page.getByText("Signup complete")).toBeVisible();
}

async function createStarterDeck(page: Page) {
  await page.getByRole("button", { name: "Create starter deck" }).click();
  await expect(page.getByText("Starter deck created")).toBeVisible();
}

test("keeps the homepage and cinematic preview within local browser budgets", async ({
  page,
}) => {
  const heroStartedAt = Date.now();
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Summon the card. Break the board. Take the table.",
    }),
  ).toBeVisible();
  expect(Date.now() - heroStartedAt).toBeLessThanOrEqual(
    BROWSER_BUDGETS_MS.homepageHeroReady,
  );

  const previewStartedAt = Date.now();
  await page.goto("/?previewCinematics=1");
  const heroPreview = page.locator(".hero-stage-surface").first();
  await expect(
    heroPreview.getByRole("heading", { name: "Trigger live card entrances" }),
  ).toBeVisible();
  expect(Date.now() - previewStartedAt).toBeLessThanOrEqual(
    BROWSER_BUDGETS_MS.cinematicPreviewReady,
  );

  const swapStartedAt = Date.now();
  await heroPreview.getByRole("button", { name: "Ember Summoner" }).click();
  await expect(heroPreview.locator(".board-summon-copy h4")).toHaveText(
    "Ember Summoner",
  );
  expect(Date.now() - swapStartedAt).toBeLessThanOrEqual(
    BROWSER_BUDGETS_MS.cinematicSwap,
  );
});

test("keeps practice match mount within the local browser budget", async ({
  page,
}) => {
  await signUp(page, "perf");
  await createStarterDeck(page);
  await expect(page.getByRole("heading", { name: "Game Lobby" })).toBeVisible();

  const mountStartedAt = Date.now();
  await page.getByRole("button", { name: "Create practice match" }).click();
  await expect(page.getByText("Practice match created")).toBeVisible();
  await expect(
    page.getByText("Live Match Shell", { exact: true }),
  ).toBeVisible();
  expect(Date.now() - mountStartedAt).toBeLessThanOrEqual(
    BROWSER_BUDGETS_MS.practiceMatchMount,
  );
});
