import { callAI } from "./interface.js";
import { MAX_MESSAGES } from "../config.js";

export async function summarizeMessages(messages, existingSummary, apiKey) {
  const olderMessages = messages.slice(0, -MAX_MESSAGES);
  if (olderMessages.length === 0) return existingSummary || "";

  const prompt = `
Summarize this conversation for academic advising.

Keep:
- courses
- degree progress
- goals
- constraints

Be concise.

Existing summary:
${existingSummary || "None"}
`.trim();

  try {
    const summary = await callAI({
      apiKey,
      maxTokens: 300,
      messages: [
        { role: "system", content: prompt },
        ...olderMessages
      ]
    });
    return summary || existingSummary || "";
  } catch {
    return existingSummary || "";
  }
}