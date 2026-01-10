import { db } from "../client";
import * as IDs from "../ids";
import type * as Types from "../../types";
import {
  BusinessSegmentSchema,
  validate,
} from "../validation";

export async function upsertBusinessSegment(
  segmentData: Partial<Types.BusinessSegment>
): Promise<string> {
  const id = IDs.generateSegmentId(segmentData);
  const company_id = segmentData.company_id!;

  const node: Types.BusinessSegment = {
    id,
    company_id,
    segment_name: segmentData.segment_name!,
    segment_type: segmentData.segment_type!,
    description: segmentData.description!,
    is_reportable: segmentData.is_reportable || false,
    fiscal_year: segmentData.fiscal_year!,
    fiscal_quarter: segmentData.fiscal_quarter || null,
    revenue: segmentData.revenue || null,
    operating_income: segmentData.operating_income || null,
    assets: segmentData.assets || null,
    created_at: segmentData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate the node before inserting
  const validatedNode = validate(BusinessSegmentSchema, node);

  await db.transact([
    db.tx.business_segments[id].update(validatedNode),
  ]);

  return id;
}
