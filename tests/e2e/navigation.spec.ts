import { expect, test } from "@playwright/test";

test("auth navigation preserves the shared panel and document", async ({ page }) => {
  await page.goto("/sign-in");
  const intro = await page.locator(".auth-intro").elementHandle();
  const header = await page.locator(".site-header").elementHandle();
  const panelHeight = await page.locator(".auth-content").evaluate(node => node.getBoundingClientRect().height);
  let documents = 0;
  page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });

  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your account", exact: true })).toBeVisible();
  expect(await page.locator(".auth-content").evaluate(node => node.getBoundingClientRect().height)).toBe(panelHeight);
  expect(await page.locator(".auth-intro").evaluate((node, saved) => node === saved, intro)).toBe(true);
  await page.getByRole("link", { name: "Back to sign in", exact: true }).click();
  await page.getByRole("link", { name: "Forgot password?", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reset your password", exact: true })).toBeVisible();
  expect(await page.locator(".auth-content").evaluate(node => node.getBoundingClientRect().height)).toBe(panelHeight);
  expect(await page.locator(".auth-intro").evaluate((node, saved) => node === saved, intro)).toBe(true);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Care starts here.", exact: true })).toBeVisible();
  expect(await page.locator(".site-header").evaluate((node, saved) => node === saved, header)).toBe(true);

  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy notice" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  expect(await page.locator(".site-header").evaluate((node, saved) => node === saved, header)).toBe(true);
  expect(documents).toBe(0);
});

test("reduced motion keeps navigation transitions still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Step 1 of 5 · Name" })).toBeVisible();
  expect(await page.locator(".auth-content").evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
