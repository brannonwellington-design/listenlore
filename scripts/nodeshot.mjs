import { chromium } from "playwright-core";
const dir = "/tmp/claude-0/-home-user-listenlore/291a6c63-79a0-5a85-ae0b-a83cf1bb6ff0/scratchpad";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:3100/?view=constellation", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${dir}/nodes_people.png` });
await browser.close();
console.log("done");
