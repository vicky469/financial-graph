/**
 * Debug script to examine empty filings that have subsidiary tables but no data
 */

import { readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { detectDocumentStructure } from './src/parser/subsidiary/structure-detection';
import { DEFAULT_CONFIG } from './src/parser/subsidiary/types-refactored';
import { load } from 'cheerio';

async function debugEmptyFiling() {
  // Get file path from command line arguments
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error('Usage: bun debug-empty-filing.ts <path-to-filing>');
    process.exit(1);
  }
  
  try {
    console.log(`\n=== Debugging filing ${filePath} ===`);
    
    // Read and decompress the gzipped file
    let html: string;
    if (filePath.endsWith('.gz')) {
      const chunks: Buffer[] = [];
      const readStream = createReadStream(filePath);
      const gunzip = createGunzip();
      
      await pipeline(
        readStream,
        gunzip,
        async function* (source) {
          for await (const chunk of source) {
            chunks.push(chunk);
          }
        }
      );
      
      html = Buffer.concat(chunks).toString('utf-8');
    } else {
      html = await readFile(filePath, 'utf-8');
    }
    
    console.log(`HTML length: ${html.length} characters`);
    
    // Run structure detection
    const structure = detectDocumentStructure(html, DEFAULT_CONFIG);
    
    console.log(`\nStructure Detection Results:`);
    console.log(`- Classification: ${structure.classification}`);
    console.log(`- Total tables: ${structure.totalTableCount}`);
    console.log(`- Subsidiary tables: ${structure.tables.length}`);
    
    // Examine the table in detail
    if (structure.tables.length > 0) {
      const table = structure.tables[0];
      console.log(`\n=== Table Analysis ===`);
      console.log(`- Rows: ${table.rowCount}`);
      console.log(`- Columns: ${table.columnCount}`);
      console.log(`- Headers detected: ${table.headers ? table.headers.join(', ') : 'NONE'}`);
      console.log(`- Is continuation: ${table.isContinuation}`);
      
      // Load HTML with cheerio to examine the table structure
      const $ = load(html);
      const tables = $('table');
      
      if (tables.length > 0) {
        const firstTable = $(tables[0]);
        const rows = firstTable.find('tr');
        
        console.log(`\n=== Raw Table Structure ===`);
        console.log(`- Total <tr> elements: ${rows.length}`);
        
        // Show first 10 rows
        console.log(`\nFirst 10 rows:`);
        rows.slice(0, 10).each((i, row) => {
          const $row = $(row);
          const cells = $row.find('td, th');
          const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
          console.log(`  Row ${i}: [${cellTexts.join(' | ')}]`);
        });
        
        // Look for potential header patterns
        console.log(`\n=== Header Detection Analysis ===`);
        rows.slice(0, 5).each((i, row) => {
          const $row = $(row);
          const cells = $row.find('td, th');
          const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
          const hasSubsidiaryKeywords = cellTexts.some(text => 
            text.toLowerCase().includes('subsidiary') || 
            text.toLowerCase().includes('organization') ||
            text.toLowerCase().includes('jurisdiction') ||
            text.toLowerCase().includes('company') ||
            text.toLowerCase().includes('name')
          );
          
          console.log(`  Row ${i} (${cells.length} cells): ${hasSubsidiaryKeywords ? '✓ HAS KEYWORDS' : '✗ no keywords'} - [${cellTexts.join(' | ')}]`);
        });
      }
    }
    
  } catch (error) {
    console.error(`Error debugging filing: ${error}`);
  }
}

debugEmptyFiling().catch(console.error);