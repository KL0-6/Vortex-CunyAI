// popup.js

const input = document.getElementById("api-key-input");
const saveBtn = document.getElementById("save-btn");
const statusMsg = document.getElementById("status-msg");
const toggleVis = document.getElementById("toggle-vis");
const keyDot = document.getElementById("key-dot");
const keyStatusText = document.getElementById("key-status-text");

// Load existing key on popup open
chrome.storage.sync.get(["groqApiKey"], (result) => {
  if (result.groqApiKey) {
    input.value = result.groqApiKey;
    setKeyStatus(true);
  }
});

// Toggle visibility
let isVisible = false;
toggleVis.addEventListener("click", () => {
  isVisible = !isVisible;
  input.type = isVisible ? "text" : "password";
});

// Save key
saveBtn.addEventListener("click", () => {
  const key = input.value.trim();

  if (!key) {
    showStatus("Please enter an API key.", "error");
    return;
  }

  if (!key.startsWith("gsk_")) {
    showStatus("Groq keys start with 'gsk_' — double check your key.", "error");
    return;
  }

  chrome.storage.sync.set({ groqApiKey: key }, () => {
    showStatus("✓ Groq API key saved!", "success");
    setKeyStatus(true);
  });
});

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `status ${type} show`;
  setTimeout(() => statusMsg.classList.remove("show"), 3500);
}

function setKeyStatus(hasKey) {
  keyDot.className = `dot ${hasKey ? "active" : "inactive"}`;
  keyStatusText.textContent = hasKey ? "API key saved ✓" : "No API key saved";
}