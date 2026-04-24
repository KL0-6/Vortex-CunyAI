export function getMessages() {
  return new Promise(resolve => {
    chrome.storage.local.get(["messages"], (res) => {
      resolve(res.messages || []);
    });
  });
}

export function saveMessages(messages) {
  return new Promise(resolve => {
    chrome.storage.local.set({ messages }, resolve);
  });
}

export function getSummary() {
  return new Promise(resolve => {
    chrome.storage.local.get(["summary"], (res) => {
      resolve(res.summary || "");
    });
  });
}

export function saveSummary(summary) {
  return new Promise(resolve => {
    chrome.storage.local.set({ summary }, resolve);
  });
}

export function getApiKey() {
  return new Promise(resolve => {
    chrome.storage.sync.get(["groqApiKey"], (res) => {
      resolve(res.groqApiKey || null);
    });
  });
}