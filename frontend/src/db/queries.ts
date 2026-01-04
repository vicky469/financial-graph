// Shared Query Hooks

import { db } from "./client";
import type { Edge, Node } from "../types";

export const useGraph = () => {
  const { data, isLoading, error } = db.useQuery({
    nodes: {},
    edges: {},
    userSelections: {},
  });
  return {
    nodes: (data?.nodes ?? []) as Node[],
    edges: (data?.edges ?? []) as Edge[],
    selections: data?.userSelections ?? [],
    isLoading,
    error,
  };
};
