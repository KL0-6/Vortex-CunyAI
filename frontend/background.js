import { MAX_MESSAGES, SUMMARY_TRIGGER } from "./config.js";
import { callAI } from "./ai/interface.js";
import { summarizeMessages } from "./ai/summary.js";
import { buildSystemPrompt } from "./ai/builder.js";
import {
  getMessages, saveMessages,
  getSummary, saveSummary,
  getApiKey
} from "./ai/storage/chat-store.js";

chrome.runtime.onMessage.addListener(async (request) => {
  if (request.type === "CALL_AI") {
    return handleAICall(request.payload)
      .catch(err => ({ error: err.message }));
  }
  if (request.type === "GET_API_KEY") {
    const apiKey = await getApiKey();
    return { apiKey };
  }
  if (request.type === "FETCH_CUNY_RULES") {
    const { payload = {} } = request;
    const subjects = payload.subjects?.length ? payload.subjects : ['CMSC'];
    const sendingcollege   = payload.sendingcollege   ?? 'BMC01';
    const receivingcollege = payload.receivingcollege ?? 'CTY01';

    const fetchSubject = async (subject) => {
      const body = new URLSearchParams({
        sendingcollege, receivingcollege,
        sendingsubject: subject,
        status: 'active', recentlyoffered: '1',
      }).toString();
      console.log("[CUNY Advisor] Fetching rules:", body);
      const r = await fetch("https://explorer.cuny.edu/ajax/cuny_rules", {
        headers: {
          "accept": "application/json, text/javascript, */*; q=0.01",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "pragma": "no-cache",
          "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"macOS\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
          "Referer": "https://explorer.cuny.edu/transfer-rules"
        },
        body,
        method: "POST"
      }).catch(() => null);
      return r?.ok ? r.json() : null;
    };

    const results = await Promise.all(subjects.map(fetchSubject));
    const allRules = results.filter(Boolean).flatMap(r => r.data || []);
    return { data: allRules };
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