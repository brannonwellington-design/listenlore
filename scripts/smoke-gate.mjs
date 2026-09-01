// Smoke test for the passcode gate. Usage:
//   SITE_PASSCODE=<code> BASE_URL=http://localhost:3100 node scripts/smoke-gate.mjs
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const PASSCODE = process.env.SITE_PASSCODE;
if (!PASSCODE) throw new Error("Set SITE_PASSCODE");

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE, { waitUntil: "networkidle" });
if (!page.url().includes("/gate")) throw new Error("expected redirect to /gate");

await page.fill('input[name="passcode"]', "definitely-wrong");
await page.click('button:has-text("Enter")');
await page.waitForURL("**/gate?error=1");
console.log("wrong passcode rejected ✓");

await page.fill('input[name="passcode"]', PASSCODE);
await page.click('button:has-text("Enter")');
await page.waitForURL(BASE + "/");
await page.waitForSelector('text=The Story So Far');
console.log("correct passcode unlocks timeline ✓");

// Cookie persists across a fresh navigation
await page.goto(BASE, { waitUntil: "networkidle" });
if (page.url().includes("/gate")) throw new Error("gate cookie did not persist");
console.log("gate cookie persists ✓");

await browser.close();
console.log("gate smoke: PASS");
