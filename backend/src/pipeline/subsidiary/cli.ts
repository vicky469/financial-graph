import type { SubsidiaryFallbackPolicy } from "./types";
import {
  getCliArg,
  getCliIntArg,
  getCliListArg,
  hasCliFlag,
  parseCliQuarters,
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
  quarters?: number[];
  limit?: number;
  sp500Only: boolean;
  excludeSp500: boolean;
  dryRun: boolean;
  sinks: string[];
  fallbackPolicy: SubsidiaryFallbackPolicy;
  accessions: string[];
};

const VALUE_ARG_PREFIXES = [
  "--year=",
  "--quarter=",
  "--limit=",
  "--sink=",
  "--fallback=",
  "--accessions=",
] as const;

const BOOLEAN_ARGS = new Set(["--sp500", "--exclude-sp500", "--dry-run"]);

function validateArgs(args: string[]): void {
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      throw new Error(
        `Unexpected positional argument "${arg}". Use --name=value format.`,
      );
    }

    if (BOOLEAN_ARGS.has(arg)) continue;

    const matchingPrefix = VALUE_ARG_PREFIXES.find((prefix) =>
      arg.startsWith(prefix),
    );

    if (!matchingPrefix) {
      throw new Error(
        `Unknown argument "${arg}". Allowed args: --year=, --quarter=, --limit=, --sink=, --fallback=, --accessions=, --sp500, --exclude-sp500, --dry-run`,
      );
    }

    if (arg.length <= matchingPrefix.length) {
      throw new Error(`Missing value for argument "${matchingPrefix}"`);
    }
  }
}

function normalizeSinks(sinks: string[]): string[] {
  const normalized = sinks.map((sink) => sink.trim().toLowerCase()).filter(Boolean);
  const aliases = new Set(["all", "both"]);
  const allowed = new Set(["db", "csv"]);

  const invalid = normalized.filter(
    (sink) => !aliases.has(sink) && !allowed.has(sink),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Invalid sink value(s): ${invalid.join(", ")}. Use db, csv, all, or both.`,
    );
  }

  if (normalized.some((sink) => aliases.has(sink))) {
    return ["db", "csv"];
  }

  return Array.from(new Set(normalized));
}

export function parsePipelineArgs(
  args: string[] = process.argv.slice(2),
): SubsidiaryPipelineCliArgs {
  validateArgs(args);
  const { sp500Only, excludeSp500 } = resolveSp500Flags(args);
  const fallbackPolicy = parseFallbackPolicy(getCliArg(args, "fallback"));
  const accessions = getCliListArg(args, "accessions");

  console.log(`DEBUG: Parsed accessions from CLI:`, accessions);

  return {
    year: getCliIntArg(args, "year"),
    quarters: parseCliQuarters(getCliArg(args, "quarter")),
    limit: getCliIntArg(args, "limit"),
    sp500Only,
    excludeSp500,
    dryRun: hasCliFlag(args, "dry-run"),
    sinks: normalizeSinks(getCliListArg(args, "sink")),
    fallbackPolicy: fallbackPolicy ?? "llm",
    accessions,
  };
}
