import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
async function signIn(page: Page, role: "PATIENT" | "STAFF" | "ADMIN") {
  await page.goto(role === "PATIENT" ? "/sign-in" : "/staff/sign-in");
  await page.getByLabel("Email address").fill(process.env[`E2E_${role}_EMAIL`]!);
  await page.getByLabel("Password", { exact: true }).fill(process.env[`E2E_${role}_PASSWORD`]!);
  await page.locator("main").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(role === "PATIENT" ? /\/patient$/ : /\/admin$/);
  await expect(page.locator(".site-header")).toHaveCount(1);
  await expect(page.locator(".site-header").getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
}

async function badgeCount(page: Page, href: string) {
  const link = page.locator('nav[aria-label="Main navigation"]')
    .locator(`a[href="${href}"]`);
  await expect(link).toBeVisible();
  const badge = link.locator(".navigation-badge");
  return Number((await badge.allTextContents()).join("")) || 0;
}
test("patient authorization, inquiry response, notification and full admin workspace", async ({ browser }) => {
  const patientContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const patient = await patientContext.newPage();
  const staff = await staffContext.newPage();
  const subject = `Synthetic E2E ${Date.now()}`;
  try {
    await signIn(patient, "PATIENT");
    await patient.goto("/admin/schedules");
    await expect(patient).toHaveURL(/access-denied/);
    const deniedExport = await patient.request.get("/admin/reports/export?from=2026-10-01&to=2026-10-21");
    expect(deniedExport.status()).toBe(403);
    await patient.goto("/patient/inquiries");
    const patientInquiriesBefore = await badgeCount(patient, "/patient/inquiries");
    await patient.getByLabel("Subject", { exact: true }).fill(subject);
    await patient.getByLabel("Message", { exact: true }).fill("Synthetic workflow verification only.");
    await patient.getByRole("button", { name: "Send inquiry", exact: true }).click();
    await expect(patient.getByText(subject, { exact: true })).toBeVisible();
    await signIn(staff, "ADMIN");
    await expect(staff.getByRole("navigation", { name: "Main navigation" }).locator(".navigation-label")).toHaveText(["Requests", "Queue", "History", "Inquiries", "Accounts", "Staff", "Schedules", "Reports"]);
    for (const path of ["/admin/reviews", "/admin/staff", "/admin/schedules", "/admin/reports", "/admin/queue", "/admin/history", "/admin/audit", "/admin/book"]) {
      await staff.goto(path);
      await expect(staff.locator("main h1")).toBeVisible();
      await expect(staff.getByText("Something went wrong", { exact: false })).toHaveCount(0);
    }
    const exported = await staff.request.get("/admin/reports/export?from=2026-10-01&to=2026-10-21");
    expect(exported.status()).toBe(200);
    expect(exported.headers()["cache-control"]).toContain("no-store");
    expect(await exported.text()).toContain("total_requests");
    expect((await staff.request.get("/admin/reports/export?from=2026-02-30&to=2026-03-01")).status()).toBe(400);
    await staff.goto("/admin/inquiries");
    const staffInquiriesBefore = await badgeCount(staff, "/admin/inquiries");
    expect(staffInquiriesBefore).toBeGreaterThan(0);
    await staff.getByRole("button", { name: `View conversation: ${subject}`, exact: true }).click();
    const thread = staff.getByRole("dialog", { name: subject, exact: true });
    await expect(thread.locator('[data-sender="patient"]')).toContainText("Patient");
    await expect.poll(() => badgeCount(staff, "/admin/inquiries")).toBe(staffInquiriesBefore - 1);
    await thread.getByLabel("Staff response").fill("Synthetic private draft");
    await thread.getByRole("button", { name: "Save private draft" }).click();
    await expect(thread.getByText("Private draft", { exact: false })).toBeVisible();
    await patient.reload();
    await expect(patient.getByText("Synthetic private draft", { exact: false })).toHaveCount(0);
    await expect.poll(() => badgeCount(patient, "/patient/inquiries")).toBe(patientInquiriesBefore);
    const savedDraft = thread.locator(".conversation-message").filter({ hasText: "Private draft" });
    await savedDraft.getByLabel("Staff response").fill(`Synthetic reply to ${subject}`);
    await savedDraft.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(thread.getByText(`Synthetic reply to ${subject}`, { exact: true })).toBeVisible();
    await patient.reload();
    await expect.poll(() => badgeCount(patient, "/patient/inquiries")).toBe(patientInquiriesBefore + 1);
    await patient.goto("/patient/notifications");
    const notificationsBefore = await badgeCount(patient, "/patient/notifications");
    expect(notificationsBefore).toBeGreaterThan(0);
    const unread = patient.getByRole("button", { name: "Mark as read", exact: true });
    const before = await unread.count();
    expect(before).toBeGreaterThan(0);
    await unread.first().click();
    await expect(unread).toHaveCount(before - 1);
    await expect.poll(() => badgeCount(patient, "/patient/notifications")).toBe(notificationsBefore - 1);
    await expect.poll(() => badgeCount(patient, "/patient/inquiries")).toBe(patientInquiriesBefore + 1);
    await patient.goto("/patient/inquiries");
    await patient.getByRole("button", { name: `View conversation: ${subject}`, exact: true }).click();
    await expect(patient.getByRole("dialog").locator('[data-sender="staff"]')).toContainText(`Synthetic reply to ${subject}`);
    await expect.poll(() => badgeCount(patient, "/patient/inquiries")).toBe(patientInquiriesBefore);
    if (patientInquiriesBefore === 0) {
      await expect(patient.locator('nav[aria-label="Main navigation"] a[href="/patient/inquiries"] .navigation-badge')).toHaveCount(0);
    }
  } finally { await patientContext.close(); await staffContext.close(); }
});

test("staff shares the portal but only has Requests, Queue, Inquiries and Reports", async ({ page }) => {
  await signIn(page, "STAFF");
  const links = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link");
  await expect(links.locator(".navigation-label")).toHaveText(["Requests", "Queue", "Inquiries", "Reports"]);

  for (const path of ["/admin", "/admin/queue", "/admin/inquiries", "/admin/reports"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("Something went wrong", { exact: false })).toHaveCount(0);
  }
  await expect(page.getByRole("link", { name: /Browse all audit activity/ })).toHaveCount(0);
  const exported = await page.request.get("/admin/reports/export?from=2026-10-01&to=2026-10-21");
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain("total_requests");

  for (const path of ["/admin/reviews", "/admin/staff", "/admin/schedules", "/admin/history", "/admin/audit", "/admin/book"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/access-denied$/);
  }
  const document = await page.request.get("/admin/reviews/document/70000000-0000-4000-8000-000000000001");
  expect(document.status()).toBe(403);
  await page.goto("/patient");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/sign-in$/);
});

test("admins create ready-to-use staff and admin accounts and change existing session access", async ({ page, browser }) => {
  test.skip(!process.env.E2E_SUPABASE_SECRET_KEY, "Provide the isolated local Auth admin key to test account creation.");
  const accountContext = await browser.newContext();
  const accountPage = await accountContext.newPage();
  const password = `Synthetic-${randomUUID()}`;
  const emails = { staff: `staff-${randomUUID()}@example.test`, admin: `admin-${randomUUID()}@example.test` };
  try {
    await signIn(page, "ADMIN");
    await page.goto("/admin/staff");
    for (const role of ["staff", "admin"] as const) {
      await page.getByLabel("First name", { exact: true }).fill("Synthetic");
      await page.getByLabel("Last name", { exact: true }).fill(role);
      await page.getByLabel("Email address", { exact: true }).fill(emails[role]);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Role", { exact: true }).selectOption(role);
      await page.getByRole("button", { name: "Create account", exact: true }).click();
      await expect(page.locator(".snackbar")).toContainText("account created");
      await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
      await expect(page.getByRole("form", { name: `Role for ${emails[role]}`, exact: true })).toBeVisible();

      await accountPage.goto("/staff/sign-in");
      await accountPage.getByLabel("Email address").fill(emails[role]);
      await accountPage.getByLabel("Password", { exact: true }).fill(password);
      await accountPage.locator("main").getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(accountPage).toHaveURL(/\/admin$/);
      const navigation = accountPage.getByRole("navigation", { name: "Main navigation" });
      await expect(navigation.getByRole("link", { name: "Staff", exact: true })).toHaveCount(role === "admin" ? 1 : 0);
      const row = page.getByRole("form", { name: `Role for ${emails[role]}`, exact: true });
      const nextRole = role === "staff" ? "admin" : "staff";
      await row.getByLabel("Account role").selectOption(nextRole);
      await row.getByRole("button", { name: "Save role", exact: true }).click();
      await expect(page.locator(".snackbar")).toContainText(`Role changed to ${nextRole === "admin" ? "Admin" : "Staff"}`);
      await accountPage.goto("/admin/staff");
      await expect(accountPage).toHaveURL(nextRole === "admin" ? /\/admin\/staff$/ : /\/access-denied$/);
      await accountPage.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(accountPage).toHaveURL(/\/staff\/sign-in$/);
    }
  } finally {
    await accountContext.close();
  }
});
