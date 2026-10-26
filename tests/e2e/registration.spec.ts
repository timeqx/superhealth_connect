import { expect, test } from "@playwright/test";

test("patient signup follows name, barangay and verified contact before upload or password", async ({ page }) => {
  await page.goto("/register?step=password");
  await expect(page.getByRole("heading", { name: "Step 1 of 5 · Name" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.getByLabel("Last name", { exact: true }).fill("Patient");
  await page.getByLabel("First name", { exact: true }).fill("Synthetic");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("combobox", { name: "Barangay", exact: true }).selectOption("Others");
  await page.getByRole("textbox", { name: "Your barangay", exact: true }).fill("Sample barangay");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Synthetic");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your barangay", exact: true })).toHaveValue("Sample barangay");
  await page.getByRole("combobox", { name: "Barangay", exact: true }).selectOption("Batasan Hills");
  await expect(page.getByRole("textbox", { name: "Your barangay", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Mobile number").fill("09171234567");
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send verification email" }).click();
  await expect(page.getByRole("status")).toContainText("Online accounts are temporarily unavailable");
  await expect(page.getByRole("heading", { name: "Step 3 of 5 · Contact" })).toBeVisible();
  await expect(page.getByLabel("Verification document")).toHaveCount(0);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
