import { chromium } from "playwright-core";
const dir = "/tmp/claude-0/-home-user-listenlore/291a6c63-79a0-5a85-ae0b-a83cf1bb6ff0/scratchpad";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:3100/?view=register", { waitUntil: "networkidle", timeout: 60000 });
await page.screenshot({ path: `${dir}/v1_register.png`, fullPage: true });
await page.goto("http://localhost:3100/?view=record", { waitUntil: "networkidle", timeout: 60000 });
const btn = page.locator("button", { hasText: "moments" }).first();
if (await btn.count()) { await btn.click(); await page.waitForTimeout(300); }
await page.screenshot({ path: `${dir}/v2_record.png`, fullPage: true });
await page.goto("http://localhost:3100/?view=album", { waitUntil: "networkidle", timeout: 60000 });
await page.screenshot({ path: `${dir}/v3_album.png`, fullPage: true });
await page.goto("http://localhost:3100/?view=constellation", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${dir}/v4_nodes.png`, fullPage: false });
await browser.close();
console.log("done");
