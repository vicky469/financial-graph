export const SUBSIDIARY_EXHIBITS = ["EX-21", "EX-8"] as const;

export type SubsidiaryExhibit = (typeof SUBSIDIARY_EXHIBITS)[number];
