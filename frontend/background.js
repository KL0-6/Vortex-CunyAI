// background.js - Service Worker
// Uses Groq (free) instead of Anthropic for prototyping.
// Get a free key at: https://console.groq.com

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CALL_CLAUDE") {
    handleAICall(request.payload).then(sendResponse).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (request.type === "GET_API_KEY") {
    chrome.storage.sync.get(["groqApiKey"], (result) => {
      sendResponse({ apiKey: result.groqApiKey || null });
    });
    return true;
  }
});

async function handleAICall({ messages, systemPrompt, apiKey }) {
  if (!apiKey) {
    throw new Error("No API key set. Click the extension icon to add your Groq API key.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",  // Best free model on Groq
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content || "" };
}