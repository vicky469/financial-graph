/**
 * Custom errors for subsidiary parsing
 *
 * These errors indicate bugs in the parser that need immediate fixing.
 * They should NOT be caught generically - let them bubble up and fail loudly.
 */

/**
 * Base class for parser errors
 */
export class ParserError extends Error {
  constructor(message: string, accessionNumber?: string) {
    const prefix = accessionNumber ? `[${accessionNumber}] ` : "";
    super(`${prefix}${message}`);
    this.name = "ParserError";
  }
}

/**
 * Thrown when a required column (jurisdiction) is not found
 * This indicates a bug in column detection logic
 */
export class MissingColumnError extends ParserError {
  constructor(columnName: string, accessionNumber?: string) {
    super(`Required column '${columnName}' not found}`, accessionNumber);
    this.name = "MissingColumnError";
  }
}

/**
 * Thrown when table structure is invalid
 */
export class InvalidTableError extends ParserError {
  constructor(message: string, accessionNumber?: string) {
    super(message, accessionNumber);
    this.name = "InvalidTableError";
  }
}

/**
 * Thrown when a required field value is missing for database operations
 * Format: "value for field {fieldName} is required. Context: {context}"
 */
export class MissingDBValueError extends ParserError {
  public readonly fieldName: string;
  public context?: string;

  constructor(fieldName: string, context?: string) {
    const contextStr = context ? ` Context: ${context}` : "";
    super(`value for field ${fieldName} is required.${contextStr}`);
    this.name = "MissingDBValueError";
    this.fieldName = fieldName;
    this.context = context;
  }
}
