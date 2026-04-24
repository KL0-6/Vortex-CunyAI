import { MAX_MESSAGES, SUMMARY_TRIGGER } from "./config.js";
import { callAI } from "./ai/interface.js";
import { summarizeMessages } from "./ai/summary.js";
import { buildSystemPrompt } from "./ai/builder.js";
import {
  getMessages, saveMessages,
  getSummary, saveSummary,
  getApiKey
} from "./ai/storage/chat-store.js";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CALL_AI") {
    handleAICall(request.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (request.type === "GET_API_KEY") {
    getApiKey().then(apiKey => sendResponse({ apiKey }));
    return true;
  }
});

async function handleAICall({ messages: incomingMessages, systemPrompt, context, apiKey }) {
  if (!apiKey) throw new Error("No API key set.");

  let messages = await getMessages();
  let summary = await getSummary();

  messages = [...messages, ...incomingMessages];

  if (messages.length > SUMMARY_TRIGGER) {
    summary = await summarizeMessages(messages, summary, apiKey);
    messages = messages.slice(-MAX_MESSAGES);
    await saveSummary(summary);
  }

  const trimmedMessages = messages.slice(-MAX_MESSAGES);

  const assistantReply = await callAI({
    apiKey,
    messages: [
      { role: "system", content: buildSystemPrompt({ systemPrompt, summary, context }) },
      ...trimmedMessages
    ]
  });

  messages.push({ role: "assistant", content: assistantReply });
  messages = messages.slice(-MAX_MESSAGES);
  await saveMessages(messages);

  return { content: assistantReply };
}