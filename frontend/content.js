// content.js — CUNY Academic Advisor
// Intercepts the DegreeWorks /api/audit response for rich, structured student data.
// No brittle DOM scraping — we parse the real API JSON directly.
  const CUNY_COLLEGES = {
  // Senior colleges
  'baruch':    { name: 'Baruch College',                         code: 'BAR', transferCode: 'BAR01' },
  'brooklyn':  { name: 'Brooklyn College',                       code: 'BKL', transferCode: 'BKL01' },
  'ccny':      { name: 'City College of New York',               code: 'CCN', transferCode: 'CTY01' },
  'citytech':  { name: 'NYC College of Technology',              code: 'NYT', transferCode: 'NYT01' },
  'csi':       { name: 'College of Staten Island',               code: 'CSI', transferCode: 'CSI01' },
  'hunter':    { name: 'Hunter College',                         code: 'HUN', transferCode: 'HUN01' },
  'jjay':      { name: 'John Jay College of Criminal Justice',   code: 'JJC', transferCode: 'JJC01' },
  'lehman':    { name: 'Lehman College',                         code: 'LEH', transferCode: 'LEH01' },
  'medgarevers': { name: 'Medgar Evers College',                 code: 'MEC', transferCode: 'MEC01' },
  'qc':        { name: 'Queens College',                         code: 'QNS', transferCode: 'QNS01' },
  'york':      { name: 'York College',                           code: 'YRK', transferCode: 'YRK01' },
  'sps':       { name: 'CUNY School of Professional Studies',    code: 'SPS', transferCode: 'SPS01' },
  'slu':       { name: 'CUNY School of Labor and Urban Studies', code: 'SLU', transferCode: 'SLU01' },
  'sph':       { name: 'CUNY Graduate School of Public Health',  code: 'SPH', transferCode: 'SPH01' },
  'gc':        { name: 'CUNY Graduate Center',                   code: 'GRD', transferCode: 'GRD01' },
  'law':       { name: 'CUNY School of Law',                     code: 'LAW', transferCode: 'LAW01' },
  'journalism':{ name: 'Craig Newmark Graduate School of Journalism', code: 'JOU', transferCode: 'JOU01' },

  // Community colleges
  'bmcc':      { name: 'Borough of Manhattan Community College', code: 'BMC', transferCode: 'BMC01' },
  'bcc':       { name: 'Bronx Community College',                code: 'BCC', transferCode: 'BCC01' },
  'hostos':    { name: 'Hostos Community College',               code: 'HOS', transferCode: 'HOS01' },
  'kbcc':      { name: 'Kingsborough Community College',         code: 'KCC', transferCode: 'KCC01' },
  'laguardia': { name: 'LaGuardia Community College',            code: 'LAG', transferCode: 'LAG01' },
  'qcc':       { name: 'Queensborough Community College',        code: 'QCC', transferCode: 'QCC01' },
  'guttman':   { name: 'Guttman Community College',              code: 'GUT', transferCode: 'GUT01' }
};

// Distinctive course prefixes by college (curated, not exhaustive)
// Only include prefixes that are unique or near-unique to that college.
const DISTINCTIVE_PREFIXES = {
  bmcc:      ['BPR', 'AFN', 'MMP', 'ACL', 'ACR', 'FNB', 'HIT', 'VAT', 'MHT', 'MES'],
  bcc:       ['OCD', 'CMS'],
  hostos:    ['GAME', 'OT', 'PTA'],
  kbcc:      ['MAR', 'TAH'],
  laguardia: ['LIB', 'HUC', 'ELL'],
  qcc:       ['MA', 'BU'],
  guttman:   ['CIT', 'ETHS', 'LAIS'],
  jjay:      ['PAD', 'FCM', 'FOS', 'SEC', 'POL'],
  citytech:  ['ARCH', 'CET', 'EMT', 'HOS', 'HMGT', 'RAD', 'VAT'],
  baruch:    ['BPL', 'CIS', 'STA', 'IBS'],
  hunter:    ['MEDP', 'PLSH'],
  ccny:      ['ASCH', 'WCIV'],
  brooklyn:  ['CASD', 'CBSE'],
  csi:       ['ESC', 'SCI', 'ENS'],
  lehman:    ['LEH', 'BBA'],
  qc:        ['QNS', 'FNES'],
  york:      ['AC', 'OT'],
  sps:       ['DATA', 'INFO']
};

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

  // DegreeWorks discipline codes → CUNY Transfer Explorer subject codes
  // Full 4-letter Transfer Explorer codes map to themselves.
  // Short/variant DegreeWorks codes (3-letter or college-specific) map to the canonical Transfer Explorer code.
  const DISCIPLINE_TO_SUBJECT = {
    // ── Transfer Explorer canonical codes (self-mapping) ──────────────────
    'ASAP':'ASAP','ACCT':'ACCT','ACLS':'ACLS','AFST':'AFST','ASLG':'ASLG',
    'ANMG':'ANMG','ANTH':'ANTH','ARAB':'ARAB','ARTX':'ARTX','ASAM':'ASAM',
    'ASTR':'ASTR','BIOL':'BIOL','BIOT':'BIOT','BUSI':'BUSI','BUMA':'BUMA',
    'BUSE':'BUSE','CHEM':'CHEM','CHIN':'CHIN','CJST':'CJST','CMIS':'CMIS',
    'CMSC':'CMSC','CODI':'CODI','COMM':'COMM','CTTN':'CTTN','DESK':'DESK',
    'ECON':'ECON','EDBL':'EDBL','EDCO':'EDCO','EDCS':'EDCS','EDEC':'EDEC',
    'EDHE':'EDHE','EDSE':'EDSE','EDUC':'EDUC','ELRN':'ELRN','ENGL':'ENGL',
    'ENSC':'ENSC','ENSL':'ENSL','ETHN':'ETHN','EVSC':'EVSC','FINA':'FINA',
    'FREN':'FREN','FROR':'FROR','GEIS':'GEIS','GEOG':'GEOG','GEOL':'GEOL',
    'GLST':'GLST','HEAL':'HEAL','HEST':'HEST','HIST':'HIST','HUSE':'HUSE',
    'ITAL':'ITAL','LAST':'LAST','LECO':'LECO','LING':'LING','MARK':'MARK',
    'MATC':'MATC','MATH':'MATH','MDTC':'MDTC','MMDE':'MMDE','MUSI':'MUSI',
    'NURS':'NURS','OFAT':'OFAT','PARA':'PARA','PERM':'PERM','PHIL':'PHIL',
    'PHYS':'PHYS','PORT':'PORT','POSC':'POSC','PSYC':'PSYC','PUNA':'PUNA',
    'PWKF':'PWKF','RETH':'RETH','SCIE':'SCIE','SOCI':'SOCI','SOSC':'SOSC',
    'SPAN':'SPAN','SPEE':'SPEE','STAB':'STAB','THEA':'THEA','TRAS':'TRAS',
    'TRTO':'TRTO','UBST':'UBST','VATC':'VATC','WGST':'WGST','WOFL':'WOFL',

    // ── Short/variant DegreeWorks codes → Transfer Explorer equivalents ───
    'ACC': 'ACCT',   // Accounting (BMCC, LaGuardia, Hostos, etc.)
    'ANT': 'ANTH',   // Anthropology
    'ARA': 'ARAB',   // Arabic
    'ART': 'ARTX',   // Art
    'AST': 'ASTR',   // Astronomy
    'BIO': 'BIOL',   // Biology
    'BUS': 'BUSI',   // Business
    'CHE': 'CHEM',   // Chemistry
    'CHN': 'CHIN',   // Chinese
    'CIS': 'CMIS',   // Computer Info Systems (Baruch, QCC)
    'CRJ': 'CJST',   // Criminal Justice
    'CSC': 'CMSC',   // Computer Science (BMCC)
    'CS':  'CMSC',   // Computer Science (some colleges)
    'ECO': 'ECON',   // Economics
    'EDU': 'EDUC',   // Education
    'ENG': 'ENGL',   // English
    'ESL': 'ENSL',   // English as Second Language
    'ETH': 'ETHN',   // Ethnic Studies
    'FRE': 'FREN',   // French
    'GEO': 'GEOG',   // Geography (use GEOG; add GEOL entry separately if needed)
    'HIS': 'HIST',   // History
    'ITA': 'ITAL',   // Italian
    'LIN': 'LING',   // Linguistics
    'MAT': 'MATH',   // Mathematics (BMCC, BCC, Hostos, LaGuardia, Guttman)
    'MUS': 'MUSI',   // Music
    'NUR': 'NURS',   // Nursing
    'PHI': 'PHIL',   // Philosophy
    'PHY': 'PHYS',   // Physics
    'POL': 'POSC',   // Political Science
    'POR': 'PORT',   // Portuguese
    'PSY': 'PSYC',   // Psychology
    'SOC': 'SOCI',   // Sociology
    'SPA': 'SPAN',   // Spanish
    'SPE': 'SPEE',   // Speech
    'THE': 'THEA',   // Theatre
    'WGS': 'WGST',   // Women & Gender Studies
  };

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

      const college = this._extractCollegeFromAdviceJump(raw);

      return {
        studentId:    h.studentId,
        studentName:  h.studentName,
        studentEmail: h.studentEmail,
        college:           college.name,
        collegeTransferCode: college.transferCode,

        degreeType:  degreeBlock.degree  || h.auditType,
        degreeName:  degreeBlock.title,
        major:        majorBlock.title,
        majorCode:    majorBlock.requirementValue,
        majorSubject: this._majorSubject(majorBlock),
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

_extractCollegeFromAdviceJump(audit) {
   const json = JSON.stringify(audit);

  // Strategy 1: AdviceJump URLs and any embedded cuny.edu links
  const urlRegex = /https?:\/\/(?:www\.)?([a-z0-9-]+)\.cuny\.edu/gi;
  const urlHits = new Map(); // subdomain -> count
  let m;
  while ((m = urlRegex.exec(json)) !== null) {
    const sub = m[1].toLowerCase();
    urlHits.set(sub, (urlHits.get(sub) || 0) + 1);
  }
  // Pick the most-referenced cuny subdomain that maps to a known college
  const ranked = [...urlHits.entries()]
    .filter(([sub]) => CUNY_COLLEGES[sub])
    .sort((a, b) => b[1] - a[1]);
  if (ranked.length) {
    const [sub] = ranked[0];
    return { ...CUNY_COLLEGES[sub], slug: sub, method: 'url', confidence: 'high' };
  }

  // Strategy 2: email domain
  const email = audit.auditHeader?.studentEmail || '';
  const emailMatch = email.match(/@(?:[\w-]+\.)?([\w-]+)\.cuny\.edu$/i);
  if (emailMatch) {
    const sub = emailMatch[1].toLowerCase();
    if (CUNY_COLLEGES[sub]) {
      return { ...CUNY_COLLEGES[sub], slug: sub, method: 'email', confidence: 'high' };
    }
  }

  // Strategy 3: distinctive course prefixes (frequency-weighted vote)
  const prefixCounts = {};
  const collectPrefixes = (str) => {
    if (typeof str !== 'string') return;
    const mm = str.match(/\b([A-Z]{2,5})\s+\d/);
    if (mm) prefixCounts[mm[1]] = (prefixCounts[mm[1]] || 0) + 1;
  };
  audit.blockArray?.forEach(b => {
    b.header?.qualifierArray?.forEach(q => q.subTextList?.forEach(collectPrefixes));
    b.ruleArray?.forEach(r => {
      r.requirement?.courseArray?.forEach(c => {
        if (c.discipline) prefixCounts[c.discipline] = (prefixCounts[c.discipline] || 0) + 1;
      });
    });
  });

  const scores = {};
  for (const [slug, prefixes] of Object.entries(DISTINCTIVE_PREFIXES)) {
    scores[slug] = prefixes.reduce((s, p) => s + (prefixCounts[p] || 0), 0);
  }
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 0) {
    return { ...CUNY_COLLEGES[top[0]], slug: top[0], method: 'prefix', confidence: 'medium' };
  }

  return { name: 'CUNY', code: null, slug: null, method: 'none', confidence: 'none' };
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

    _majorSubject(block) {
      for (const rule of block.ruleArray || []) {
        const subrules = rule.ruleType === "Subset" ? (rule.ruleArray || []) : [rule];
        for (const req of subrules) {
          if (req.ruleType !== "Course") continue;
          const applied = req.classesAppliedToRule?.classArray || [];
          const disc = applied[0]?.discipline || (req.advice?.courseArray || [])[0]?.discipline;
          if (disc) return DISCIPLINE_TO_SUBJECT[disc] ?? null;
        }
      }
      return null;
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
  function parseTransferRule(row) {
    const extractSpans = (html) => {
      const out = [];
      const re = /<span[^>]*title="([^"]*)"[^>]*>([^<]*)<\/span>/g;
      let m;
      while ((m = re.exec(html)) !== null) out.push({ title: m[1], code: m[2].trim() });
      return out;
    };
    const sending   = extractSpans(row.td2 || '');
    const receiving = extractSpans(row.td4 || '');
    return {
      sendingCodes:    sending.map(s => s.code),
      sendingTitles:   sending.map(s => s.title),
      receivingCodes:  receiving.map(r => r.code),
      receivingTitles: receiving.map(r => r.title),
      isCombination:   sending.length > 1,
    };
  }

  const advisor = {
    auditData:   null,
    cunyRules:   null,
    context:     "",
    messages:    [],
    isLoading:   false,
    dataLoaded:  false,
    targetCollege: null,
    targetCollegeName: null,

    init() {
      this._injectSvgSprite().then(() => {
        this.injectHTML();
        this.bindEvents();
      });
    },

    _injectSvgSprite() {
      return fetch(chrome.runtime.getURL("cory-logo.svg"))
        .then(r => r.text())
        .then(svg => {
          const wrap = document.createElement("div");
          wrap.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
          wrap.innerHTML = svg;
          document.body.prepend(wrap);
        })
        .catch(() => {});
    },

    _coryLogoSvg() {
      return `<svg aria-hidden="true"><use href="#cory-logo"/></svg>`;
    },

    injectHTML() {
      const root = document.createElement("div");
      root.id = "cuny-advisor-root";
      root.innerHTML = `
      
        <button id="cuny-toggle">
          <span id="cuny-toggle-logo">${this._coryLogoSvg()}</span>
          <span>Cory</span>
        </button>

        <div id="cuny-panel" class="cuny-panel-hidden">
  <div class="cuny-inner">

          <div class="cuny-hdr">
            <div class="cuny-hdr-logo">${this._coryLogoSvg()}</div>

            <div class="cuny-ttl-wrap">
              <div class="cuny-ttl">Cory</div>
              <div class="cuny-sub" id="cuny-sub">CUNY Academic Advisor</div>
            </div>

            <div class="cuny-hdr-btns">
              <button id="btn-data" title="View audit data">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </button>
              <button id="btn-clear" title="Clear chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

            <div class="cuny-hdr-bar">
              <div class="cuny-hdr-bar-fill" id="prog-fill" style="width:0%"></div>
            </div>
          </div>

          <div class="cuny-transfer-bar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <span>Transfer to:</span>
            <select id="transfer-select">
              <option value="">— select a college —</option>
              <optgroup label="Senior Colleges">
                <option value="BAR01">Baruch College</option>
                <option value="BKL01">Brooklyn College</option>
                <option value="CTY01">City College of New York</option>
                <option value="NYT01">NYC College of Technology</option>
                <option value="CSI01">College of Staten Island</option>
                <option value="HUN01">Hunter College</option>
                <option value="JJC01">John Jay College</option>
                <option value="LEH01">Lehman College</option>
                <option value="MEC01">Medgar Evers College</option>
                <option value="QNS01">Queens College</option>
                <option value="YRK01">York College</option>
                <option value="SPS01">School of Professional Studies</option>
                <option value="SLU01">School of Labor &amp; Urban Studies</option>
              </optgroup>
              <optgroup label="Community Colleges">
                <option value="BMC01">BMCC</option>
                <option value="BCC01">Bronx Community College</option>
                <option value="HOS01">Hostos Community College</option>
                <option value="KCC01">Kingsborough Community College</option>
                <option value="LAG01">LaGuardia Community College</option>
                <option value="QCC01">Queensborough Community College</option>
                <option value="GUT01">Guttman Community College</option>
              </optgroup>
            </select>
          </div>

          <div class="cuny-prog-wrap" id="prog-wrap" style="display:none">
            <div class="cuny-prog-meta">
              <span>Graduation Progress</span>
              <span id="prog-credits"></span>
            </div>
            <div class="cuny-prog-track">
              <div class="cuny-prog-fill" id="prog-fill-bar"></div>
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
            <button class="chip transfer-chip" data-q="Which of my courses will transfer to my target college, and what credits do I still need to complete there?">Transfer plan</button>
          </div>

          <div class="cuny-input-wrap">
            <div class="cuny-input-area">
              <input id="cuny-input" type="text" placeholder="Ask about requirements, courses, graduation…" />
              <button id="btn-send">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
          <p class="cuny-ft">Cory · Claude-powered · Data stays in your browser</p>
        </div>
          </div>
      `;
      document.body.appendChild(root);
      this.addMsg("assistant",
        "👋 **Hi! I'm Cory, your CUNY Academic Advisor.**\n\n" +
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
        if (e.key === "Enter") { e.preventDefault(); this.send(); }
      };

      $("cuny-chips").onclick = e => {
        const btn = e.target.closest(".chip");
        if (btn) {
          $("cuny-input").value = btn.dataset.q;
          this.send();
        }
      };

      $("transfer-select").onchange = () => {
        const sel = $("transfer-select");
        this.targetCollege = sel.value || null;
        this.targetCollegeName = sel.value ? sel.options[sel.selectedIndex].text : null;
        if (this.targetCollege && this.auditData) this._fetchRules();
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

      // Progress bars
      const hdrFill = document.getElementById("prog-fill");
      if (hdrFill) hdrFill.style.width = Math.min(d.credits.percentComplete, 100) + "%";

      const wrap  = document.getElementById("prog-wrap");
      const fill  = document.getElementById("prog-fill-bar");
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
          ${m.role === "assistant" ? `<div class="cmsg-ico"><svg aria-hidden="true"><use href="#cory-logo"/></svg></div>` : ""}
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

    _fetchRules() {
      const d = this.auditData;
      if (!d || !this.targetCollege) return;
      const allCourses = [...(d.completedCourses || []), ...(d.inProgressCourses || [])];
      const subjects = [...new Set(
        allCourses
          .map(c => DISCIPLINE_TO_SUBJECT[c.code.split(' ')[0]])
          .filter(Boolean)
      )];
      chrome.runtime.sendMessage({
        type: "FETCH_CUNY_RULES",
        payload: {
          sendingcollege: d.collegeTransferCode,
          receivingcollege: this.targetCollege,
          subjects: subjects.length ? subjects : undefined,
        }
      }, response => {
        if (response?.data) {
          this.cunyRules = response.data;
        } else if (response?.error) {
          console.warn("[CUNY Advisor] Failed to fetch CUNY rules:", response.error);
        }
      });
    },

    _transferContext() {
      if (!this.cunyRules?.length || !this.auditData) return '';
      const completed   = new Map((this.auditData.completedCourses  || []).map(c => [c.code, c]));
      const inProgress  = new Map((this.auditData.inProgressCourses || []).map(c => [c.code, c]));
      const known       = new Set([...completed.keys(), ...inProgress.keys()]);

      const single = [], combo = [];
      for (const row of this.cunyRules) {
        const rule = parseTransferRule(row);
        if (rule.isCombination) {
          if (rule.sendingCodes.some(c => known.has(c))) combo.push(rule);
        } else {
          const code = rule.sendingCodes[0];
          if (known.has(code)) single.push({ rule, course: completed.get(code) || inProgress.get(code) });
        }
      }
      if (!single.length && !combo.length) return '';

      const collegeName = this.targetCollegeName || 'receiving college';
      const lines = [`TRANSFER EQUIVALENCIES (your courses → ${collegeName}):`];
      for (const { rule, course } of single) {
        const grade  = course.grade ? ` [${course.grade}]` : ' [in progress]';
        const recv   = rule.receivingTitles.join(' + ') || rule.receivingCodes.join(' + ');
        lines.push(`• ${rule.sendingTitles[0] || rule.sendingCodes[0]}${grade}  →  ${recv}`);
      }
      if (combo.length) {
        lines.push('Combination rules (all listed sending courses transfer jointly):');
        for (const rule of combo) {
          const recv    = rule.receivingTitles.join(' + ') || rule.receivingCodes.join(' + ');
          const hasAll  = rule.sendingCodes.every(c => known.has(c));
          const status  = hasAll ? '[you have all]' : '[partial — need: ' + rule.sendingCodes.filter(c => !known.has(c)).join(', ') + ']';
          lines.push(`• ${rule.sendingCodes.join(' + ')}  →  ${recv}  ${status}`);
        }
      }
      return lines.join('\n');
    },

    // ── Send message to Claude ───────────────────────────────────────────
    async send() {
      const input = document.getElementById("cuny-input");
      const text  = (input.value || "").trim();
      if (!text || this.isLoading) return;
      input.value = "";

      this.addMsg("user", text);
      this.isLoading = true;
      this._showTyping();

      const { apiKey } = await chrome.runtime.sendMessage({ type: "GET_API_KEY" });

      const transferCtx = this._transferContext();
      const transferNote = this.targetCollegeName
        ? ` The student is planning to transfer to ${this.targetCollegeName}.`
        : '';
      const systemPrompt = this.dataLoaded
        ? `You are a knowledgeable, warm academic advisor for CUNY students at ${this.college}.${transferNote} You have the student's complete DegreeWorks audit data below. Use it to give precise, specific, actionable advice.

${this.context}
${transferCtx ? '\n' + transferCtx : ''}

Advisor guidelines:
- Always reference specific course codes, requirement names, and exact credit counts from the audit
- Be encouraging but realistic about remaining work
- When suggesting courses, mention any prerequisites you know about
- Point out courses that satisfy multiple requirements (gen ed + major) when possible
- If the student asks about something not in the audit data, say so and give general guidance
- Format lists with bullet points for readability
- You know CUNY transfer policies, ${this.college} course offerings, CUNY Pathways requirements, and ASAP/MAP program benefits`

        : `You are a helpful CUNY academic advisor at ${this.college}. The student's DegreeWorks audit hasn't loaded yet in the browser.
Answer general CUNY/${this.college} advising questions as best you can. Let them know that once their audit loads you'll be able to give much more specific advice based on their actual record.`;

      // Build conversation history (exclude the system-level welcome if data not loaded)
      const history = this.messages
        .slice(0, -1)   // exclude the message we JUST added (will be in the array)
        .concat([{ role: "user", content: text }])
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

      try {
        const res = await chrome.runtime.sendMessage({
          type: "CALL_AI",
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
      t.innerHTML = `<div class="cmsg-ico"><svg aria-hidden="true"><use href="#cory-logo"/></svg></div><div class="cbubble typing-bubble"><span></span><span></span><span></span></div>`;
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
      if (advisor.targetCollege) advisor._fetchRules();
    }
  });

  window.__cunyAdvisorPanel = advisor;

  if (document.readyState === "complete") {
    advisor.init();
  } else {
    window.addEventListener("load", () => advisor.init());
  }
})();