import { getDefaultConcurrency } from "../../utils/concurrency";
import { getLLMWorkerPool } from "../../utils/llm-worker-pool";
import { SubsidiariesDBSink } from "../../jobs/parse_subsidiaries/sinks/db";
import { SubsidiariesExcelSink } from "../../jobs/parse_subsidiaries/sinks/excel";
import { createLogger } from "../../utils/logger";
import type {
  SubsidiaryPipelineOptions,
  SubsidiarySinkName,
  SubsidiarySink,
  PipelineContext,
} from "./types";

const logger = createLogger("pipeline/subsidiary/init");

function buildSinks(names: SubsidiarySinkName[] = []): SubsidiarySink[] {
  const sinks: SubsidiarySink[] = [];

  for (const name of names) {
    if (name === "db") {
      sinks.push(new SubsidiariesDBSink());
    } else if (name === "excel") {
      sinks.push(new SubsidiariesExcelSink());
    } else {
      logger.warn(`Unknown sink "${name}" requested; skipping.`);
    }
  }

  return sinks;
}

export function initializePipeline(
  options: SubsidiaryPipelineOptions,
): PipelineContext {
  const fallbackPolicy = options.fallbackPolicy ?? "llm";
  const defaults = getDefaultConcurrency(options.limit);
  const jobConcurrency = defaults.job;
  const llmWorkers = defaults.llmWorkers;

  if (fallbackPolicy === "llm") {
    getLLMWorkerPool({
      maxWorkers: llmWorkers,
    });
  }

  const sinks = buildSinks(options.sinks ?? []);
  const dryRun = options.dryRun || sinks.length === 0;

  logger.info("\n" + "=".repeat(60));
  logger.info("SUBSIDIARIES PARSE JOB");
  logger.info("=".repeat(60));
  logger.info("Args: " + JSON.stringify({ ...options }, null, 2));

  logger.info(`⚙️  Concurrency: ${jobConcurrency} filings`);
  if (fallbackPolicy === "llm") {
    logger.info(`🤖 LLM Pool: ${llmWorkers} workers`);
  } else {
    logger.info("🤖 LLM Pool: disabled");
  }
  logger.info(`🧠 LLM Fallback: ${fallbackPolicy}`);

  return {
    fallbackPolicy,
    jobConcurrency,
    llmWorkers,
    sinks,
    dryRun,
  };
}
