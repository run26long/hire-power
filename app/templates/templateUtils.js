// ─── Shared utilities for all Hire Power resume templates ───────────────────

export function hexToRgba(hex, alpha) {
  const h = (hex || '#5b4fcf').replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function formatDate(dateStr, format = 'short') {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const year = parts[0];
  const month = parts[1];
  if (!month) return year;
  if (format === 'year') return year;
  if (format === 'full') {
    const months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  }
  // default: short M/YYYY (no leading zero)
  return `${parseInt(month, 10)}/${year}`;
}

export function formatDateRange(startDate, endDate, current, format = 'short') {
  const start = formatDate(startDate, format);
  const end = current ? 'Present' : formatDate(endDate, format);
  if (!start && !end) return '';
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

// Renders skills from either skillsCategories (new) or skills (legacy array)
export function getSkillsDisplay(resumeData) {
  if (resumeData.skillsCategories && Object.keys(resumeData.skillsCategories).length > 0) {
    return resumeData.skillsCategories;
  }
  if (resumeData.skills && resumeData.skills.length > 0) {
    return { 'Skills': resumeData.skills };
  }
  return {};
}
