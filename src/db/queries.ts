// Shared Query Hooks

import { db } from "./client";
import type { Event, Edge, Node } from "../types";

export const useGraph = () => {
  const { data, isLoading, error } = db.useQuery({
    events: {},
    nodes: {},
    edges: {},
    userSelections: {},
  });
  return {
    events: (data?.events ?? []) as Event[],
    nodes: (data?.nodes ?? []) as Node[],
    edges: (data?.edges ?? []) as Edge[],
    selections: data?.userSelections ?? [],
    isLoading,
    error,
  };
};
