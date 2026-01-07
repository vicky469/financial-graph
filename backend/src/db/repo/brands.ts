import { db } from "../client";
import * as IDs from "../ids";
import type * as Types from "../../types";
import { BrandSchema, OwnsEdgeSchema, validate } from "../validation";

export async function upsertBrand(
  brandData: Partial<Types.Brand> & { acquired_date?: string | null }
): Promise<string> {
  const id = IDs.generateBrandId(brandData);
  const company_id = brandData.owning_company_id!;

  // If undefined, we assume it's NOT an acquisition (so null).
  const acquired_date = brandData.acquired_date ?? null;

  const node: Types.Brand = {
    id,
    name: brandData.name!,
    owning_company_id: company_id,
    category: brandData.category || null,
    status: brandData.status || "active",
    launch_date: brandData.launch_date || null,
    created_at: brandData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate the node before inserting
  const validatedNode = validate(BrandSchema, node);

  const edgeId = IDs.generateOwnsEdgeId({
    from_company_id: company_id,
    to_brand_id: id,
  });

  const edge: Types.OwnsEdge = {
    id: edgeId,
    from_company_id: company_id,
    to_brand_id: id,
    acquired_date: acquired_date,
    divested_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate the edge before inserting
  const validatedEdge = validate(OwnsEdgeSchema, edge);

  await db.transact([
    db.tx.brands[id].update(validatedNode),
    db.tx.owns[edgeId].update(validatedEdge),
    db.tx.companies[company_id].link({ brands: id }),
    db.tx.brands[id].link({ owner: company_id }),
  ]);

  return id;
}
