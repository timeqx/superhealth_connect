import { test, expect } from "@playwright/test";
test("responsive menu is keyboard dismissible and restores focus", async ({
  page,
}) => {
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await menu.click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Services", exact: true })
      .click();
    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
});


test("demo routes and developer links are removed", async ({ page, request }) => {
  for (const screen of ["patient", "booking", "queue", "admin"]) {
    expect((await request.get(`/preview/${screen}`)).status()).toBe(404);
  }
  for (const path of ["/", "/services", "/sign-in", "/register", "/privacy", "/admin"]) {
    await page.goto(path);
    await expect(page.locator('a[href^="/preview/"]')).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/synthetic|development prototype|Supabase|DEMO-0042/i);
  }
});
