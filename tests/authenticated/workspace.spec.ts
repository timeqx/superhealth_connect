import { test, expect, type Page } from "@playwright/test";
async function signIn(page: Page, role: "PATIENT" | "STAFF") {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env[`E2E_${role}_EMAIL`]!);
  await page.getByLabel("Password", { exact: true }).fill(process.env[`E2E_${role}_PASSWORD`]!);
  await page.locator("main").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(role === "STAFF" ? /\/admin$/ : /\/patient$/);
  await expect(page.locator(".site-header")).toHaveCount(1);
  await expect(page.locator(".site-header").getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
}
test("patient authorization, inquiry response, notification and staff workspace", async ({ browser }) => {
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
    await patient.getByLabel("Subject", { exact: true }).fill(subject);
    await patient.getByLabel("Message", { exact: true }).fill("Synthetic workflow verification only.");
    await patient.getByRole("button", { name: "Send inquiry", exact: true }).click();
    await expect(patient.getByText(subject, { exact: true })).toBeVisible();
    await signIn(staff, "STAFF");
    for (const path of ["/admin/schedules", "/admin/reports", "/admin/queue", "/admin/history", "/admin/audit", "/admin/book"]) {
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
    await staff.getByRole("button", { name: `View conversation: ${subject}`, exact: true }).click();
    const thread = staff.getByRole("dialog", { name: subject, exact: true });
    await expect(thread.locator('[data-sender="patient"]')).toContainText("Patient");
    await thread.getByLabel("Staff response").fill("Synthetic private draft");
    await thread.getByRole("button", { name: "Save private draft" }).click();
    await expect(thread.getByText("Private draft", { exact: false })).toBeVisible();
    await patient.reload();
    await expect(patient.getByText("Synthetic private draft", { exact: false })).toHaveCount(0);
    // Edit and publish the saved draft itself rather than creating another reply.
    const savedDraft = thread.locator(".conversation-message").filter({ hasText: "Private draft" });
    await savedDraft.getByLabel("Staff response").fill(`Synthetic reply to ${subject}`);
    await savedDraft.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(thread.getByText(`Synthetic reply to ${subject}`, { exact: true })).toBeVisible();
    await patient.reload();
    await patient.getByRole("button", { name: `View conversation: ${subject}`, exact: true }).click();
    await expect(patient.getByRole("dialog").locator('[data-sender="staff"]')).toContainText(`Synthetic reply to ${subject}`);
    await patient.goto("/patient/notifications");
    const unread = patient.getByRole("button", { name: "Mark as read", exact: true });
    const before = await unread.count();
    expect(before).toBeGreaterThan(0);
    await unread.first().click();
    await expect(unread).toHaveCount(before - 1);
  } finally { await patientContext.close(); await staffContext.close(); }
});
