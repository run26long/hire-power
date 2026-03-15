// Feature gating utilities for subscription tiers

export const TIERS = {
  FREE: 'free',
  PRO: 'pro',
  STANDBY: 'standby'
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

const TIER_FEATURES = {
  [TIERS.FREE]: [],
  
  [TIERS.STANDBY]: [
    FEATURES.UNLIMITED_DOWNLOADS,
    FEATURES.PREMIUM_TEMPLATES,
    FEATURES.CAREER_ARCHIVE_EDIT
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
  ]
};

export function hasFeatureAccess(userTier, feature) {
  if (!userTier) return false;
  return TIER_FEATURES[userTier]?.includes(feature) || false;
}

export function canDownloadPDF(userTier) {
  return userTier !== TIERS.FREE;
}

export function getTierDisplayName(tier) {
  const names = {
    [TIERS.FREE]: 'Free',
    [TIERS.PRO]: 'Pro',
    [TIERS.STANDBY]: 'Standby'
  };
  return names[tier] || 'Free';
}

export function getTierBadgeColor(tier) {
  const colors = {
    [TIERS.FREE]: 'bg-gray-100 text-gray-800',
    [TIERS.PRO]: 'bg-purple-100 text-purple-800',
    [TIERS.STANDBY]: 'bg-blue-100 text-blue-800'
  };
  return colors[tier] || 'bg-gray-100 text-gray-800';
}

export function getTierPrice(tier) {
  const prices = {
    [TIERS.FREE]: 0,
    [TIERS.PRO]: 29.99,
    [TIERS.STANDBY]: 4.99
  };
  return prices[tier] || 0;
}