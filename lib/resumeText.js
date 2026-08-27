// ============================================================================
// RESUME TEXT CONVERSION
// Extracted verbatim from /api/power-analysis/generate so Power Analysis, JMS,
// and mock interview sessions all read the resume the same way. The two older
// routes still carry their own copies; migrating them is a separate change.
// ============================================================================

export function convertResumeToText(data) {
  if (!data) return '';
  let text = '';

  const fullName = data.contact?.fullName || data.fullName || '';
  const email = data.contact?.email || data.email || '';
  const phone = data.contact?.phone || data.phone || '';
  const location = data.contact?.location || data.location || '';
  const linkedin = data.contact?.linkedin || data.linkedin || '';
  const portfolio = data.contact?.portfolio || data.portfolio || '';

  if (fullName) {
    text += `${fullName}\n`;
    const contactParts = [email, phone, location, linkedin, portfolio].filter(Boolean);
    if (contactParts.length > 0) text += contactParts.join(' | ') + '\n\n';
  }

  if (data.summary && !data.hideSummary) {
    text += `PROFESSIONAL SUMMARY\n${data.summary}\n\n`;
  }

  if (data.experience?.length) {
    text += 'EXPERIENCE\n\n';
    data.experience.forEach(job => {
      text += `${job.title || 'Position'} | ${job.company || 'Company'}\n`;
      const startDate = job.startDate || '';
      const endDate = job.current ? 'Present' : (job.endDate || '');
      if (startDate || endDate) text += `${startDate} - ${endDate}\n`;
      if (job.summary) text += `${job.summary}\n`;
      if (job.bullets?.length) job.bullets.forEach(b => text += `• ${b}\n`);
      text += '\n';
    });
  }

  if (data.education?.length) {
    text += 'EDUCATION\n\n';
    data.education.forEach(edu => {
      text += `${edu.school || 'Institution'}\n`;
      if (edu.degree || edu.field) {
        text += `${[edu.degree, edu.field].filter(Boolean).join(', ')}`;
        if (edu.graduationDate) text += ` | ${edu.graduationDate}`;
        text += '\n';
      }
      if (edu.lines?.length) edu.lines.forEach(l => text += `${l}\n`);
      text += '\n';
    });
  }

  if (data.skillsCategories && Object.keys(data.skillsCategories).length > 0) {
    text += 'SKILLS\n\n';
    Object.entries(data.skillsCategories).forEach(([cat, skills]) => {
      const skillsArray = Array.isArray(skills) ? skills : [skills];
      const isSingle = Object.keys(data.skillsCategories).length === 1 && cat === 'Skills';
      if (!isSingle) text += `${cat}:\n`;
      text += skillsArray.join(', ') + '\n\n';
    });
  } else if (data.skills?.length) {
    text += `SKILLS\n${data.skills.join(', ')}\n\n`;
  }

  if (data.projects?.length) {
    text += 'PROJECTS\n\n';
    data.projects.forEach(p => {
      text += `${p.name || 'Project'}\n`;
      if (p.description) text += `${p.description}\n`;
      text += '\n';
    });
  }

  if (data.certifications?.length) {
    text += 'CERTIFICATIONS\n\n';
    data.certifications.forEach(c => {
      text += `${c.name || 'Certification'}\n`;
      if (c.details) text += `${c.details}\n`;
      text += '\n';
    });
  }

  if (data.volunteer?.length) {
    text += 'VOLUNTEER EXPERIENCE\n\n';
    data.volunteer.forEach(v => {
      text += `${v.organization || 'Organization'}\n`;
      if (v.description) text += `${v.description}\n`;
      text += '\n';
    });
  }

  if (data.languages?.length) {
    text += 'LANGUAGES\n';
    data.languages.forEach(l => text += `${l.language || 'Language'} - ${l.proficiency || 'Professional'}\n`);
    text += '\n';
  }

  return text;
}
