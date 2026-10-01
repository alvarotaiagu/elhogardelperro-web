// node render.mjs <html> <png> [width] [height]
import { chromium } from "file:///C:/Users/alvar/Desktop/WEBS%20NEGOCIOS/alvarotaiagu.github.io/node_modules/playwright/index.mjs";
import { pathToFileURL } from "node:url";

const [, , html, png, w = "1200", h = "800"] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(html).href);
await page.waitForTimeout(150);
await page.screenshot({ path: png, fullPage: true });
await browser.close();
console.log("ok", png);
