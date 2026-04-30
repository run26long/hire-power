// Groups consecutive experience entries at the same company.
// Two entries are considered "same company" if their company names match
// after lowercasing and trimming. Non-consecutive stints stay separate.
//
// Returns an array of groups. Each group has:
//   - company: the company name (from the first entry in the group)
//   - location: the location (from the first entry — see note below)
//   - startDate / endDate / current: spanning all roles in the group
//   - roles: array of the original entries, ordered most-recent-first
//
// Note on location: per Jessica's call, we group across location changes
// (promotion + relocation = still one continuous stint). The header shows
// the most recent role's location. Each role keeps its own location too,
// in case it differs.
//
// Single-role "groups" are valid — most jobs will be groups of one.

export function groupExperience(experience) {
  if (!Array.isArray(experience) || experience.length === 0) return [];

  const normalize = (str) => (str || '').trim().toLowerCase();

  const groups = [];
  let currentGroup = null;

  for (let i = 0; i < experience.length; i++) {
    const entry = experience[i];
    const companyKey = normalize(entry.company);
    const entryWithIndex = { ...entry, _originalIndex: i };

    if (currentGroup && normalize(currentGroup.company) === companyKey && companyKey !== '') {
      // Same company as previous — add to current group.
      currentGroup.roles.push(entryWithIndex);
    } else {
      // New group.
      currentGroup = {
        company: entry.company || '',
        roles: [entryWithIndex],
      };
      groups.push(currentGroup);
    }
  }

  // For each group, compute the spanning date range and pick a location.
  // Roles within a group stay in their original order (most-recent-first,
  // matching how the resume reads top-to-bottom).
  for (const group of groups) {
    const firstRole = group.roles[0];   // most recent
    const lastRole = group.roles[group.roles.length - 1]; // oldest

    group.location = firstRole.location || '';
    group.startDate = lastRole.startDate || '';
    group.endDate = firstRole.endDate || '';
    group.current = !!firstRole.current;
  }

  return groups;
}