import "dotenv/config";
import crypto from "crypto";
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

// POST /chat - full proxy: get token + call arena API from same browser
app.post("/chat", express.json(), async (req, res) => {
  if (!browserReady || !page) {
    return res.status(503).json({ error: "Browser not ready yet" });
  }

  const { conversationId, modelAId, content } = req.body;

  if (!conversationId || !modelAId || !content) {
    return res.status(400).json({ error: "conversationId, modelAId, content required" });
  }

  const userMessageId = crypto.randomUUID();
  const modelAMessageId = crypto.randomUUID();

  // SSE streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    // Get token + make API call inside the SAME browser (same cookies, same IP)
    const fullResponse = await page.evaluate(
      async ({ conversationId, modelAId, content, userMessageId, modelAMessageId, siteKey }) => {
        const token = await grecaptcha.enterprise.execute(siteKey, { action: "chat_submit" });

        const res = await fetch(
          `/nextjs-api/stream/post-to-evaluation/${conversationId}`,
          {
            method: "POST",
            headers: { "content-type": "text/plain;charset=UTF-8" },
            body: JSON.stringify({
              id: conversationId,
              modelAId,
              userMessageId,
              modelAMessageId,
              userMessage: { content, experimental_attachments: [], metadata: {} },
              modality: "chat",
              recaptchaV3Token: token
            })
          }
        );

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value);
        }
        return full;
      },
      { conversationId, modelAId, content, userMessageId, modelAMessageId, siteKey: SITE_KEY }
    );

    // Parse and stream chunks to caller
    for (const line of fullResponse.split("\n")) {
      if (line.startsWith('a0:')) {
        try {
          const token = JSON.parse(line.slice(3));
          res.write(`data: ${JSON.stringify(token)}\n\n`);
        } catch {}
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Chat error:", err.message);
    res.write(`data: ${JSON.stringify("Error: " + err.message)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Captcha service running on port ${PORT}`);
  initBrowser().catch((err) => {
    console.error("Failed to init browser:", err.message);
  });
});
