export const PANEL_HTML = `
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
          <div class="cuny-sub" id="cuny-sub">CUNY</div>
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
    <p class="cuny-ft">AI-powered · Data stays in your browser</p>
  </div>
`;