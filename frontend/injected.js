// injected.js — runs in the PAGE's main world (not the extension's isolated world)
// Intercepts DegreeWorks /api/audit fetch and relays data to the content script via postMessage.
// Injected as a <script src="..."> tag to comply with Content Security Policy.

(function () {
  if (window.__cunyAdvisorPatched) return;
  window.__cunyAdvisorPatched = true;

  function relay(data) {
    window.postMessage({ __cunyAdvisor: true, payload: data }, "*");
  }

  // -- Intercept fetch
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _fetch.apply(this, args);
    const url = (typeof args[0] === "string" ? args[0] : args[0]?.url) || "";
    console.log("fetch called with URL:", url);
    if (url.includes("audit?studentId")) {
      console.log("[CUNY Advisor] Audit API request intercepted:", url);
      response.clone().json().then(data => {
        console.log("[CUNY Advisor] Audit data received:", data);
        relay(data);
      }).catch(err => {
        console.warn("[CUNY Advisor] Failed to parse audit response:", err);
      });
    }
    return response;
  };

  // -- Intercept XHR (fallback)
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    console.log(url);
    if (url && url.includes("audit?studentId")) this._cunyAudit = true;
    return _open.call(this, method, url, ...rest);
  };

  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this._cunyAudit) {
      this.addEventListener("load", function () {
        console.log("Loaded audit XHR:", this.responseURL);
        try {
          const data = JSON.parse(this.responseText);
          console.log("[CUNY Advisor] Audit XHR intercepted:", data);
          relay(data);
        } catch (err) {
          console.warn("[CUNY Advisor] Failed to parse XHR audit response:", err);
        }
      });
    }
    return _send.call(this, ...args);
  };

  // -- Check if DW already cached audit data on window
  for (const key of ["auditData", "dgwAudit", "degreeworksData", "__auditData__"]) {
    if (window[key] && window[key].auditHeader) {
      console.log("[CUNY Advisor] Found cached audit data on window." + key);
      relay(window[key]);
      break;
    }
  }
})();