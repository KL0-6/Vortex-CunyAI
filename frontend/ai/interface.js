import { GROQ_API_URL, GROQ_MODEL } from "../config.js";

export async function callAI({ apiKey, messages, maxTokens = 1024 }) {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages
    })
  });

  let data = null;
  let text = "";

  try {
    text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      text ||
      `API error: ${response.status}`;
    throw new Error(message);
  }

  return data?.choices?.[0]?.message?.content || "";
}