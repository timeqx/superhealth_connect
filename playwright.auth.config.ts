import { defineConfig } from "@playwright/test";
const url = process.env.E2E_SUPABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Authenticated E2E requires E2E_SUPABASE_URL pointing to an isolated local Supabase instance.");
for (const key of ["E2E_SUPABASE_KEY", "E2E_PATIENT_EMAIL", "E2E_PATIENT_PASSWORD", "E2E_STAFF_EMAIL", "E2E_STAFF_PASSWORD"]) {
  if (!process.env[key]) throw new Error(`Missing ${key}; provision synthetic local accounts first.`);
}
export default defineConfig({
  testDir: "./tests/authenticated", workers: 1, timeout: 90000,
  expect: { timeout: 20000 },
  use: { baseURL: "http://localhost:3101", trace: "off", screenshot: "off", video: "off", launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {} },
  webServer: { command: "npm run dev -- --port 3101", url: "http://localhost:3101", reuseExistingServer: false, timeout: 120000,
    env: { E2E_TEST: "1", NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_KEY!, SUPABASE_SECRET_KEY: "", STAFF_DATABASE_URL: "", APP_URL: "http://localhost:3101" } },
});
