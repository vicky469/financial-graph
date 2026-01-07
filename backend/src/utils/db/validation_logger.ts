import fs from "fs";
import path from "path";

// Function to log validation errors to a file
export function logValidationError(schema: string, error: any, data: any) {
  const logDir = path.resolve(__dirname, "../../logs");
  const logFile = path.join(logDir, "validation_failures.jsonl");

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    schema,
    error: error instanceof Error ? error.message : error,
    validation_details: error.errors || null, // Zod errors
    data, // The data that failed validation
  };

  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
    console.error(`[ValidationLogger] Logged failure to ${logFile}`);
  } catch (fsError) {
    console.error(
      "[ValidationLogger] Failed to write validation log:",
      fsError
    );
  }
}
