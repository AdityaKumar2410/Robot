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

// ✅ SPEED BOOST: Enable Keep-Alive for fetch
const agent = new https.Agent({
  keepAlive: true
});

// ✅ Your same list of pages
const SCHOOL_PAGES = [
  "https://sjcsvns.org/",
  "https://sjcsvns.org/about.php",
  "https://sjcsvns.org/faculty.php?fac=Senior%20Wing",
];

// ✅ SAME SCRAPING LOGIC — NOT CHANGED
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


// ✅ ESP32 endpoint (GET)
app.get("/esp32", async (req, res) => {
  const message = req.query.q;
  if (!message) return res.json({ reply: "No question received" });

  console.log("ESP32 asked:", message);});
// ✅ ✅ ✅ MAJOR SPEED OPTIMIZATION — PARALLEL SCRAPING
async function scrapeAllPagesParallel() {
  console.log("⚡ Fetching all pages in parallel...");
  const promises = SCHOOL_PAGES.map((url) => scrapePage(url));
  const results = await Promise.all(promises);
  return results.join("\n");
}

// ✅ Chat route
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  console.log("🔎 Starting fast scrape...");

  // ✅ SCRAPE ALL PAGES MUCH FASTER
  const allText = await scrapeAllPagesParallel();

  const institutionData = `
  St Joseph Convent School, Varanasi — founded in 1950 by Our Lady of Providence.
  The institution serves students from all backgrounds in both English and Hindi medium.
  Current Principal: Sister Arul | Manager: Sister Vimala.

  Below is detailed verified information extracted from the official school website:
  ${allText}
  `;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an intelligent chatbot for St Joseph Convent School, Varanasi. Use the provided scraped data to answer precisely.Dont use *** or double quotes in your answers.",
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

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error("❌ Error connecting to OpenAI API:", err.message);
    res.status(500).json({ error: "Error connecting to OpenAI API" });
  }
});

app.listen(5000, () =>
  console.log("✅ Server running at http://localhost:5000")
);
