export function renderMessages(messages) {
  const el = document.getElementById("cuny-msgs");
  if (!el) return;
  el.innerHTML = messages.map(m => `
    <div class="cmsg cmsg-${m.role}">
      ${m.role === "assistant" ? `<div class="cmsg-ico">AI</div>` : ""}
      <div class="cbubble">${markdown(m.content)}</div>
    </div>
  `).join("");
  el.scrollTop = el.scrollHeight;
}

export function showTyping() {
  const el = document.getElementById("cuny-msgs");
  if (!el) return;
  const t = document.createElement("div");
  t.id = "cuny-typing-ind";
  t.className = "cmsg cmsg-assistant";
  t.innerHTML = `<div class="cmsg-ico">AI</div><div class="cbubble typing-bubble"><span></span><span></span><span></span></div>`;
  el.appendChild(t);
  el.scrollTop = el.scrollHeight;
}

export function hideTyping() {
  document.getElementById("cuny-typing-ind")?.remove();
}

function markdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g,    "<em>$1</em>")
    .replace(/`([^`]+)`/g,    "<code>$1</code>")
    .replace(/^[•\-] (.+)$/gm, "• $1")
    .replace(/\n/g, "<br>");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}