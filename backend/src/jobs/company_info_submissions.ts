// Job: Hydrate company and company_info records using SEC submissions JSON files.
// Steps:
//   0) Locate submissions directory (defaults to ~/Downloads/submissions or SEC_SUBMISSIONS_DIR).
//      - Require at least one CIK*.json file; otherwise instruct user to download the SEC bulk archive.
//   1) Fetch all PUBLIC companies from the DB.
//   2) For each company, match its CIK to CIK##########.json, extract key fields, and upsert
//      company + company_info without clobbering unrelated fields.

import fs from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../utils/logger";
import { db } from "../db/client";
import { upsertCompanyInfo } from "../db/repo/companies";
import { type Company, type CompanyIdentity } from "@financial-graph/shared";
import { WORKLOAD_PRESETS } from "../utils/workload-config";
import { runWorkerPool } from "../utils/worker-pool";
import { SEC_USER_AGENT } from "../config/config";
import { downloadAndUnzip } from "../utils/download";
import os from "node:os";

const logger = createLogger("jobs/company_info_submissions");

const SEC_SUBMISSIONS_URL =
  "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip";

const SUBMISSIONS_DIR =
  process.env.SEC_SUBMISSIONS_DIR ||
  path.join(os.tmpdir(), "financial-graph-submissions");

type SubmissionJSON = {
  cik?: string;
  entityType?: string;
  sic?: string;
  sicDescription?: string;
  ownerOrg?: string;
  ein?: string;
  lei?: string;
  website?: string;
  investorWebsite?: string;
  category?: string;
  fiscalYearEnd?: string;
  stateOfIncorporation?: string;
  stateOfIncorporationDescription?: string;
  addresses?: unknown;
  phone?: string;
  formerNames?: unknown;
  flags?: unknown;
};

type CompanyRow = Pick<Company, "id" | "identity">;

async function loadPublicCompanies(): Promise<CompanyRow[]> {
  const res = await db.query({
    company: {
      $: {
        where: { type: 1 }, // 1 = PUBLIC
        fields: ["id", "identity"],
      },
    },
  });

  const companies = (res.company || []) as CompanyRow[];
  logger.info(`Loaded ${companies.length} public companies from DB`);
  return companies;
}

async function readSubmission(cik: string): Promise<SubmissionJSON | null> {
  const filename = `CIK${cik}.json`;
  const filepath = path.join(SUBMISSIONS_DIR, filename);
  try {
    const raw = await fs.readFile(filepath, "utf-8");
    return JSON.parse(raw) as SubmissionJSON;
  } catch (error) {
    logger.warn("Submission JSON not found for CIK", { cik, filepath });
    return null;
  }
}

function pickIdentity(
  existing: CompanyIdentity | undefined,
  submission: SubmissionJSON,
): CompanyIdentity {
  return {
    ...existing,
    entityType: submission.entityType ?? existing?.entityType,
    sic: submission.sic ?? existing?.sic,
    sicDescription: submission.sicDescription ?? existing?.sicDescription,
    ein: submission.ein ?? existing?.ein,
    lei: submission.lei ?? existing?.lei,
    category: submission.category ?? existing?.category,
    ownerOrg: submission.ownerOrg ?? existing?.ownerOrg,
  };
}

function buildCompanyInfoPayload(sub: SubmissionJSON): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (sub.fiscalYearEnd) payload.fiscal_year_end = sub.fiscalYearEnd;
  if (sub.addresses) payload.addresses = sub.addresses;
  if (sub.phone) payload.phone = sub.phone;
  if (sub.formerNames) payload.former_names = sub.formerNames;
  const additional: Record<string, unknown> = {};
  if (sub.website) additional.website = sub.website;
  if (sub.investorWebsite) additional.investorWebsite = sub.investorWebsite;
  if (sub.flags) additional.flags = sub.flags;
  if (Object.keys(additional).length > 0) payload.additional_info = additional;
  return payload;
}

async function processCompany(company: CompanyRow) {
  const cik = company.identity?.primaryCIK;
  if (!cik) {
    logger.warn("Skipping company without CIK", {
      id: company.id,
    });
    return;
  }
  // Normalize CIK for file lookup; does not write back to DB
  const paddedCik = cik.padStart(10, "0");

  const submission = await readSubmission(paddedCik);
  if (!submission) {
    logger.warn("Skipping company: submission JSON missing", {
      companyId: company.id,
      cik: paddedCik,
    });
    return;
  }

  const identity = pickIdentity(company.identity, submission);

  // Partial update: only include fields present in the submission
  const companyPatch: Record<string, unknown> = {
    identity,
    updated_at: new Date().toISOString(),
  };

  if (submission.stateOfIncorporationDescription)
    companyPatch.jurisdiction_raw = submission.stateOfIncorporationDescription;

  await db.transact([db.tx.company[company.id].update(companyPatch)]);

  const infoPayload = buildCompanyInfoPayload(submission);
  if (Object.keys(infoPayload).length > 0) {
    await upsertCompanyInfo(company.id, infoPayload);
  }
}

async function cleanupArtifacts(zipPath: string | undefined) {
  // Only clean up when using the default /tmp location; respect custom SEC_SUBMISSIONS_DIR
  const usingDefaultTmp = !process.env.SEC_SUBMISSIONS_DIR;
  if (!usingDefaultTmp) return;

  try {
    await fs.rm(SUBMISSIONS_DIR, { recursive: true, force: true });
    logger.info("Cleaned submissions directory", { dir: SUBMISSIONS_DIR });
  } catch (err) {
    logger.warn("Failed to clean submissions directory", {
      dir: SUBMISSIONS_DIR,
      error: String(err),
    });
  }

  if (zipPath) {
    try {
      await fs.rm(zipPath, { force: true });
      logger.info("Removed downloaded zip", { zipPath });
    } catch (err) {
      logger.warn("Failed to remove downloaded zip", {
        zipPath,
        error: String(err),
      });
    }
  }
}

export async function main() {
  try {
    const { zipPath } = await (async () => {
      const res = await downloadAndUnzip({
        url: SEC_SUBMISSIONS_URL,
        destDir: SUBMISSIONS_DIR,
        headers: { "User-Agent": SEC_USER_AGENT },
      });
      const entries = await fs.readdir(SUBMISSIONS_DIR);
      const hasJson = entries.some((f) => /^CIK\d+\.json$/i.test(f));
      if (!hasJson) {
        throw new Error(
          `Downloaded ${res.skipped ? "found existing" : "fresh"} submissions at ${SUBMISSIONS_DIR} (zip: ${res.zipPath}), but no CIK*.json files were found. Please unzip submissions.zip in that directory.`,
        );
      }
      logger.info("Submissions ready", {
        dir: SUBMISSIONS_DIR,
        files: entries.length,
        skippedDownload: res.skipped,
        zipPath: res.zipPath,
      });
      return res;
    })();

    const companies = await loadPublicCompanies();

    const workload = WORKLOAD_PRESETS.fastIO(companies.length);
    logger.info("Starting company_info ingestion from submissions", {
      companies: companies.length,
      submissionsDir: SUBMISSIONS_DIR,
      concurrency: workload.concurrency,
    });

    const pool = await runWorkerPool<CompanyRow, void>({
      tasks: companies,
      concurrency: workload.concurrency,
      worker: processCompany,
      onProgress: (stats) => {
        if (stats.completed % 200 === 0 || stats.completed === stats.total) {
          logger.info(
            `Progress completed=${stats.completed} total=${stats.total} remaining=${stats.remaining}`,
          );
        }
      },
      progressInterval: 200,
    });

    if (pool.errors.length > 0) {
      logger.error("Completed with errors", { errors: pool.errors.length });
      process.exitCode = 1;
    } else {
      logger.info("Company info ingestion complete");
      await cleanupArtifacts(zipPath);
    }
  } catch (error) {
    const err = error as Error;
    logger.error("Job failed", { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
