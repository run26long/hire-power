// ============================================================================
// RESUME TEXT CONVERSION
// Extracted verbatim from /api/power-analysis/generate so Power Analysis, JMS,
// and mock interview sessions all read the resume the same way. The two older
// routes still carry their own copies; migrating them is a separate change.
// ============================================================================

// ---------------------------------------------------------------------------
// The canonical shape of a resume's skills: an ordered array of categories,
// [{ name, skills }], in the order they are meant to be read.
//
// Every caller goes through this rather than reaching for resume_data itself,
// because the table currently holds more than one shape. An array is already
// canonical. An object is the legacy storage, and its key order is not the
// author's: resume_data is jsonb, and Postgres sorts a jsonb object's keys by
// length, so an object row has whatever order its key lengths gave it and never
// had one of its own. A bare `skills` array predates categories altogether and
// becomes one group.
//
// TEMPORARY: every stored row has been backfilled to the array, so the object
// branch is here only for a resume written by something not yet updated. The
// array branch and the legacy `skills` branch are the ones that stay.
// ---------------------------------------------------------------------------
export function normalizeSkillCategories(resumeData) {
  const categories = resumeData?.skillsCategories;

  if (Array.isArray(categories)) {
    return categories
      .map(group => ({
        name: typeof group?.name === 'string' ? group.name.trim() : '',
        skills: Array.isArray(group?.skills) ? group.skills : []
      }))
      .filter(group => group.name && group.skills.length > 0);
  }

  if (categories && typeof categories === 'object') {
    return Object.entries(categories)
      .map(([name, value]) => ({
        name: String(name || '').trim(),
        skills: Array.isArray(value) ? value : [value]
      }))
      .filter(group => group.name && group.skills.length > 0);
  }

  if (Array.isArray(resumeData?.skills) && resumeData.skills.length > 0) {
    return [{ name: 'Skills', skills: resumeData.skills }];
  }

  return [];
}

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

  const skillGroups = normalizeSkillCategories(data);
  if (skillGroups.length > 0) {
    text += 'SKILLS\n\n';
    skillGroups.forEach(({ name, skills }) => {
      const isSingle = skillGroups.length === 1 && name === 'Skills';
      if (!isSingle) text += `${name}:\n`;
      text += skills.join(', ') + '\n\n';
    });
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
