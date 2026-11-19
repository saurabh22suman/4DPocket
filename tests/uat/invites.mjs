import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "../../frontend/node_modules/playwright/index.mjs";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4040";
const id = randomUUID().slice(0, 8);
const owner = { email: `owner-${id}@example.com`, username: `owner_${id}`, password: `Test!${randomUUID()}` };
const guest = { email: `guest-${id}@example.com`, username: `guest_${id}`, password: `Test!${randomUUID()}` };

// Run against a fresh smoke-test container with public registration enabled
// so the first account can be bootstrapped.
const response = await fetch(`${base}/api/v1/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(owner),
});
assert.equal(response.status, 201, "Bootstrap disposable administrator");
assert.equal((await response.json()).role, "admin");

const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM_PATH });
try {
  const adminContext = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const admin = await adminContext.newPage();
  await admin.goto(`${base}/admin`);
  await admin.getByLabel("Email or Username").fill(owner.username);
  await admin.getByLabel("Password", { exact: true }).fill(owner.password);
  await admin.getByRole("button", { name: "Sign in", exact: true }).click();
  await admin.getByRole("heading", { name: "Admin Panel" }).waitFor();
  assert.equal(new URL(admin.url()).pathname, "/admin", "Return to the requested page after login");
  await admin.getByRole("button", { name: "Create invite" }).click();
  const input = admin.getByLabel("Invitation link");
  await input.waitFor();
  const link = await input.inputValue();
  assert.equal(new URL(link).origin, base);
  await admin.getByRole("button", { name: "Copy invite link" }).click();
  await admin.getByText("Invite link copied.").waitFor();
  assert.equal(await admin.evaluate(() => navigator.clipboard.readText()), link);

  const guestContext = await browser.newContext();
  const page = await guestContext.newPage();
  await page.goto(link);
  await page.getByLabel("Username", { exact: true }).fill(guest.username);
  await page.getByLabel("Email", { exact: true }).fill(guest.email);
  await page.getByLabel("Password", { exact: true }).fill(guest.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Recent Items" }).waitFor();
  assert.equal(new URL(page.url()).hash, "", "Clear the invite from the active URL");
  const identity = await guestContext.request.get(`${base}/api/v1/auth/me`);
  assert.equal((await identity.json()).role, "user");
  await page.goto(`${base}/admin`);
  await page.getByRole("heading", { name: "Access Denied" }).waitFor();
  console.log("Production browser smoke passed: admin login, invitation clipboard, and guest signup");
} finally {
  await browser.close();
}
