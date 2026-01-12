import { db } from "../client";
import { 
  generateBrandId,
  generateOwnsId,
  type Brand,
} from "@financial-graph/shared";

export async function upsertBrand(
  brandData: Partial<Brand> & { company_id: string; acquired_date?: string | null }
): Promise<string> {
  const company_id = brandData.company_id;
  const id = generateBrandId(company_id, brandData.name!);

  // If undefined, we assume it's NOT an acquisition (so undefined).
  const acquired_date = brandData.acquired_date ?? undefined;

  const node = {
    id,
    name: brandData.name!,
    category: brandData.category ?? undefined,
    status: brandData.status || "active",
    launch_date: brandData.launch_date ?? undefined,
    updated_at: new Date().toISOString(),
  };

  const edgeId = generateOwnsId(company_id, id);

  const edge = {
    id: edgeId,
    acquired_date,
    divested_date: undefined,
    updated_at: new Date().toISOString(),
  };

  await db.transact([
    db.tx.brand[id].update(node),
    db.tx.owns[edgeId].update(edge),
    db.tx.company[company_id].link({ brands: id }),
    db.tx.owns[edgeId].link({ company: company_id, brand: id }),
  ]);

  return id;
}
