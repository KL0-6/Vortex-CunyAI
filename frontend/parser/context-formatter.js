export function formatContext(d) {
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
    L.push("─── CURRENTLY ENROLLED ──────────────");
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
        L.push(`       → Needs one of: ${cat.neededCourses.slice(0, 3).join(" | ")}`);
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
}