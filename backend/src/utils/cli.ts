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
