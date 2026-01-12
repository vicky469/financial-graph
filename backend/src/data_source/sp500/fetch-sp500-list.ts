/**
 * Fetch S&P 500 Company List from Wikipedia
 * 
 * This script fetches the current S&P 500 constituent list from Wikipedia
 * and saves it as a JSON file with tickers and CIKs.
 * 
 * Source: https://en.wikipedia.org/wiki/List_of_S%26P_500_companies
 * 
 * Run: bun src/data_source/sp500/fetch-sp500-list.ts
 */

import fs from "fs/promises";
import path from "path";

const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const OUTPUT_DIR = path.join(__dirname, "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "sp500_companies.json");

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
  console.log("Fetching S&P 500 list from Wikipedia...");
  
  const response = await fetch(WIKIPEDIA_URL);
  const html = await response.text();

  // Parse the HTML table
  // The table has id="constituents"
  const tableMatch = html.match(/<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/i);
  
  if (!tableMatch) {
    throw new Error("Could not find S&P 500 constituents table in Wikipedia page");
  }

  const tableHtml = tableMatch[1];
  
  // Extract rows (skip header)
  const rowMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  const companies: SP500Company[] = [];
  
  let isFirstRow = true;
  for (const rowMatch of rowMatches) {
    if (isFirstRow) {
      isFirstRow = false;
      continue; // Skip header row
    }

    const row = rowMatch[1];
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi));
    
    if (cells.length < 8) continue;

    // Extract text from cells, removing HTML tags
    const getText = (cell: RegExpMatchArray) => {
      return cell[1]
        .replace(/<[^>]+>/g, "") // Remove HTML tags
        .replace(/&amp;/g, "&")
        .replace(/&#160;/g, " ")
        .trim();
    };

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
      cik: cik.padStart(10, "0"), // Pad CIK to 10 digits
      sector,
      subIndustry,
      headquarters,
      dateAdded,
      founded,
    });
  }

  return companies;
}

async function main() {
  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Fetch S&P 500 list
    const companies = await fetchSP500List();

    console.log(`\nFetched ${companies.length} S&P 500 companies`);

    // Show some examples
    console.log("\nExamples:");
    console.log("=".repeat(80));
    companies.slice(0, 5).forEach((company, idx) => {
      console.log(`${idx + 1}. ${company.symbol} - ${company.name}`);
      console.log(`   CIK: ${company.cik}, Sector: ${company.sector}`);
    });

    // Save to JSON
    await fs.writeFile(
      OUTPUT_FILE,
      JSON.stringify(companies, null, 2),
      "utf-8"
    );

    console.log(`\n✅ Saved S&P 500 list to: ${OUTPUT_FILE}`);

    // Statistics
    const sectors = new Map<string, number>();
    companies.forEach((company) => {
      sectors.set(company.sector, (sectors.get(company.sector) || 0) + 1);
    });

    console.log("\nSector Breakdown:");
    console.log("=".repeat(80));
    Array.from(sectors.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([sector, count]) => {
        console.log(`${sector}: ${count} companies`);
      });

  } catch (error) {
    console.error("Error fetching S&P 500 list:", error);
    process.exit(1);
  }
}

main();
