// Shared Query Hooks

import { db } from "./client";
import type { Event, Edge, Entity } from "../types";

export const useGraph = () => {
  const { data, isLoading, error } = db.useQuery({
    events: {},
    entities: {},
    edges: {},
    userSelections: {},
  });
  return {
    events: (data?.events ?? []) as Event[],
    entities: (data?.entities ?? []) as Entity[],
    edges: (data?.edges ?? []) as Edge[],
    selections: data?.userSelections ?? [],
    isLoading,
    error,
  };
};
