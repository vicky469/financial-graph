import type { FeatureFlag, FeatureFlags } from "financial-graph-shared";

const workspaceEnabled = import.meta.env.VITE_FEATURE_WORKSPACE === "true";
const previewBannerEnabled = import.meta.env.VITE_FEATURE_PREVIEW_BANNER === "true";

export const featureFlags: FeatureFlags = {
  workspace: workspaceEnabled,
  previewBanner: previewBannerEnabled,
};

export const hasFeature = (flag: FeatureFlag): boolean => featureFlags[flag] === true;
