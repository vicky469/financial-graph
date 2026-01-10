/**
 * Audit Repository
 *
 * Provides functions for recording and querying audit trail records.
 * Audits track CREATE/UPDATE/DELETE operations with field-level changes.
 */

import { db } from "../client";
import { generateAuditId } from "../ids";
import type { Audit, FieldChange } from "../../types";

const AUDIT_RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS || "7");

/**
 * Record an audit event for an entity change
 */
export async function recordAudit(params: {
  entity_type: string;
  entity_id: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  changed_by: "heuristic" | "llm" | "human";
  fields_changed: FieldChange[];
  source_id?: string;
}): Promise<string> {
  const changed_at = new Date().toISOString();
  const expires_at = new Date(
    Date.now() + AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const id = generateAuditId(params.entity_type, params.entity_id, changed_at);

  const audit: Audit = {
    id,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    operation: params.operation,
    changed_by: params.changed_by,
    changed_at,
    source_id: params.source_id || null,
    fields_changed: params.fields_changed,
    expires_at,
  };

  await db.transact([db.tx.audits[id].update(audit)]);

  return id;
}

/**
 * Get all audits for a specific entity
 */
export async function getAuditsForEntity(
  entityType: string,
  entityId: string
): Promise<Audit[]> {
  const result = await db.query({
    audits: {
      $: {
        where: {
          entity_type: entityType,
          entity_id: entityId,
        },
        order: { serverCreatedAt: "desc" },
      },
    },
  });

  return (result.audits || []) as Audit[];
}

/**
 * Prune expired audit records (older than AUDIT_RETENTION_DAYS)
 * Returns the count of deleted records
 */
export async function pruneExpiredAudits(): Promise<number> {
  const now = new Date().toISOString();

  const result = await db.query({
    audits: {
      $: {
        where: {
          expires_at: { $lt: now },
        },
        limit: 1000,
      },
    },
  });

  const expired = result.audits || [];
  if (expired.length === 0) return 0;

  const txs = expired.map((audit: any) =>
    db.tx.audits[audit.id].delete()
  );

  await db.transact(txs);
  return expired.length;
}
