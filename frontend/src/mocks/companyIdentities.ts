import { GICS } from "../types/sec";
import type { CompanyIdentitySnapshot } from "../types/identity";

export const companyIdentityMocks: CompanyIdentitySnapshot[] = [
  {
    nodeId: "node_amzn",
    name: "Amazon.com Inc.",
    cik: "0000789019",
    jurisdiction: "US-WA",
    sector: GICS.CONSUMER_DISCRETIONARY,
    industry: "Internet & Direct Marketing Retail",
    companyGroupId: "uuid_amazon_group",
    parentEntityId: null,
    ownershipPercent: 100,
    lei: "549300VQPQN4JDWZ0E45",
    figi: "BBG000BPH459",
    segments: ["Retail", "Cloud/Tech"],
  },
  {
    nodeId: "node_msft",
    name: "Microsoft Corporation",
    cik: "0000789019",
    jurisdiction: "US-WA",
    sector: GICS.INFORMATION_TECHNOLOGY,
    industry: "Systems Software",
    companyGroupId: "uuid_msft_group",
    parentEntityId: null,
    ownershipPercent: 100,
    lei: "5493001KJTIIGC8Y1R12",
    figi: "BBG000BPH459",
    segments: ["Productivity", "Cloud", "Gaming"],
  },
];
