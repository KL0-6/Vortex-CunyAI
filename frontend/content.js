// content.js — CUNY Academic Advisor
// Intercepts the DegreeWorks /api/audit response for rich, structured student data.
// No brittle DOM scraping — we parse the real API JSON directly.

(function () {
  "use strict";
  if (document.getElementById("cuny-advisor-root")) return;

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Inject a script into the PAGE'S main world to intercept fetch/XHR
  // Content scripts can't read fetch responses directly due to the isolated
  // world boundary, so we relay data back via window.postMessage.
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 - Inject injected.js into the PAGE's main world via <script src>.
  // Using src= (not inline textContent) to comply with DegreeWorks Content Security Policy.
  // The injected script intercepts fetch/XHR and relays audit JSON via postMessage.
  const interceptor = document.createElement("script");
  interceptor.src = chrome.runtime.getURL("injected.js");
  interceptor.onload = () => interceptor.remove();
  (document.head || document.documentElement).prepend(interceptor);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Parse the raw DegreeWorks JSON into a clean data model
  // ══════════════════════════════════════════════════════════════════════════
  const parser = {

    parse(raw) {
      const h   = raw.auditHeader  || {};
      const blk = raw.blockArray   || [];
      const ci  = raw.classInformation || {};

      const degreeBlock  = blk.find(b => b.requirementType === "DEGREE") || {};
      const genEdBlock   = blk.find(b => b.requirementValue === "GEPATHAS") || {};
      const majorBlock   = blk.find(b => b.requirementType === "MAJOR") || {};
      const writingBlock = blk.find(b => b.requirementValue === "WRITING") || {};

      return {
        studentId:    h.studentId,
        studentName:  h.studentName,
        studentEmail: h.studentEmail,
        college:      "BMCC (CUNY)",

        degreeType:  degreeBlock.degree  || h.auditType,
        degreeName:  degreeBlock.title,
        major:       majorBlock.title,
        majorCode:   majorBlock.requirementValue,
        catalogYear: degreeBlock.catalogYear,

        gpa: parseFloat(h.studentSystemGpa || h.degreeworksGpa || 0),

        credits: {
          required:        60,
          applied:         parseInt(h.residentApplied || 0) + parseInt(h.transferApplied || 0) + parseInt(h.examAppliedCredits || 0),
          inProgress:      parseInt(h.residentAppliedInProgress || 0),
          percentComplete: parseInt(h.percentComplete || 0),
          remaining:       this._creditsRemaining(degreeBlock),
        },

        completedCourses:  this._completedCourses(ci),
        inProgressCourses: this._inProgressCourses(ci),

        genEdRequirements:  this._parseGenEd(genEdBlock),
        majorRequirements:  this._parseMajor(majorBlock),
        writingIntensive: {
          satisfied:      parseInt(writingBlock.percentComplete || 0) >= 98,
          creditsApplied: parseInt(writingBlock.creditsApplied || 0),
        },

        academicStatus: this._reportVal(ci, "ACAD_STATUS"),
        programs:       this._reportVal(ci, "PROGRAM"),
      };
    },

    _creditsRemaining(degreeBlock) {
      for (const line of (degreeBlock?.header?.advice?.textArray?.[0]?.lineList || [])) {
        const m = line.match(/need\s+(\d+)\s+more/i);
        if (m) return parseInt(m[1]);
      }
      return null;
    },

    _completedCourses(ci) {
      return (ci.classArray || [])
        .filter(c => c.inProgress !== "Y" && c.passed === "Y" && parseInt(c.credits) > 0)
        .map(c => ({
          code:  `${c.discipline} ${c.number}`,
          title: c.courseTitle,
          credits: parseInt(c.credits),
          grade: c.letterGrade,
          term:  c.termLiteral,
        }));
    },

    _inProgressCourses(ci) {
      return (ci.inProgress?.classArray || []).map(c => ({
        code:    `${c.discipline} ${c.number}`,
        credits: parseInt(c.credits),
        term:    c.termLiteral || "Current Semester",
      }));
    },

    _parseGenEd(block) {
      if (!block.ruleArray) return null;
      const categories = [];
      for (const rule of block.ruleArray) {
        const subrules = rule.ruleType === "Subset" ? (rule.ruleArray || []) : [rule];
        for (const sub of subrules) {
          if (sub.ruleType !== "Course") continue;
          categories.push({
            label:           sub.label,
            satisfied:       parseInt(sub.percentComplete || 0) >= 98,
            inProgress:      sub.inProgressIncomplete === "Yes",
            percentComplete: parseInt(sub.percentComplete || 0),
            appliedCourses:  (sub.classesAppliedToRule?.classArray || [])
                               .map(c => `${c.discipline} ${c.number} (${c.letterGrade})`),
            neededCourses:   parseInt(sub.percentComplete || 0) < 98
                               ? (sub.advice?.courseArray || [])
                                   .map(c => `${c.discipline} ${c.number} — ${c.title} (${c.credits} cr)`)
                               : [],
          });
        }
      }
      return {
        title:           block.title,
        percentComplete: parseInt(block.percentComplete || 0),
        creditsApplied:  parseInt(block.creditsApplied || 0),
        creditsRequired: 30,
        categories,
      };
    },

    _parseMajor(block) {
      if (!block.ruleArray) return null;
      const requirements = [];
      for (const rule of block.ruleArray) {
        const subrules = rule.ruleType === "Subset" ? (rule.ruleArray || []) : [rule];
        for (const req of subrules) {
          if (req.ruleType !== "Course") continue;
          const applied = req.classesAppliedToRule?.classArray || [];
          requirements.push({
            label:           req.label,
            satisfied:       parseInt(req.percentComplete || 0) >= 98,
            inProgress:      req.inProgressIncomplete === "Yes",
            percentComplete: parseInt(req.percentComplete || 0),
            appliedCourses:  applied.map(c => `${c.discipline} ${c.number} (${c.letterGrade})`),
            neededCourses:   applied.length === 0
              ? (req.advice?.courseArray || []).map(c => `${c.discipline} ${c.number} — ${c.title} (${c.credits} cr)`)
              : [],
            proxyAdvice: req.proxyAdvice?.textList?.join(" ") || null,
          });
        }
      }
      return {
        title:           block.title,
        code:            block.requirementValue,
        percentComplete: parseInt(block.percentComplete || 0),
        creditsApplied:  parseInt(block.creditsApplied || 0),
        creditsRequired: 30,
        requirements,
      };
    },

    _reportVal(ci, code) {
      return (ci.degreeInformation?.reportArray || []).find(r => r.code === code)?.value || null;
    },

    // ── Format to LLM context string ─────────────────────────────────────
    toContext(d) {
      const L = [];
      L.push("╔═══ CUNY DEGREEWORKS AUDIT ═══╗");
      L.push(`Student:      ${d.studentName}  (ID: ${d.studentId})`);
      L.push(`Email:        ${d.studentEmail}`);
      L.push(`College:      ${d.college}`);
      L.push(`Degree:       ${d.degreeName} (${d.degreeType})`);
      L.push(`Major:        ${d.major} [${d.majorCode}]`);
      L.push(`Catalog Year: ${d.catalogYear}`);
      if (d.academicStatus) L.push(`Standing:     ${d.academicStatus}`);
      if (d.programs)       L.push(`Programs:     ${d.programs}`);
      L.push("");

      L.push("─── GPA & CREDITS ───────────────────");
      L.push(`Cumulative GPA:         ${d.gpa.toFixed(3)}`);
      L.push(`Overall completion:     ${d.credits.percentComplete}%`);
      L.push(`Credits completed:      ${d.credits.applied}`);
      L.push(`Credits in-progress:    ${d.credits.inProgress}`);
      const rem = d.credits.remaining ?? (d.credits.required - d.credits.applied - d.credits.inProgress);
      L.push(`Credits still needed:   ${rem}`);
      L.push(`Credits required total: ${d.credits.required}`);
      L.push("");

      if (d.completedCourses.length) {
        L.push("─── COMPLETED COURSES ───────────────");
        for (const c of d.completedCourses) {
          L.push(`  ✓ ${c.code.padEnd(14)} ${c.grade.padEnd(4)} ${c.credits}cr  ${c.title || ""}  [${c.term}]`);
        }
        L.push("");
      }

      if (d.inProgressCourses.length) {
        L.push("─── CURRENTLY ENROLLED (Spring 2026) ─");
        for (const c of d.inProgressCourses) {
          L.push(`  🔄 ${c.code.padEnd(14)} ${c.credits}cr  [${c.term}]`);
        }
        L.push("");
      }

      L.push("─── WRITING INTENSIVE ───────────────");
      L.push(`  ${d.writingIntensive.satisfied ? "✅ Satisfied" : "⬜ Not yet satisfied"}`);
      L.push("");

      if (d.genEdRequirements) {
        const ge = d.genEdRequirements;
        L.push(`─── PATHWAYS GEN ED: ${ge.percentComplete}% (${ge.creditsApplied}/${ge.creditsRequired} cr) ─`);
        for (const cat of ge.categories) {
          const icon = cat.satisfied ? "✅" : cat.inProgress ? "🔄" : "⬜";
          L.push(`  ${icon} ${cat.label} (${cat.percentComplete}%)`);
          cat.appliedCourses.forEach(c => L.push(`       • ${c}`));
          if (!cat.satisfied && cat.neededCourses.length) {
            L.push(`       → Needs one of: ${cat.neededCourses.slice(0,3).join(" | ")}`);
          }
        }
        L.push("");
      }

      if (d.majorRequirements) {
        const maj = d.majorRequirements;
        L.push(`─── MAJOR REQUIREMENTS (${maj.title}): ${maj.percentComplete}% (${maj.creditsApplied}/${maj.creditsRequired} cr) ─`);
        for (const req of maj.requirements) {
          const icon = req.satisfied ? "✅" : req.inProgress ? "🔄" : "⬜";
          L.push(`  ${icon} ${req.label} (${req.percentComplete}%)`);
          req.appliedCourses.forEach(c => L.push(`       • Completed: ${c}`));
          if (!req.satisfied && req.neededCourses.length) {
            L.push(`       → Needs: ${req.neededCourses[0]}`);
          }
          if (req.proxyAdvice) L.push(`       ℹ ${req.proxyAdvice}`);
        }
        L.push("");
      }

      L.push("╚═══ END OF AUDIT ═══╝");
      return L.join("\n");
    },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Chat panel UI
  // ══════════════════════════════════════════════════════════════════════════
  const advisor = {
    auditData:   null,
    context:     "",
    messages:    [],
    isLoading:   false,
    dataLoaded:  false,

    init() {
      this.injectHTML();
      this.bindEvents();
    },

    injectHTML() {
      const root = document.createElement("div");
      root.id = "cuny-advisor-root";
      root.innerHTML = `
        <button id="cuny-toggle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span>Advisor</span>
        </button>

        <div id="cuny-panel" class="cuny-panel-hidden">

          <div class="cuny-hdr">
            <div class="cuny-hdr-left">
              <div class="cuny-avatar">AI</div>
              <div>
                <div class="cuny-ttl">Academic Advisor</div>
                <div class="cuny-sub" id="cuny-sub">CUNY · BMCC</div>
              </div>
            </div>
            <div class="cuny-hdr-btns">
              <button id="btn-data" title="View audit data">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </button>
              <button id="btn-clear" title="Clear chat">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                </svg>
              </button>
              <button id="btn-close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="cuny-prog-wrap" id="prog-wrap" style="display:none">
            <div class="cuny-prog-meta">
              <span>Graduation Progress</span>
              <span id="prog-credits"></span>
            </div>
            <div class="cuny-prog-track">
              <div class="cuny-prog-fill" id="prog-fill"></div>
            </div>
          </div>

          <div id="data-view" class="dv-hidden">
            <div class="dv-hdr">
              <span>📋 Audit Data</span>
              <span id="dv-status" class="dv-waiting">⏳ Waiting for DegreeWorks…</span>
            </div>
            <pre id="dv-pre"></pre>
          </div>

          <div id="cuny-msgs"></div>

          <div class="cuny-chips" id="cuny-chips">
            <button class="chip" data-q="What courses do I still need to complete my degree?">Remaining requirements</button>
            <button class="chip" data-q="Am I on track to graduate on time?">Am I on track?</button>
            <button class="chip" data-q="What major courses should I take next semester?">Plan next semester</button>
            <button class="chip" data-q="What gen ed requirements do I still need?">Gen Ed gaps</button>
          </div>

          <div class="cuny-input-wrap">
            <textarea id="cuny-input" rows="1" placeholder="Ask about requirements, courses, graduation…"></textarea>
            <button id="btn-send">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
          <p class="cuny-ft">Claude-powered · Data stays in your browser</p>
        </div>
      `;
      document.body.appendChild(root);
      this.addMsg("assistant",
        "👋 **Hi! I'm your CUNY Academic Advisor.**\n\n" +
        "⏳ Waiting for your DegreeWorks audit to load… Once it does, I'll have your full course history, GPA, and requirement progress.\n\n" +
        "You can start asking questions now and I'll give precise advice as soon as the data arrives!"
      );
    },

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
    },

    // ── Called when audit JSON arrives ──────────────────────────────────────
    updateAuditData(rawJson) {
      try {
        this.auditData = parser.parse(rawJson);
        this.context   = parser.toContext(this.auditData);
        this.dataLoaded = true;
        this._refreshUI();
      } catch (e) {
        console.warn("[CUNY Advisor] Parse error:", e);
      }
    },

    _refreshUI() {
      const d = this.auditData;
      if (!d) return;

      // Subtitle
      const sub = document.getElementById("cuny-sub");
      if (sub) {
        const last = (d.studentName || "").split(",")[0];
        sub.textContent = `${last} · ${d.college}`;
      }

      // Progress bar
      const wrap  = document.getElementById("prog-wrap");
      const fill  = document.getElementById("prog-fill");
      const cred  = document.getElementById("prog-credits");
      if (wrap && fill) {
        wrap.style.display = "block";
        fill.style.width   = Math.min(d.credits.percentComplete, 100) + "%";
        if (cred) cred.textContent = `${d.credits.applied + d.credits.inProgress} / ${d.credits.required} cr`;
      }

      // Data view
      const dvStatus = document.getElementById("dv-status");
      const dvPre    = document.getElementById("dv-pre");
      if (dvStatus) { dvStatus.textContent = "✓ Loaded"; dvStatus.className = "dv-loaded"; }
      if (dvPre)    dvPre.textContent = this.context;

      // Replace welcome message with loaded greeting
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
    },

    addMsg(role, content) {
      this.messages.push({ role, content });
      this._renderMsgs();
    },

    _renderMsgs() {
      const el = document.getElementById("cuny-msgs");
      if (!el) return;
      el.innerHTML = this.messages.map(m => `
        <div class="cmsg cmsg-${m.role}">
          ${m.role === "assistant" ? `<div class="cmsg-ico">AI</div>` : ""}
          <div class="cbubble">${this._md(m.content)}</div>
        </div>
      `).join("");
      el.scrollTop = el.scrollHeight;
    },

    _md(text) {
      return this._esc(text)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g,    "<em>$1</em>")
        .replace(/`([^`]+)`/g,   "<code>$1</code>")
        .replace(/^[•\-] (.+)$/gm, "• $1")
        .replace(/\n/g, "<br>");
    },

    _esc(s) {
      return String(s)
        .replace(/&/g,"&amp;").replace(/</g,"&lt;")
        .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    },

    // ── Send message to Claude ───────────────────────────────────────────
    async send() {
      const input = document.getElementById("cuny-input");
      const text  = (input.value || "").trim();
      if (!text || this.isLoading) return;
      input.value = "";
      input.style.height = "auto";

      this.addMsg("user", text);
      this.isLoading = true;
      this._showTyping();

      const { apiKey } = await chrome.runtime.sendMessage({ type: "GET_API_KEY" });

      const systemPrompt = this.dataLoaded
        ? `You are a knowledgeable, warm academic advisor for CUNY students at BMCC. You have the student's complete DegreeWorks audit data below. Use it to give precise, specific, actionable advice.

${this.context}

Advisor guidelines:
- Always reference specific course codes, requirement names, and exact credit counts from the audit
- Be encouraging but realistic about remaining work
- When suggesting courses, mention any prerequisites you know about
- Point out courses that satisfy multiple requirements (gen ed + major) when possible
- If the student asks about something not in the audit data, say so and give general guidance
- Format lists with bullet points for readability
- You know CUNY transfer policies, BMCC course offerings, CUNY Pathways requirements, and ASAP/MAP program benefits`

        : `You are a helpful CUNY academic advisor at BMCC. The student's DegreeWorks audit hasn't loaded yet in the browser. 
Answer general CUNY/BMCC advising questions as best you can. Let them know that once their audit loads you'll be able to give much more specific advice based on their actual record.`;

      // Build conversation history (exclude the system-level welcome if data not loaded)
      const history = this.messages
        .slice(0, -1)   // exclude the message we JUST added (will be in the array)
        .concat([{ role: "user", content: text }])
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

      try {
        const res = await chrome.runtime.sendMessage({
          type: "CALL_CLAUDE",
          payload: { messages: history, systemPrompt, apiKey }
        });
        this._hideTyping();
        this.isLoading = false;
        this.addMsg("assistant", res.error ? `⚠️ ${res.error}` : res.content);
      } catch (e) {
        this._hideTyping();
        this.isLoading = false;
        this.addMsg("assistant", `⚠️ Something went wrong: ${e.message}`);
      }
    },

    _showTyping() {
      const el = document.getElementById("cuny-msgs");
      if (!el) return;
      const t = document.createElement("div");
      t.id = "cuny-typing-ind";
      t.className = "cmsg cmsg-assistant";
      t.innerHTML = `<div class="cmsg-ico">AI</div><div class="cbubble typing-bubble"><span></span><span></span><span></span></div>`;
      el.appendChild(t);
      el.scrollTop = el.scrollHeight;
    },

    _hideTyping() { document.getElementById("cuny-typing-ind")?.remove(); },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Wire message listener + boot
  // ══════════════════════════════════════════════════════════════════════════
  window.addEventListener("message", e => {
    if (e.source === window && e.data?.__cunyAdvisor) {
      advisor.updateAuditData(e.data.payload);
    }
  });

  window.__cunyAdvisorPanel = advisor;

  if (document.readyState === "complete") {
    advisor.init();
  } else {
    window.addEventListener("load", () => advisor.init());
  }
})();