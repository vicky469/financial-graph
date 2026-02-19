// InstantDB permissions configuration
// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/core";

const rules = {
  // ==================== SYSTEM ENTITIES ====================
  $users: {
    allow: {
      view: "auth.id != null", // Only authenticated users can see users
      create: "false", // Users are created by auth system only
      delete: "false",
      update: "false",
    },
  },

  $files: {
    allow: {
      view: "auth.id != null", // Only authenticated users can view files
      create: "false", // Files created via admin only
      delete: "false",
      update: "false",
    },
  },

  // ==================== CORE DATA ENTITIES (READ-ONLY for clients) ====================
  // These entities contain SEC filing data and should only be modified by backend/admin

  company: {
    allow: {
      view: "auth.id != null", // Only authenticated users can view
      create: "false", // Admin only via backend
      delete: "false",
      update: "false",
    },
  },

  filing: {
    allow: {
      view: "auth.id != null",
      create: "false",
      delete: "false",
      update: "false",
    },
  },

  parent_of: {
    allow: {
      view: "auth.id != null",
      create: "false",
      delete: "false",
      update: "false",
    },
  },

  subsidiary_enrichment: {
    allow: {
      view: "auth.id != null",
      create: "false",
      delete: "false",
      update: "false",
    },
  },

  company_info: {
    allow: {
      view: "auth.id != null",
      create: "false",
      delete: "false",
      update: "false",
    },
  },

  brand: {
    allow: {
      view: "auth.id != null",
      create: "false",
      delete: "false",
      update: "false",
    },
  },

  owns: {
    allow: {
      view: "auth.id != null",
      create: "false",
      delete: "false",
      update: "false",
    },
  },

  // ==================== USER-GENERATED CONTENT ====================

  notes: {
    bind: {
      isOwner: "auth.id in data.ref('user.id')",
      isAdmin: "'admin' in auth.ref('$user.roles') || '[\"admin\"]' in auth.ref('$user.roles')",
    },
    allow: {
      view: "auth.id != null",
      create: "auth.id != null",
      update: "isOwner || isAdmin", // Owner or admin can update
      delete: "isOwner || isAdmin", // Owner or admin can delete
    },
  },

  // ==================== AUDIT TRAIL ====================

  audit: {
    allow: {
      view: "auth.id != null", // Only authenticated users can view audit logs
      create: "false",
      delete: "false",
      update: "false",
    },
  },
} satisfies InstantRules;

export default rules;
