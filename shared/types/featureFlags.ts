export const featureFlagKeys = ["workspace"] as const;

export type FeatureFlag = (typeof featureFlagKeys)[number];

export type FeatureFlags = Record<FeatureFlag, boolean>;
