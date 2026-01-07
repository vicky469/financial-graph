import { db } from "../client";
import * as IDs from "../ids";
import type * as Types from "../../types";
import {
  BusinessSegmentSchema,
  HasSegmentsEdgeSchema,
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

  const edgeId = IDs.generateHasSegmentsEdgeId(company_id, id);
  const edge: Types.HasSegmentsEdge = {
    id: edgeId,
    from_company_id: company_id,
    to_segment_id: id,
    created_at: new Date().toISOString(),
  };

  // Validate the edge before inserting
  const validatedEdge = validate(HasSegmentsEdgeSchema, edge);

  await db.transact([
    db.tx.business_segments[id].update(validatedNode),
    db.tx.has_segments[edgeId].update(validatedEdge),
    db.tx.companies[company_id].link({ segments: id }),
    db.tx.business_segments[id].link({ company: company_id }),
  ]);

  return id;
}
