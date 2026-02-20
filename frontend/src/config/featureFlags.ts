import type { FeatureFlag, FeatureFlags } from "financial-graph-shared";

const workspaceEnabled = import.meta.env.VITE_FEATURE_WORKSPACE === "true";
const previewBannerEnabled = import.meta.env.VITE_FEATURE_PREVIEW_BANNER === "true";
const structureNestingEnabled = import.meta.env.VITE_FEATURE_STRUCTURE_NESTING === "true";

export const featureFlags: FeatureFlags = {
  workspace: workspaceEnabled,
  previewBanner: previewBannerEnabled,
  structureNesting: structureNestingEnabled,
};

export const hasFeature = (flag: FeatureFlag): boolean => featureFlags[flag] === true;
