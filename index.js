import "dotenv/config";
import express from "express";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import cookieHandler from "./lib/cookieHandler.js";

chromium.use(StealthPlugin());

const SITE_KEY = "6Led_uYrAAAAAKjxDIF58fgFtX3t8loNAK85bW9I";
const ARENA_URL = "https://arena.ai";

let page = null;
let browserReady = false;

async function initBrowser() {
  console.log("Launching browser...");

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const fixedCookies = cookieHandler();
  const context = await browser.newContext();
  await context.addCookies(fixedCookies);

  page = await context.newPage();

  await page.goto(ARENA_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  await page.waitForFunction(
    () => typeof window.grecaptcha?.enterprise?.execute === "function",
    { timeout: 60000 }
  );

  browserReady = true;
  console.log("Browser ready - captcha loaded");
}

const app = express();

app.get("/", (req, res) => {
  res.json({ status: "ok", browserReady });
});

app.get("/token", async (req, res) => {
  if (!browserReady || !page) {
    return res.status(503).json({ error: "Browser not ready yet" });
  }

  try {
    const token = await page.evaluate(async (siteKey) => {
      return await grecaptcha.enterprise.execute(siteKey, {
        action: "chat_submit"
      });
    }, SITE_KEY);

    res.json({ token });
  } catch (err) {
    console.error("Token error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Captcha service running on port ${PORT}`);
  initBrowser().catch((err) => {
    console.error("Failed to init browser:", err.message);
  });
});
