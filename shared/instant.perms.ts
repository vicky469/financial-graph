// InstantDB permissions configuration
// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/core";

const rules = {
  $users: {
    allow: {
      view: "true", // anyone can see users
      create: "false",
      delete: "false",
      update: "false",
    },
    fields: {
      email: "true", // allow all authenticated users to see email addresses
    },
  },
} satisfies InstantRules;

export default rules;
