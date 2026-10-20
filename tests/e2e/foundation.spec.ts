import { test, expect } from "@playwright/test";
test("public navigation, previews, and no-configuration guard", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your next step/ }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore services", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Family Planning", exact: true }),
  ).toBeVisible();
  await page.goto("/preview/patient");
  await expect(page.getByText(/Synthetic design preview/)).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", {
      name: "Online accounts are not connected yet",
    }),
  ).toBeVisible();
});
test("account review routes cannot become demo access", async ({
  page,
  request,
}) => {
  await page.goto("/admin/reviews");
  await expect(
    page.getByRole("heading", {
      name: "Online accounts are not connected yet",
    }),
  ).toBeVisible();
  const response = await request.get(
    "/admin/reviews/document/70000000-0000-4000-8000-000000000001",
  );
  expect(response.status()).toBe(503);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers().location).toBeUndefined();
});
test("responsive screens do not overflow", async ({ page }) => {
  for (const path of [
    "/",
    "/services",
    "/sign-in",
    "/register",
    "/preview/patient",
    "/preview/admin",
    "/preview/queue",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (path === "/")
      await page.screenshot({
        path: test.info().outputPath("landing.png"),
        fullPage: true,
      });
  }
});
test("sign in reports missing configuration without inventing a session", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("synthetic@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "not connected",
  );
});
