import { detectCollege } from "./college-detector.js";

export function parseAudit(raw) {
  const h   = raw.auditHeader || {};
  const blk = raw.blockArray  || [];
  const ci  = raw.classInformation || {};

  const degreeBlock  = blk.find(b => b.requirementType === "DEGREE") || {};
  const genEdBlock   = blk.find(b => b.requirementValue === "GEPATHAS") || {};
  const majorBlock   = blk.find(b => b.requirementType === "MAJOR") || {};
  const writingBlock = blk.find(b => b.requirementValue === "WRITING") || {};

  const college = detectCollege(raw);

  return {
    studentId:    h.studentId,
    studentName:  h.studentName,
    studentEmail: h.studentEmail,
    college:      college.name,
    collegeSlug:  college.slug,

    degreeType:  degreeBlock.degree || h.auditType,
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
      remaining:       creditsRemaining(degreeBlock),
    },

    completedCourses:  completedCourses(ci),
    inProgressCourses: inProgressCourses(ci),

    genEdRequirements: parseGenEd(genEdBlock),
    majorRequirements: parseMajor(majorBlock),
    writingIntensive: {
      satisfied:      parseInt(writingBlock.percentComplete || 0) >= 98,
      creditsApplied: parseInt(writingBlock.creditsApplied || 0),
    },

    academicStatus: reportVal(ci, "ACAD_STATUS"),
    programs:       reportVal(ci, "PROGRAM"),
  };
}

function creditsRemaining(degreeBlock) {
  for (const line of (degreeBlock?.header?.advice?.textArray?.[0]?.lineList || [])) {
    const m = line.match(/need\s+(\d+)\s+more/i);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function completedCourses(ci) {
  return (ci.classArray || [])
    .filter(c => c.inProgress !== "Y" && c.passed === "Y" && parseInt(c.credits) > 0)
    .map(c => ({
      code: `${c.discipline} ${c.number}`,
      title: c.courseTitle,
      credits: parseInt(c.credits),
      grade: c.letterGrade,
      term: c.termLiteral,
    }));
}

function inProgressCourses(ci) {
  return (ci.inProgress?.classArray || []).map(c => ({
    code:    `${c.discipline} ${c.number}`,
    credits: parseInt(c.credits),
    term:    c.termLiteral || "Current Semester",
  }));
}

function parseGenEd(block) {
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
}

function parseMajor(block) {
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
}

function reportVal(ci, code) {
  return (ci.degreeInformation?.reportArray || []).find(r => r.code === code)?.value || null;
}