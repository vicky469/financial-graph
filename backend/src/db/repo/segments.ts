import { db } from "../client";
import { 
  generateBusinessSegmentId,
  validate,
  type BusinessSegment,
} from "@financial-graph/shared";

export async function upsertBusinessSegment(
  segmentData: Partial<BusinessSegment> & { company_id: string }
): Promise<string> {
  const company_id = segmentData.company_id;
  const id = generateBusinessSegmentId(
    company_id,
    segmentData.segment_name!,
    segmentData.fiscal_year!,
    segmentData.fiscal_quarter ?? null
  );

  const node = {
    id,
    segment_name: segmentData.segment_name!,
    segment_type: segmentData.segment_type!,
    description: segmentData.description!,
    is_reportable: segmentData.is_reportable || false,
    fiscal_year: segmentData.fiscal_year!,
    fiscal_quarter: segmentData.fiscal_quarter ?? undefined,
    revenue: segmentData.revenue ?? undefined,
    operating_income: segmentData.operating_income ?? undefined,
    assets: segmentData.assets ?? undefined,
    updated_at: new Date().toISOString(),
  };

  await db.transact([
    db.tx.business_segment[id].update(node),
    db.tx.company[company_id].link({ businessSegments: id }),
  ]);

  return id;
}
