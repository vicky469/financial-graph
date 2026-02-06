// Small CLI helpers shared across jobs/scripts.

/**
 * Parse a years CLI arg that may be prefixed with "-" (bun run script -2025)
 * and supports comma-separated values (e.g., "2024,2025").
 */
export function parseCliYears(arg?: string): number[] {
  if (!arg) throw new Error("Missing years arg (e.g., -2025 or -2024,2025)");
  const trimmed = arg.startsWith("-") ? arg.slice(1) : arg;
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
