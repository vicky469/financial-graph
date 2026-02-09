import type { SubsidiaryFallbackPolicy } from "./types";
import {
  getCliArg,
  getCliIntArg,
  getCliListArg,
  hasCliFlag,
} from "../../utils/cli";

function parseFallbackPolicy(
  value?: string,
): SubsidiaryFallbackPolicy | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "llm" || normalized === "none") {
    return normalized;
  }
  throw new Error(`Invalid fallback policy "${value}". Use llm or none.`);
}

export function resolveSp500Flags(args: string[]): {
  sp500Only: boolean;
  excludeSp500: boolean;
} {
  const sp500OnlyFlag = hasCliFlag(args, "sp500");
  const excludeSp500Flag = hasCliFlag(args, "exclude-sp500");

  return {
    sp500Only: sp500OnlyFlag && !excludeSp500Flag,
    excludeSp500: excludeSp500Flag,
  };
}

export type SubsidiaryPipelineCliArgs = {
  year?: number;
  limit?: number;
  sp500Only: boolean;
  excludeSp500: boolean;
  dryRun: boolean;
  sinks: string[];
  fallbackPolicy: SubsidiaryFallbackPolicy;
};

export function parsePipelineArgs(
  args: string[] = process.argv.slice(2),
): SubsidiaryPipelineCliArgs {
  const { sp500Only, excludeSp500 } = resolveSp500Flags(args);
  const fallbackPolicy = parseFallbackPolicy(getCliArg(args, "fallback"));

  return {
    year: getCliIntArg(args, "year"),
    limit: getCliIntArg(args, "limit"),
    sp500Only,
    excludeSp500,
    dryRun: hasCliFlag(args, "dry-run"),
    sinks: getCliListArg(args, "sink"),
    fallbackPolicy: fallbackPolicy ?? "llm",
  };
}
