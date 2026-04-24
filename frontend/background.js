// background.js - Service Worker
// Groq AI with chat history + trimming + summary + DegreeWorks context injection

const MAX_MESSAGES = 12;
const SUMMARY_TRIGGER = 12;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CALL_CLAUDE") {
    handleAICall(request.payload)
      .then(sendResponse)
      .catch(err => {
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

// ===============================
// MAIN AI CALL
// ===============================
async function handleAICall({ messages: incomingMessages, systemPrompt, context, apiKey }) {
  if (!apiKey) {
    throw new Error("No API key set.");
  }

  let messages = await getMessages();
  let summary = await getSummary();

  // Append new messages
  messages = [...messages, ...incomingMessages];

  // Summarize older messages if needed
  if (messages.length > SUMMARY_TRIGGER) {
    summary = await summarizeMessages(messages, summary, apiKey);
    messages = messages.slice(-MAX_MESSAGES);
    await saveSummary(summary);
  }

  // Trim before sending
  const trimmedMessages = messages.slice(-MAX_MESSAGES);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `
${systemPrompt}

You are an academic advisor for CUNY DegreeWorks.

Stay strictly within academic advising.

Use the student's official DegreeWorks audit data below as the source of truth.
Do not guess if the data is available.
Always prefer audit data over assumptions.

Conversation Summary:
${summary || "None"}

DegreeWorks Audit Context:
${context || "No audit data available yet."}
`
        },
        ...trimmedMessages
      ]
    })
  });

  // Safe parsing (prevents crashes)
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

  const assistantReply = data?.choices?.[0]?.message?.content || "";

  // Save assistant response
  messages.push({ role: "assistant", content: assistantReply });

  // Trim stored messages
  messages = messages.slice(-MAX_MESSAGES);
  await saveMessages(messages);

  return { content: assistantReply };
}

// ===============================
// SUMMARIZATION
// ===============================
async function summarizeMessages(messages, existingSummary, apiKey) {
  const olderMessages = messages.slice(0, -MAX_MESSAGES);

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
`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      messages: [
        { role: "system", content: prompt },
        ...olderMessages
      ]
    })
  });

  let data = null;
  let text = "";

  try {
    text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {}

  return data?.choices?.[0]?.message?.content || existingSummary || "";
}

// ===============================
// STORAGE HELPERS
// ===============================
function getMessages() {
  return new Promise(resolve => {
    chrome.storage.local.get(["messages"], (res) => {
      resolve(res.messages || []);
    });
  });
}

function saveMessages(messages) {
  return new Promise(resolve => {
    chrome.storage.local.set({ messages }, resolve);
  });
}

function getSummary() {
  return new Promise(resolve => {
    chrome.storage.local.get(["summary"], (res) => {
      resolve(res.summary || "");
    });
  });
}

function saveSummary(summary) {
  return new Promise(resolve => {
    chrome.storage.local.set({ summary }, resolve);
  });
}