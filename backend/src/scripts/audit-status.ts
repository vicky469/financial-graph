#!/usr/bin/env bun
/**
 * Audit Trail Status Report
 * 
 * Displays the current audit trail configuration and coverage.
 * 
 * Usage:
 *   bun run src/scripts/audit-status.ts
 */

import {
  AUDIT_CONFIG,
  isAuditEnabled,
  getAuditCoverageSummary,
  getEnabledAuditEntities,
} from "../db/repo/audit-config";

function main() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║           AUDIT TRAIL CONFIGURATION STATUS                     ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Global status
  const globalEnabled = isAuditEnabled();
  const retentionDays = process.env.AUDIT_RETENTION_DAYS || "7";
  
  console.log("📊 Global Configuration:");
  console.log(`   ENABLE_AUDIT_TRAIL: ${globalEnabled ? "✅ true" : "❌ false"}`);
  console.log(`   AUDIT_RETENTION_DAYS: ${retentionDays} days`);
  
  if (!globalEnabled) {
    console.log("\n⚠️  Audit trail is DISABLED globally.");
    console.log("   Set ENABLE_AUDIT_TRAIL=true in backend/.env to enable.\n");
  }

  // Coverage summary
  const summary = getAuditCoverageSummary();
  console.log(`\n📈 Coverage: ${summary.enabled}/${summary.total} entities (${summary.coverage})`);
  console.log(`   ✅ Enabled: ${summary.enabled}`);
  console.log(`   ❌ Disabled: ${summary.disabled}`);

  // Enabled entities
  const enabled = getEnabledAuditEntities();
  if (enabled.length > 0) {
    console.log("\n✅ ENABLED Entities:");
    enabled.forEach(config => {
      console.log(`\n   • ${config.entityType}`);
      console.log(`     ${config.description}`);
      console.log(`     Operations: ${config.operations.join(", ")}`);
      if (config.trackedFields.length > 0) {
        console.log(`     Tracked fields: ${config.trackedFields.join(", ")}`);
      } else {
        console.log(`     Tracked fields: All fields`);
      }
      if (config.notes) {
        console.log(`     📝 ${config.notes}`);
      }
    });
  }

  // Disabled entities
  const disabled = Object.values(AUDIT_CONFIG).filter(c => !c.enabled);
  if (disabled.length > 0) {
    console.log("\n\n❌ DISABLED Entities (TODO):");
    disabled.forEach(config => {
      console.log(`\n   • ${config.entityType}`);
      console.log(`     ${config.description}`);
      if (config.notes) {
        console.log(`     📝 ${config.notes}`);
      }
    });
  }

  console.log("\n" + "─".repeat(66));
  console.log("\n💡 To enable audit trail for an entity:");
  console.log("   1. Update AUDIT_CONFIG in src/db/repo/audit-config.ts");
  console.log("   2. Import recordAudit() in the repo file");
  console.log("   3. Call recordAudit() in upsert/update/delete functions");
  console.log("   4. Use computeFieldChanges() to track field-level changes\n");
}

main();
