// InstantDB permissions configuration
// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/core";

const rules = {
  // ==================== SYSTEM ENTITIES ====================
  $users: {
    allow: {
      view: "true", // Anyone can see users (needed for displaying note authors)
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
    allow: {
      // Users can view their own notes, or public notes
      view: "auth.id != null && (data.ref('user.id') == auth.id || data.visibility == 'public')",
      // Users can only create notes linked to themselves
      create: "auth.id != null",
      // Users can only update their own notes
      update: "auth.id != null && data.ref('user.id') == auth.id",
      // Users can only delete their own notes
      delete: "auth.id != null && data.ref('user.id') == auth.id",
    },
    bind: [
      // Ensure new notes are always linked to the authenticated user
      "isOwner", "auth.id != null && data.ref('user.id') == auth.id",
    ],
  },

  // ==================== AUDIT TRAIL ====================

  audit: {
    allow: {
      view: "true",
      create: "false",
      delete: "false",
      update: "false",
    },
  },
} satisfies InstantRules;

export default rules;
