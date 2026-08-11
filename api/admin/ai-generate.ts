import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured on the server");
      return res.status(500).json({ error: "API Key not configured" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Using the user-requested latest model
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      tools: [{ googleSearch: {} }],
    });

    const prompt = `
You are an expert course curator for a financial and technical education platform.
Your task is to convert raw, unstructured information about a course into a strictly structured JSON format.

Input Text to analyze:
"""
${text}
"""

Instructions:
1. Search the web using your tools to find actual information, sales pages, or reviews about this specific course if it's a real course.
2. If it's a real course, base the description, topics, and requirements on public info.
3. If it's not found or vague, infer what a course with this title typically covers.
4. Research comparable market pricing to suggest a realistic \`price\` and \`original_price\` (in INR, numbers only, no currency symbols). Price should be the discounted selling price, original_price should be the MRP.
5. Classify the course into exactly 1 or 2 categories and subcategories from this exact list (DO NOT INVENT NEW ONES):
   - Trading (Intraday Trading, Swing Trading, Positional Trading, Price Action, Algo Trading, Scalping, F&O Trading)
   - Options (Options Basics, Options Strategies, Option Chain Analysis, Greeks, Hedging Strategies, Iron Condor, Bull Call Spread)
   - Investing (Stock Market Basics, Fundamental Analysis, IPO & NFO, Portfolio Management, Sector Analysis, Value Investing, Dividend Investing)
   - Technical Analysis (Candlestick Patterns, Chart Patterns, Support & Resistance, Moving Averages, RSI & MACD, Elliott Wave, Fibonacci)
   - Price Action/SMC (Smart Money Concepts, Order Blocks, Fair Value Gaps, ICT Concepts, Liquidity Zones, Break of Structure)
   - Indicators & Tools (TradingView, Screeners, Scanners, Amibroker, Python for Trading, Excel for Trading)
   - Crypto & Forex (Crypto Basics, Bitcoin & Altcoins, DeFi, NFT, Forex Basics, Currency Pairs, MT4/MT5 Platform)
   - Algo & AI Skills (Python Basics, Algo Trading, Backtesting, AI in Trading, Quantitative Trading)
6. Format tags as a comma-separated string (e.g., "trading, options, beginners").
7. Format what_you_learn and requirements as bullet points separated by newlines. Do not use markdown asterisks (* or -). Just plain text per line.

Output exactly this JSON structure (and nothing else, do not use markdown code blocks):
{
  "title": "String",
  "short_description": "String (1-2 sentences)",
  "description": "String (detailed paragraph)",
  "price": "Number or empty string",
  "original_price": "Number or empty string",
  "category": ["String from allowed categories"],
  "subcategory": ["String from allowed subcategories matching the chosen category"],
  "instructor_name": "String",
  "instructor_bio": "String",
  "level": "Beginner, Intermediate, or Advanced",
  "language": "Hindi or English",
  "duration_hours": "Number",
  "total_lectures": "Number",
  "tags": "String (comma separated)",
  "what_you_learn": "String (newline separated)",
  "requirements": "String (newline separated)"
}
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    // In case the model returns markdown code block for JSON despite instructions
    const cleanedText = responseText.replace(/```json\n?|\n?```/g, "").trim();
    
    let jsonOutput;
    try {
      jsonOutput = JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse Gemini output:", responseText);
      return res.status(500).json({ error: "Failed to parse AI response into JSON" });
    }

    return res.status(200).json(jsonOutput);

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
