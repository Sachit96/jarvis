import { chromium } from "playwright";
import fs from "node:fs";

const SITE_PASSWORD = fs.readFileSync(".env.local", "utf8").match(/^SITE_PASSWORD=(.*)$/m)?.[1]?.trim();
const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] ?? 1440);
const fullPage = process.argv[5] === "full";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height: 900 },
  httpCredentials: { username: "x", password: SITE_PASSWORD },
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle" });
if (process.argv[6]) {
  const el = page.locator(`text=${process.argv[6]}`).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
}
await page.screenshot({ path: out, fullPage });
await context.close();
await browser.close();
