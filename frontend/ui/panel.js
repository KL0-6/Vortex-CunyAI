import { PANEL_HTML } from "./panel-html.js";
import { renderMessages, showTyping, hideTyping } from "./chat-renderer.js";
import { parseAudit } from "../parser/audit-parser.js";
import { formatContext } from "../parser/context-formatter.js";

export class AdvisorPanel {
  constructor() {
    this.auditData  = null;
    this.context    = "";
    this.messages   = [];
    this.isLoading  = false;
    this.dataLoaded = false;
    this.college    = "CUNY";
  }

  init() {
    this.injectHTML();
    this.bindEvents();
    this.addMsg("assistant",
      "👋 **Hi! I'm your CUNY Academic Advisor.**\n\n" +
      "⏳ Waiting for your DegreeWorks audit to load… Once it does, I'll have your full course history, GPA, and requirement progress.\n\n" +
      "You can start asking questions now and I'll give precise advice as soon as the data arrives!"
    );
  }

  injectHTML() {
    const root = document.createElement("div");
    root.id = "cuny-advisor-root";
    root.innerHTML = PANEL_HTML;
    document.body.appendChild(root);
  }

  bindEvents() {
    const $ = id => document.getElementById(id);

    $("cuny-toggle").onclick = () => {
      const p = $("cuny-panel");
      const open = p.classList.toggle("cuny-panel-visible");
      p.classList.toggle("cuny-panel-hidden", !open);
      $("cuny-toggle").classList.toggle("toggle-open", open);
    };

    $("btn-close").onclick = () => {
      $("cuny-panel").classList.replace("cuny-panel-visible", "cuny-panel-hidden");
      $("cuny-toggle").classList.remove("toggle-open");
    };

    $("btn-data").onclick = () => {
      const dv = $("data-view");
      const isHidden = dv.classList.contains("dv-hidden");
      dv.classList.toggle("dv-hidden", !isHidden);
      dv.classList.toggle("dv-visible", isHidden);
    };

    $("btn-clear").onclick = () => {
      this.messages = [];
      this.addMsg("assistant", "Conversation cleared! What would you like to know about your degree progress?");
    };

    $("btn-send").onclick = () => this.send();

    $("cuny-input").onkeydown = e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.send(); }
    };
    $("cuny-input").oninput = function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    };

    $("cuny-chips").onclick = e => {
      const btn = e.target.closest(".chip");
      if (btn) {
        $("cuny-input").value = btn.dataset.q;
        this.send();
      }
    };
  }

  updateAuditData(rawJson) {
    try {
      this.auditData  = parseAudit(rawJson);
      this.context    = formatContext(this.auditData);
      this.college    = this.auditData.college;
      this.dataLoaded = true;
      this._refreshUI();
    } catch (e) {
      console.warn("[CUNY Advisor] Parse error:", e);
    }
  }

  _refreshUI() {
    const d = this.auditData;
    if (!d) return;

    const sub = document.getElementById("cuny-sub");
    if (sub) {
      const last = (d.studentName || "").split(",")[0];
      sub.textContent = `${last} · ${d.college}`;
    }

    const wrap = document.getElementById("prog-wrap");
    const fill = document.getElementById("prog-fill");
    const cred = document.getElementById("prog-credits");
    if (wrap && fill) {
      wrap.style.display = "block";
      fill.style.width   = Math.min(d.credits.percentComplete, 100) + "%";
      if (cred) cred.textContent = `${d.credits.applied + d.credits.inProgress} / ${d.credits.required} cr`;
    }

    const dvStatus = document.getElementById("dv-status");
    const dvPre    = document.getElementById("dv-pre");
    if (dvStatus) { dvStatus.textContent = "✓ Loaded"; dvStatus.className = "dv-loaded"; }
    if (dvPre)    dvPre.textContent = this.context;

    const firstName = (d.studentName || "").split(",")[1]?.trim().split(" ")[0] || "";
    const majShort  = (d.major || "").replace("Major in ", "");
    const ipList    = d.inProgressCourses.map(c => c.code).join(", ");
    const rem       = d.credits.remaining ?? (d.credits.required - d.credits.applied - d.credits.inProgress);

    this.messages = [];
    this.addMsg("assistant",
      `👋 Hi${firstName ? " **" + firstName + "**" : ""}! I've loaded your DegreeWorks audit.\n\n` +
      `📊 **${d.credits.percentComplete}% complete** toward your ${d.degreeName}\n` +
      `📚 Credits done: **${d.credits.applied}** · In progress: **${d.credits.inProgress}** · Still needed: **${rem}**\n` +
      `🎓 Major: **${majShort}** — ${d.majorRequirements?.percentComplete ?? 0}% done\n` +
      `⭐ GPA: **${d.gpa.toFixed(3)}**\n` +
      (ipList ? `🔄 Currently taking: ${ipList}\n` : "") +
      `\nWhat would you like to know about your path to graduation?`
    );
  }

  addMsg(role, content) {
    this.messages.push({ role, content });
    renderMessages(this.messages);
  }

  async send() {
    const input = document.getElementById("cuny-input");
    const text  = (input.value || "").trim();
    if (!text || this.isLoading) return;
    input.value = "";
    input.style.height = "auto";

    this.addMsg("user", text);
    this.isLoading = true;
    showTyping();

    const { apiKey } = await chrome.runtime.sendMessage({ type: "GET_API_KEY" });
    const systemPrompt = this._buildSystemPrompt();

    const history = this.messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await chrome.runtime.sendMessage({
        type: "CALL_AI",
        payload: { messages: history, systemPrompt, context: this.context, apiKey }
      });
      hideTyping();
      this.isLoading = false;
      this.addMsg("assistant", res.error ? `⚠️ ${res.error}` : res.content);
    } catch (e) {
      hideTyping();
      this.isLoading = false;
      this.addMsg("assistant", `⚠️ Something went wrong: ${e.message}`);
    }
  }

  _buildSystemPrompt() {
    if (this.dataLoaded) {
      return `You are a knowledgeable, warm academic advisor for CUNY students at ${this.college}. You have the student's complete DegreeWorks audit data. Use it to give precise, specific, actionable advice.

Advisor guidelines:
- Always reference specific course codes, requirement names, and exact credit counts from the audit
- Be encouraging but realistic about remaining work
- When suggesting courses, mention any prerequisites you know about
- Point out courses that satisfy multiple requirements (gen ed + major) when possible
- If the student asks about something not in the audit data, say so and give general guidance
- Format lists with bullet points for readability
- You know CUNY transfer policies, ${this.college} course offerings, CUNY Pathways requirements, and ASAP/MAP program benefits`;
    }

    return `You are a helpful CUNY academic advisor at ${this.college}. The student's DegreeWorks audit hasn't loaded yet.
Answer general CUNY/${this.college} advising questions as best you can. Let them know that once their audit loads you'll be able to give much more specific advice based on their actual record.`;
  }
}