export const featureFlagKeys = ["workspace", "previewBanner"] as const;

export type FeatureFlag = (typeof featureFlagKeys)[number];

export type FeatureFlags = Record<FeatureFlag, boolean>;
