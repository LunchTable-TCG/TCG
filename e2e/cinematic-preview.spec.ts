import { expect, test } from "@playwright/test";

test("loads bundled cinematic GLBs in the preview surface", async ({
  page,
}) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleMessages.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  const archiveModelResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes("/cinematics/cards/archive-apprentice/summon.glb") &&
      response.status() === 200,
  );

  await page.goto("/?previewCinematics=1");
  await archiveModelResponse;

  const heroPreview = page.locator(".hero-stage-surface").first();

  await expect(
    heroPreview.getByRole("heading", { name: "Trigger live card entrances" }),
  ).toBeVisible();
  await expect(heroPreview.locator(".board-summon-copy h4")).toHaveText(
    "Archive Apprentice",
  );

  const emberModelResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/cinematics/cards/ember-summoner/summon.glb") &&
      response.status() === 200,
  );

  await heroPreview.getByRole("button", { name: "Ember Summoner" }).click();
  await emberModelResponse;
  await expect(heroPreview.locator(".board-summon-copy h4")).toHaveText(
    "Ember Summoner",
  );

  await heroPreview.getByRole("button", { name: "Ability burst" }).click();
  await expect(
    heroPreview.locator(".board-summon-copy .match-zone-label"),
  ).toContainText("Ability ignition");

  expect(pageErrors).toEqual([]);
  expect(
    consoleMessages.filter((message) =>
      message.includes("Failed to load remote cinematic model"),
    ),
  ).toEqual([]);
});
