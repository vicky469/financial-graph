import fs from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../utils/logger";
import { db } from "../db/client";
import type { Company } from "@financial-graph/shared";
import { CompanyType } from "@financial-graph/shared";
import { INDEX_DIR } from "../config/config";

const logger = createLogger("jobs/sp500");

const WIKIPEDIA_URL =
  "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const OUTPUT_FILE = path.join(INDEX_DIR, "sp500_companies.json");

interface SP500Company {
  symbol: string;
  name: string;
  cik: string;
  sector: string;
  subIndustry: string;
  headquarters: string;
  dateAdded: string;
  founded: string;
}

async function fetchSP500List(): Promise<SP500Company[]> {
  logger.info("Fetching S&P 500 list from Wikipedia...");

  const response = await fetch(WIKIPEDIA_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch S&P 500 page: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();

  const tableMatch = html.match(
    /<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/i,
  );

  if (!tableMatch) {
    throw new Error(
      "Could not find S&P 500 constituents table in Wikipedia page",
    );
  }

  const tableHtml = tableMatch[1];
  const rowMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  const companies: SP500Company[] = [];

  let isFirstRow = true;
  for (const rowMatch of rowMatches) {
    if (isFirstRow) {
      isFirstRow = false;
      continue;
    }

    const row = rowMatch[1];
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi));

    if (cells.length < 8) continue;

    const getText = (cell: RegExpMatchArray) =>
      cell[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#160;/g, " ")
        .trim();

    const symbol = getText(cells[0]);
    const name = getText(cells[1]);
    const sector = getText(cells[2]);
    const subIndustry = getText(cells[3]);
    const headquarters = getText(cells[4]);
    const dateAdded = getText(cells[5]);
    const cik = getText(cells[6]);
    const founded = getText(cells[7]);

    companies.push({
      symbol,
      name,
      cik: cik.padStart(10, "0"),
      sector,
      subIndustry,
      headquarters,
      dateAdded,
      founded,
    });
  }

  logger.info(`Fetched ${companies.length} S&P 500 companies`, {
    count: companies.length,
  });

  return companies;
}

export async function saveJSON(companies: SP500Company[]) {
  await fs.mkdir(INDEX_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(companies, null, 2), "utf-8");
  logger.info("Saved S&P 500 list", { path: OUTPUT_FILE });
}

export async function markSP500InDB(sp500Companies: SP500Company[]) {
  logger.info("Marking S&P 500 companies in DB...");

  const result = await db.query({
    company: {
      $: { where: { type: CompanyType.PUBLIC } },
    },
  });
  const companies = (result.company || []) as Company[];
  logger.info("Fetched public companies", { count: companies.length });

  const matched: Array<{ company: Company; sp500: SP500Company }> = [];
  const unmatched: SP500Company[] = [];

  for (const sp of sp500Companies) {
    let found = false;

    for (const company of companies) {
      const primaryCIK = company.identity?.primaryCIK;
      const ciks = company.identity?.ciks;
      if (primaryCIK && primaryCIK === sp.cik) {
        matched.push({ company, sp500: sp });
        found = true;
        break;
      }
      if (!found && ciks) {
        const cikList = ciks.split(",").map((c: string) => c.trim());
        if (cikList.includes(sp.cik)) {
          matched.push({ company, sp500: sp });
          found = true;
          break;
        }
      }
    }

    if (!found) {
      for (const company of companies) {
        const tickers =
          company.identity?.tickers
            ?.split(",")
            .map((t: string) => t.trim().toUpperCase()) || [];
        if (tickers.includes(sp.symbol.toUpperCase())) {
          matched.push({ company, sp500: sp });
          found = true;
          break;
        }
      }
    }

    if (!found) {
      unmatched.push(sp);
    }
  }

  logger.info("Match results", {
    matched: matched.length,
    unmatched: unmatched.length,
  });

  if (unmatched.length > 0) {
    logger.warn("Unmatched S&P 500 examples", {
      samples: unmatched.slice(0, 5).map((c) => c.symbol),
    });
  }

  const BATCH_SIZE = 100;
  let updated = 0;

  for (let i = 0; i < matched.length; i += BATCH_SIZE) {
    const batch = matched.slice(i, i + BATCH_SIZE);
    const transactions = batch.map(({ company, sp500 }) =>
      db.tx.company[company.id].update({
        identity: {
          ...company.identity,
          sp500: true,
          founded: sp500.founded || company.identity?.founded,
        },
        updated_at: new Date().toISOString(),
      }),
    );

    await db.transact(transactions);
    updated += batch.length;
    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= matched.length) {
      logger.info("Progress marking S&P 500", {
        updated,
        total: matched.length,
      });
    }
  }

  const sp500Ciks = new Set(sp500Companies.map((c) => c.cik));
  const sp500Tickers = new Set(
    sp500Companies.map((c) => c.symbol.toUpperCase()),
  );

  const toUnmark = companies.filter((company) => {
    if (!company.identity?.sp500) return false;

    const primaryCIK = company.identity?.primaryCIK;
    const ciks = company.identity?.ciks;
    const tickers =
      company.identity?.tickers
        ?.split(",")
        .map((t: string) => t.trim().toUpperCase()) || [];

    let hasSP500Cik = primaryCIK ? sp500Ciks.has(primaryCIK) : false;
    if (!hasSP500Cik && ciks) {
      const cikList = ciks.split(",").map((c: string) => c.trim());
      hasSP500Cik = cikList.some((cik: string) => sp500Ciks.has(cik));
    }

    const hasSP500Ticker = tickers.some((t) => sp500Tickers.has(t));

    return !hasSP500Cik && !hasSP500Ticker;
  });

  if (toUnmark.length > 0) {
    logger.info("Unmarking companies no longer in SP500", {
      count: toUnmark.length,
    });
    for (let i = 0; i < toUnmark.length; i += BATCH_SIZE) {
      const batch = toUnmark.slice(i, i + BATCH_SIZE);
      const transactions = batch.map((company) =>
        db.tx.company[company.id].update({
          identity: {
            ...company.identity,
            sp500: false,
          },
          updated_at: new Date().toISOString(),
        }),
      );
      await db.transact(transactions);
    }
  }

  const sectors = new Map<string, number>();
  matched.forEach(({ sp500 }) => {
    sectors.set(sp500.sector, (sectors.get(sp500.sector) || 0) + 1);
  });

  logger.info("Sector breakdown (matched)", {
    sectors: Array.from(sectors.entries()).sort((a, b) => b[1] - a[1]),
  });

  logger.info("✅ S&P 500 companies marked successfully", {
    listCount: sp500Companies.length,
    matched: matched.length,
    unmatched: unmatched.length,
    updated,
    unmarked: toUnmark.length,
  });
}

async function main() {
  try {
    const companies = await fetchSP500List();
    await saveJSON(companies);
    await markSP500InDB(companies);
  } catch (error) {
    const err = error as Error;
    logger.error("Error running sp500 job", {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
