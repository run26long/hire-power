// Feature gating utilities for subscription tiers

export const TIERS = {
  FREE: 'free',
  PRO: 'pro',
  VAULT: 'vault'
};

export const FEATURES = {
  // Resume Features
  RESUME_COACHING: 'resume_coaching',
  RESUME_CUSTOMIZATION: 'resume_customization',
  PREMIUM_TEMPLATES: 'premium_templates',
  
  // Interview Features
  INTERVIEW_COACHING: 'interview_coaching',
  INTERVIEW_PERSONALIZATION: 'interview_personalization',
  
  // Shared Features
  UNLIMITED_DOWNLOADS: 'unlimited_downloads',
  CAREER_ARCHIVE_EDIT: 'career_archive_edit',
  REANALYZE: 'reanalyze'
};

// Define what each tier can access
const TIER_FEATURES = {
  [TIERS.FREE]: [
    // Free: 1 resume, AI analysis, editor, basic templates, unlimited downloads, match score
  ],
  
  [TIERS.VAULT]: [
    FEATURES.UNLIMITED_DOWNLOADS,
    FEATURES.PREMIUM_TEMPLATES,
    FEATURES.CAREER_ARCHIVE_EDIT
    // Can view archive, track achievements, download existing resumes
    // Cannot generate new resumes or practice interviews
  ],
  
  [TIERS.PRO]: [
    FEATURES.RESUME_COACHING,
    FEATURES.RESUME_CUSTOMIZATION,
    FEATURES.INTERVIEW_COACHING,
    FEATURES.INTERVIEW_PERSONALIZATION,
    FEATURES.PREMIUM_TEMPLATES,
    FEATURES.UNLIMITED_DOWNLOADS,
    FEATURES.CAREER_ARCHIVE_EDIT,
    FEATURES.REANALYZE
    // Everything unlocked
  ]
};

/**
 * Check if user has access to a specific feature
 */
export function hasFeatureAccess(userTier, feature) {
  if (!userTier) return false;
  return TIER_FEATURES[userTier]?.includes(feature) || false;
}

/**
 * Check if user can download PDFs
 */
export function canDownloadPDF(userTier) {
  return userTier !== TIERS.FREE;
}

/**
 * Get user-friendly tier name
 */
export function getTierDisplayName(tier) {
  const names = {
    [TIERS.FREE]: 'Free',
    [TIERS.PRO]: 'Pro',
    [TIERS.VAULT]: 'Vault'
  };
  return names[tier] || 'Free';
}

/**
 * Get tier badge color
 */
export function getTierBadgeColor(tier) {
  const colors = {
    [TIERS.FREE]: 'bg-gray-100 text-gray-800',
    [TIERS.PRO]: 'bg-purple-100 text-purple-800',
    [TIERS.VAULT]: 'bg-blue-100 text-blue-800'
  };
  return colors[tier] || 'bg-gray-100 text-gray-800';
}

/**
 * Get tier pricing
 */
export function getTierPrice(tier) {
  const prices = {
    [TIERS.FREE]: 0,
    [TIERS.PRO]: 29.99,
    [TIERS.VAULT]: 4.99
  };
  return prices[tier] || 0;
}