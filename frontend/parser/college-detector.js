const CUNY_COLLEGES = {
  baruch:    { name: 'Baruch College',                         code: 'BAR' },
  brooklyn:  { name: 'Brooklyn College',                       code: 'BKL' },
  ccny:      { name: 'City College of New York',               code: 'CCN' },
  citytech:  { name: 'NYC College of Technology',              code: 'NYT' },
  csi:       { name: 'College of Staten Island',               code: 'CSI' },
  hunter:    { name: 'Hunter College',                         code: 'HUN' },
  jjay:      { name: 'John Jay College of Criminal Justice',   code: 'JJC' },
  lehman:    { name: 'Lehman College',                         code: 'LEH' },
  medgarevers: { name: 'Medgar Evers College',                 code: 'MEC' },
  qc:        { name: 'Queens College',                         code: 'QNS' },
  york:      { name: 'York College',                           code: 'YRK' },
  sps:       { name: 'CUNY School of Professional Studies',    code: 'SPS' },
  slu:       { name: 'CUNY School of Labor and Urban Studies', code: 'SLU' },
  sph:       { name: 'CUNY Graduate School of Public Health',  code: 'SPH' },
  gc:        { name: 'CUNY Graduate Center',                   code: 'GRD' },
  law:       { name: 'CUNY School of Law',                     code: 'LAW' },
  journalism:{ name: 'Craig Newmark Graduate School of Journalism', code: 'JOU' },
  bmcc:      { name: 'Borough of Manhattan Community College', code: 'BMC' },
  bcc:       { name: 'Bronx Community College',                code: 'BCC' },
  hostos:    { name: 'Hostos Community College',               code: 'HOS' },
  kbcc:      { name: 'Kingsborough Community College',         code: 'KCC' },
  laguardia: { name: 'LaGuardia Community College',            code: 'LAG' },
  qcc:       { name: 'Queensborough Community College',        code: 'QCC' },
  guttman:   { name: 'Guttman Community College',              code: 'GUT' }
};

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

export function detectCollege(audit) {
  const json = JSON.stringify(audit);

  // Strategy 1: AdviceJump URLs
  const urlRegex = /https?:\/\/(?:www\.)?([a-z0-9-]+)\.cuny\.edu/gi;
  const urlHits = new Map();
  let m;
  while ((m = urlRegex.exec(json)) !== null) {
    const sub = m[1].toLowerCase();
    urlHits.set(sub, (urlHits.get(sub) || 0) + 1);
  }
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

  // Strategy 3: distinctive prefixes
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
}