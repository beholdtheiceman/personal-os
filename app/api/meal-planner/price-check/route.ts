// POST /api/meal-planner/price-check
// Uses Claude + Tavily to estimate current grocery prices for a shopping list
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, TAVILY_API_KEY } from "@/lib/env";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export interface PriceItem {
  ingredient: string;
  price: number;
  unit: string;
  note?: string;
}

export interface StorePriceResult {
  items: PriceItem[];
  total: number;
}

export interface PriceCheckResult {
  [storeName: string]: StorePriceResult;
}

export async function POST(req: NextRequest) {
  // Verify Firebase ID token
  const authHeader = req.headers.get("Authorization") ?? "";
  const idToken = authHeader.replace("Bearer ", "").trim();
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekStart, stores } = (await req.json()) as {
    weekStart: string;
    stores: string[];
  };

  if (!weekStart || !stores?.length) {
    return NextResponse.json({ error: "weekStart and stores are required" }, { status: 400 });
  }

  // Fetch the shopping list
  const db = getAdminDb();
  const listSnap = await db.doc(`users/${uid}/shopping_lists/${weekStart}`).get();
  if (!listSnap.exists) {
    return NextResponse.json({ error: "No shopping list found for that week" }, { status: 404 });
  }

  const allItems = (listSnap.data()?.items ?? []) as Array<{
    ingredient: string;
    amount: string;
    checked: boolean;
  }>;
  const items = allItems.filter((i) => !i.checked);

  if (items.length === 0) {
    return NextResponse.json({ error: "All items are already checked off" }, { status: 400 });
  }

  const ingredientList = items
    .map((i) => `- ${i.ingredient}${i.amount ? ` (${i.amount})` : ""}`)
    .join("\n");

  const storeNames = stores.join(" and ");

  const systemPrompt = `You are a grocery price research assistant. You estimate current retail prices for grocery items at specific stores.

Use web_search to look up current prices. Be efficient — search by category or store + multiple items at once rather than one item at a time. 2-4 searches should be enough for most lists.

When you have enough data, respond with ONLY a valid JSON object — no markdown fences, no explanation, just raw JSON:

{
  "StoreName": {
    "items": [
      {"ingredient": "exact ingredient name from list", "price": 0.00, "unit": "e.g. per lb, per bottle, each", "note": "optional size/brand note"}
    ],
    "total": 0.00
  }
}

Rules:
- Use the EXACT ingredient name as given in the list
- Price = what a shopper actually pays at that store today
- total = sum of all item prices (rounded to 2 decimal places)
- If comparing two stores, include both as separate keys
- Be realistic and current — use your search results for live prices, your knowledge for anything not found`;

  const userMessage = `Estimate prices for my grocery list at ${storeNames}.

${ingredientList}

Search for current prices and return the JSON.`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  let finalText = "";
  let iterations = 0;
  const MAX_ITER = 8;

  try {
    while (iterations < MAX_ITER) {
      iterations++;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        tools: [
          {
            name: "web_search",
            description: "Search the web for current grocery store prices",
            input_schema: {
              type: "object" as const,
              properties: {
                query: {
                  type: "string",
                  description: "Search query, e.g. 'chicken breast price Walmart 2025'",
                },
              },
              required: ["query"],
            },
          },
        ],
        messages,
      });

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find((b) => b.type === "text");
        if (textBlock?.type === "text") finalText = textBlock.text;
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolUses = response.content.filter((b) => b.type === "tool_use");
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUses) {
          if (block.type !== "tool_use") continue;

          let content = "No results";

          if (block.name === "web_search") {
            const query = (block.input as { query: string }).query;

            if (!TAVILY_API_KEY) {
              content = "Web search not configured.";
            } else {
              try {
                const res = await fetch("https://api.tavily.com/search", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    api_key: TAVILY_API_KEY,
                    query,
                    max_results: 4,
                    search_depth: "basic",
                    include_answer: true,
                  }),
                });
                const data = (await res.json()) as {
                  answer?: string;
                  results?: Array<{ url: string; content: string }>;
                };
                const snippets = (data.results ?? [])
                  .slice(0, 4)
                  .map((r) => `${r.url}\n${r.content?.slice(0, 400)}`)
                  .join("\n\n");
                content = data.answer
                  ? `Summary: ${data.answer}\n\n${snippets}`
                  : snippets || "No results found";
              } catch {
                content = "Search request failed";
              }
            }
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content,
          });
        }

        messages.push({ role: "user", content: toolResults });
      }
    }
  } catch (err) {
    console.error("Price check Claude error:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }

  // Extract JSON from Claude's response
  const jsonMatch = finalText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON in price check response:", finalText);
    return NextResponse.json({ error: "Could not parse price data from AI response" }, { status: 500 });
  }

  try {
    const prices = JSON.parse(jsonMatch[0]) as PriceCheckResult;
    return NextResponse.json({ prices, item_count: items.length });
  } catch {
    return NextResponse.json({ error: "Invalid JSON in AI response" }, { status: 500 });
  }
}
