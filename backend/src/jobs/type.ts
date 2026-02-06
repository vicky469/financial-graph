// Shared job types for SEC registrant index derived jobs.

export type AcceptableYear = number;

export interface RegistrantEntry {
  registrantName: string;
  cik: string;
  accessionNumber: string;
  accessionNumberNoDashes: string;
  formType: string;
  filingDate: string;
  fileName: string;
  filePath: string;
}

export interface RegistrantGrouped {
  cik: string;
  name: string;
  filings: RegistrantEntry[];
  formTypes: string[];
  aliases: string[];
}

export interface RegistrantIndexFile {
  data: RegistrantGrouped[];
  meta?: unknown;
}
