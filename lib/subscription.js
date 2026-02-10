// Feature gating utilities for subscription tiers

export const TIERS = {
  FREE: 'free',
  FULL: 'full',
  MAINTENANCE: 'maintenance'
};

export const FEATURES = {
  COACHING: 'coaching',
  JOB_CUSTOMIZATION: 'job_customization',
  UNLIMITED_DOWNLOADS: 'unlimited_downloads',
  ADVANCED_TEMPLATES: 'advanced_templates',
  ATS_MATCH_SCORE: 'ats_match_score'
};

// Define what each tier can access
const TIER_FEATURES = {
  [TIERS.FREE]: [
    // Free users get basic features only
  ],
  [TIERS.FULL]: [
    FEATURES.COACHING,
    FEATURES.JOB_CUSTOMIZATION,
    FEATURES.UNLIMITED_DOWNLOADS,
    FEATURES.ADVANCED_TEMPLATES,
    FEATURES.ATS_MATCH_SCORE
  ],
  [TIERS.MAINTENANCE]: [
    FEATURES.UNLIMITED_DOWNLOADS,
    FEATURES.ADVANCED_TEMPLATES
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
export function canDownloadPDF(userTier, downloadsRemaining) {
  // Full and maintenance get unlimited
  if (userTier === TIERS.FULL || userTier === TIERS.MAINTENANCE) {
    return true;
  }
  
  // Free tier has limited downloads
  return downloadsRemaining > 0;
}

/**
 * Get user-friendly tier name
 */
export function getTierDisplayName(tier) {
  const names = {
    [TIERS.FREE]: 'Free',
    [TIERS.FULL]: 'Full Access',
    [TIERS.MAINTENANCE]: 'Maintenance Mode'
  };
  return names[tier] || 'Free';
}

/**
 * Get tier badge color
 */
export function getTierBadgeColor(tier) {
  const colors = {
    [TIERS.FREE]: 'bg-gray-100 text-gray-800',
    [TIERS.FULL]: 'bg-purple-100 text-purple-800',
    [TIERS.MAINTENANCE]: 'bg-blue-100 text-blue-800'
  };
  return colors[tier] || 'bg-gray-100 text-gray-800';
}