import { test, expect } from "@playwright/test";
test("booking preserves the session through review and never confirms a sample request", async ({
  page,
}) => {
  await page.goto("/preview/booking");
  await page
    .getByRole("button", { name: "Choose service Immunizations", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Review request", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("radio", { name: /Full/ })).toBeDisabled();
  await page.getByRole("radio", { name: /9:00 AM/ }).check();
  await page
    .getByRole("button", { name: "Review request", exact: true })
    .click();
  await expect(
    page.getByText(/It is not a confirmed appointment or queue ticket/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change session" }).click();
  await expect(page.getByRole("radio", { name: /9:00 AM/ })).toBeChecked();
  await page.getByLabel("Visit date · Philippine time").fill("2026-11-05");
  await expect(
    page.getByRole("button", { name: "Review request", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: /9:00 AM/ }).check();
  await page
    .getByRole("button", { name: "Review request", exact: true })
    .click();
  await page.getByRole("button", { name: "Change session" }).click();
  await expect(page.getByLabel("Visit date · Philippine time")).toHaveValue(
    "2026-11-05",
  );
  await expect(page.getByRole("radio", { name: /9:00 AM/ })).toBeChecked();
  await page.screenshot({
    path: test.info().outputPath("booking.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Review request", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit sample request" }).click();
  await expect(
    page.getByRole("heading", { name: "Request submitted for review" }),
  ).toBeVisible();
  await expect(page.getByText(/Nothing was saved/)).toBeVisible();
});
test("request search and accessible detail panel", async ({ page }) => {
  await page.goto("/preview/admin");
  await page.getByLabel("Find a request").fill("0042");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const trigger = page.getByRole("button", { name: "Review DEMO-0042" });
  const bounds = await trigger.boundingBox();
  expect(bounds && bounds.x + bounds.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("review-panel.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByLabel("Find a request").fill("does-not-exist");
  await expect(
    page.getByRole("heading", { name: "No matching requests" }),
  ).toBeVisible();
});
test("queue preview makes stale and completed states explicit", async ({
  page,
}) => {
  await page.goto("/preview/queue");
  await page.getByLabel("Preview a queue state").selectOption("disconnected");
  await expect(
    page.getByText("Position unavailable", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Preview a queue state").selectOption("completed");
  await expect(
    page.getByRole("heading", { name: "You’re all done." }),
  ).toBeVisible();
});
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
