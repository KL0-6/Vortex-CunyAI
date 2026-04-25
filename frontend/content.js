import { injectPageInterceptor } from "./utils/interceptor.js";
import { AdvisorPanel } from "./ui/panel.js";

(function () {
  "use strict";
  if (document.getElementById("cuny-advisor-root")) return;

  injectPageInterceptor();

  const advisor = new AdvisorPanel();
  window.__cunyAdvisorPanel = advisor;

  window.addEventListener("message", (e) => {
    if (e.source === window && e.data?.__cunyAdvisor) {
      advisor.updateAuditData(e.data.payload);
    }
  });

  if (document.readyState === "complete") {
    advisor.init();
  } else {
    window.addEventListener("load", () => advisor.init());
  }
})();