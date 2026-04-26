// Fetches active job cards as the single source of job context.
// Returns linkage info so callers can filter out cards that already
// have the doc type they're trying to create.
//
// Each entry has:
//   - id, title, company, description, displayLabel
//   - has_resume: true if a JS resume is already linked
//   - has_cover_letter: true if a cover letter is already linked

export async function getJobSources(supabase, userId) {
  const { data } = await supabase
    .from('applications')
    .select('id, title, company, description, resume_id, cover_letter_id, updated_at')
    .eq('user_id', userId)
    .not('application_status', 'eq', 'archived')
    .order('updated_at', { ascending: false });

  return (data || [])
    .filter(c => c.title && c.company)
    .map(c => ({
      id: c.id,
      title: c.title,
      company: c.company,
      description: c.description,
      has_resume: !!c.resume_id,
      has_cover_letter: !!c.cover_letter_id,
      displayLabel: `${c.title} at ${c.company}`,
    }));
}