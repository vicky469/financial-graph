// Small CLI helpers shared across jobs/scripts.

/**
 * Read a CLI arg in --name=value form.
 * Examples: "--limit=10", "--sink=db,excel"
 */
export function getCliArg(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = args.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

/**
 * Check for a boolean CLI flag in --name form.
 */
export function hasCliFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

/**
 * Read a CLI arg as integer (returns undefined if missing/invalid).
 */
export function getCliIntArg(args: string[], name: string): number | undefined {
  const value = getCliArg(args, name);
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Read a CLI arg as a list of strings (comma-separated).
 */
export function getCliListArg(
  args: string[],
  name: string,
  delimiter = ",",
): string[] {
  const value = getCliArg(args, name);
  if (!value) return [];
  return value
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Parse a years CLI arg or argv list. Supports "bun run script -2025"
 * and supports comma-separated values (e.g., "2024,2025").
 */
export function parseCliYears(arg?: string | string[]): number[] {
  let yearsArg: string | undefined;
  if (Array.isArray(arg)) {
    yearsArg = arg.find(
      (item) => item.startsWith("-") && item.length > 1 && !item.startsWith("--"),
    );
  } else {
    yearsArg = arg;
  }

  if (!yearsArg) {
    throw new Error("Missing years arg (e.g., -2025 or -2024,2025)");
  }

  const trimmed = yearsArg.startsWith("-") ? yearsArg.slice(1) : yearsArg;
  const years = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => Number(p))
    .filter((n) => Number.isInteger(n) && n > 1900 && n < 3000);
  if (years.length === 0) {
    throw new Error(
      "Invalid years arg. Use comma-separated years, e.g., -2025 or 2024,2025",
    );
  }
  return years;
}

/**
 * Parse quarter tokens from CLI args.
 * Supports: "Q1", "1", "Q1,Q2", "1,2,4"
 * Returns unique quarter numbers in input order.
 */
export function parseCliQuarters(arg?: string): number[] {
  if (!arg) return [];

  const tokens = arg
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return [];

  const parsed = tokens.map((token) => {
    const normalized = token.toUpperCase().replace(/^Q/, "");
    if (!/^[1-4]$/.test(normalized)) {
      throw new Error(
        `Invalid quarter token "${token}". Use Q1-Q4 or 1-4 (e.g., Q1 or Q1,Q3).`,
      );
    }
    return Number(normalized);
  });

  return Array.from(new Set(parsed));
}

/**
 * Parse years and quarters from CLI arguments.
 * Extracts year argument (e.g., "2024" or "2024,2025") and quarter arguments (e.g., "Q1,Q2" or "1,2").
 * Non-flag arguments that aren't years are treated as quarters.
 * 
 * @param args - CLI arguments (typically process.argv.slice(2))
 * @param defaultQuarters - Default quarters to use if none specified (e.g., [1, 2, 3, 4])
 * @returns Object with years and quarters arrays
 * 
 * @example
 * // Parse: bun run script 2024,2025 Q1,Q2 --use-cache
 * const { years, quarters } = parseYearsAndQuarters(process.argv.slice(2), [1, 2, 3, 4]);
 * // years: [2024, 2025], quarters: [1, 2]
 */
export function parseYearsAndQuarters(
  args: string[],
  defaultQuarters: number[] = []
): { years: number[]; quarters: number[] } {
  // Find year argument: non-flag arg matching year pattern
  const yearArg = args.find(
    (arg) => !arg.startsWith("--") && /^-?\d{4}(,\d{4})*$/.test(arg),
  );
  
  const years = parseCliYears(yearArg);
  
  // Collect remaining non-flag arguments as quarter args
  const quarterArg = args
    .filter((arg) => arg !== yearArg && !arg.startsWith("--"))
    .join(",");
  
  const quarters = quarterArg
    ? parseCliQuarters(quarterArg)
    : defaultQuarters;
  
  return { years, quarters };
}
