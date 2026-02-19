import { useMemo } from "react";
import type { InstaQLParams } from "@instantdb/react";
import type { AppSchema } from "financial-graph-shared";
import { db } from "../db/client";

type UserRoleData = {
  $users?: Array<{
    id?: string;
    email?: string;
    roles?: unknown;
  }>;
};

type UsersQuery = InstaQLParams<AppSchema>;

function normalizeRoles(rawRoles: unknown): string[] {
  const normalize = (values: unknown[]): string[] =>
    values
      .map((role) => (typeof role === "string" ? role.trim().toLowerCase() : ""))
      .filter((role) => role.length > 0);

  if (Array.isArray(rawRoles)) {
    return normalize(rawRoles);
  }

  if (typeof rawRoles === "string") {
    const trimmed = rawRoles.trim();
    if (trimmed.length === 0) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalize(parsed);
      }
    } catch {
      // Fall through to comma-separated parsing.
    }

    return normalize(
      trimmed
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
    );
  }

  if (rawRoles && typeof rawRoles === "object") {
    return normalize(Object.values(rawRoles as Record<string, unknown>));
  }

  return [];
}

export function useIsAdminUser(userId?: string | null) {
  const { user } = db.useAuth();
  const targetUserId = userId ?? user?.id ?? null;
  const targetEmail = user?.email ?? null;

  const usersQuery =
    targetUserId || targetEmail
      ? ({
          $users: {
            $: {
              fields: ["id", "email", "roles"],
            },
          },
        } satisfies UsersQuery)
      : null;

  const { data, isLoading } = db.useQuery(usersQuery);
  const users = (data as UserRoleData | undefined)?.$users ?? [];
  const matchedUser =
    users.find((candidate) => {
      if (targetUserId && candidate.id === targetUserId) return true;
      if (targetEmail && candidate.email === targetEmail) return true;
      return false;
    }) ?? users[0];
  const rawRoles = matchedUser?.roles;

  const roles = useMemo(() => {
    return normalizeRoles(rawRoles);
  }, [rawRoles]);

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isLoadingRoles: Boolean(targetUserId || targetEmail) && isLoading,
  };
}
