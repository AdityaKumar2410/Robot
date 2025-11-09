// ===================== ORIGINAL IMPORTS =====================
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import https from "https";
import { load } from "cheerio";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.OPENAI_API_KEY;

// ✅ NEW — ESP32 IP + Deepgram API Key
const ESP32_IP = process.env.ESP32_IP;       // Add this in .env
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;  // Add this in .env

// ✅ SPEED BOOST: Keep-Alive Agent
const agent = new https.Agent({
  keepAlive: true
});

// ✅ Your same scraping list (unchanged)
const SCHOOL_PAGES = [
  "https://sjcsvns.org/",
  "https://sjcsvns.org/about.php",
  "https://sjcsvns.org/faculty.php?fac=Senior%20Wing",
];

// ✅ SAME SCRAPING LOGIC — UNCHANGED
async function scrapePage(url) {
  try {
    console.log(`📄 Scraping: ${url}`);

    const response = await fetch(url, { agent });
    const html = await response.text();
    const $ = load(html);

    let text = "";
    $("body *").each((i, el) => {
      const content = $(el).text().trim();
      if (
        content &&
        !content.includes("©") &&
        !content.includes("Powered by") &&
        content.length > 2
      ) {
        text += content + " ";
      }
    });

    return `\n--- Page: ${url} ---\n${text}\n`;
  } catch (err) {
    console.error(`❌ Failed to scrape ${url}:`, err.message);
    return "";
  }
}

// ✅ ESP32 endpoint (your code was incomplete – keeping it intact)
app.get("/esp32", async (req, res) => {
  const message = req.query.q;
  if (!message) return res.json({ reply: "No question received" });

  console.log("ESP32 asked:", message);
  res.json({ reply: "OK" });
});

// ✅ PARALLEL SCRAPING (unchanged)
async function scrapeAllPagesParallel() {
  console.log("⚡ Fetching all pages in parallel...");
  const promises = SCHOOL_PAGES.map((url) => scrapePage(url));
  const results = await Promise.all(promises);
  return results.join("\n");
}

// ===================== CHATBOT ROUTE (UNCHANGED LOGIC) =====================
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  console.log("🔎 Starting fast scrape...");

  const allText = await scrapeAllPagesParallel();
  const compactText = allText.replace(/\s+/g, " ").trim();
  const institutionData = `
  St Joseph Convent School, Varanasi — founded in 1950 by Our Lady of Providence.
  The institution serves students from all backgrounds in both English and Hindi medium.
  Current Principal: Sister Arul | Manager: Sister Vimala.
  other information:
  ${compactText}
  `;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 1000, 
        messages: [
          {
            role: "system",
            content: "You are an intelligent chatbot for St Joseph Convent School, Varanasi. Use the provided scraped data to answer concisely and meaningfully and do not use*** and double quotes in your answers .",
          },
          { role: "system", content: institutionData },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();
    console.log("🔍 OpenAI API Response:", JSON.stringify(data, null, 2));

    if (!data || !data.choices || !data.choices[0]) {
      return res.status(500).json({
        error: "Invalid response from OpenAI API",
        details: data,
      });
    }

    const reply = data.choices[0].message.content;

    // ✅ NEW — Notify ESP32 to speak
    if (ESP32_IP) {
      fetch(`http://${ESP32_IP}/say?text=${encodeURIComponent(reply)}`)
        .catch(err => console.log("ESP32 notify failed:", err.message));
    }

    res.json({ reply });

  } catch (err) {
    console.error("❌ Error connecting to OpenAI API:", err.message);
    res.status(500).json({ error: "Error connecting to OpenAI API" });
  }
});

// ===================== ✅ NEW: DEEPGRAM TTS ENDPOINT =====================
app.get("/tts", async (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).send("No text");

  try {
    const dgResponse = await fetch(
      "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${DEEPGRAM_KEY}`,
          "Content-Type": "application/json",
          "Accept": "audio/wav"
        },
        body: JSON.stringify({ text })
      }
    );

    if (!dgResponse.ok) {
      const errData = await dgResponse.text();
      console.log("❌ Deepgram Error:", dgResponse.status, errData);
      return res.status(500).send("Deepgram TTS failed");
    }

    res.setHeader("Content-Type", "audio/wav");
    dgResponse.body.pipe(res);

  } catch (err) {
    console.error("❌ Deepgram TTS Error:", err.message);
    res.status(500).send("Deepgram TTS server error");
  }
});

// ===================== ✅ NEW: SERVER → ESP32 /say ROUTE =====================
app.post("/say", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text" });

  if (!ESP32_IP) {
    return res.status(400).json({ error: "ESP32_IP not set in .env" });
  }

  try {
    await fetch(`http://${ESP32_IP}/say?text=${encodeURIComponent(text)}`);
    res.json({ status: "sent-to-esp32" });
  } catch (err) {
    res.status(500).json({ error: "Failed to reach ESP32", details: err.message });
  }
});

// ===================== SERVER START =====================
app.listen(5000, () =>
  console.log("✅ Server running at http://localhost:5000")
);
