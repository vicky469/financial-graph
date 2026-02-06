import type { FeatureFlag, FeatureFlags } from "financial-graph-shared";

const workspaceEnabled = import.meta.env.VITE_FEATURE_WORKSPACE === "true";

export const featureFlags: FeatureFlags = {
  workspace: workspaceEnabled,
};

export const hasFeature = (flag: FeatureFlag): boolean => featureFlags[flag] === true;
