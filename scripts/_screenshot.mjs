import { chromium } from "playwright";

const path = process.argv[2] || "/";
const outFile = process.argv[3] || "/tmp/screenshot.png";
const fullPage = process.argv[4] === "full";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000" + path, { waitUntil: "load" });
await page.waitForTimeout(400);
await page.screenshot({ path: outFile, fullPage });
await browser.close();
console.log("saved", outFile);
