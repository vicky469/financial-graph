import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../db/client";
import type { Note } from "financial-graph-shared/types";

type Cursor = [string, string, unknown, number];

type UserNotesQueryData = {
  notes?: Note[];
};

type NotesPageInfo = {
  notes?: {
    endCursor?: Cursor;
    hasNextPage?: boolean;
  };
};

type QueryOnceResult = {
  data: UserNotesQueryData;
  pageInfo: NotesPageInfo;
};

export interface UseUserNotesPanelOptions {
  pageSize: number;
  cardGap: number;
  minCardHeight: number;
}

export interface UseUserNotesPanelResult {
  user: ReturnType<typeof db.useAuth>["user"];
  notes: Note[];
  isLoading: boolean;
  error: unknown;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  cardHeightPx: number;
  shouldEnableScroll: boolean;
  listViewportRef: React.RefObject<HTMLDivElement | null>;
  handleLoadMore: () => Promise<void>;
}

function userNotesQuery(userId: string, first: number, after: Cursor | null = null) {
  return {
    notes: {
      $: {
        where: { "user.id": userId },
        order: { serverCreatedAt: "desc" },
        first,
        ...(after ? { after } : {}),
      },
      company: {},
      user: {},
    },
  };
}

function mergeUniqueNotes(firstPageNotes: Note[], olderNotes: Note[]): Note[] {
  const firstPageIds = new Set(firstPageNotes.map((note) => note.id));
  const dedupedOlder = olderNotes.filter((note) => !firstPageIds.has(note.id));
  return [...firstPageNotes, ...dedupedOlder];
}

function appendUniqueNotes(current: Note[], incoming: Note[]): Note[] {
  const existingIds = new Set(current.map((note) => note.id));
  const uniqueIncoming = incoming.filter((note) => !existingIds.has(note.id));
  return [...current, ...uniqueIncoming];
}

function getQueryOnce() {
  return (
    db as unknown as {
      queryOnce: (query: unknown) => Promise<QueryOnceResult>;
    }
  ).queryOnce;
}

export function useUserNotesPanel({
  pageSize,
  cardGap,
  minCardHeight,
}: UseUserNotesPanelOptions): UseUserNotesPanelResult {
  const { user } = db.useAuth();
  const [olderNotes, setOlderNotes] = useState<Note[]>([]);
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasLoadedOlderPages, setHasLoadedOlderPages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [cardHeightPx, setCardHeightPx] = useState<number>(minCardHeight);
  const listViewportRef = useRef<HTMLDivElement>(null);

  const { data, pageInfo, isLoading, error } = db.useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user ? (userNotesQuery(user.id, pageSize) as any) : null
  );

  const firstPageNotes = ((data as UserNotesQueryData | undefined)?.notes ?? []) as Note[];
  const pageMeta = (pageInfo as NotesPageInfo | undefined)?.notes;
  const notes = useMemo(() => mergeUniqueNotes(firstPageNotes, olderNotes), [firstPageNotes, olderNotes]);
  const shouldEnableScroll = notes.length > pageSize;

  useEffect(() => {
    setOlderNotes([]);
    setNextCursor(null);
    setHasMore(false);
    setHasLoadedOlderPages(false);
    setIsLoadingMore(false);
    setLoadMoreError(null);
  }, [user?.id]);

  useEffect(() => {
    if (!pageMeta || hasLoadedOlderPages) return;
    setNextCursor(pageMeta.endCursor ?? null);
    setHasMore(Boolean(pageMeta.hasNextPage));
  }, [pageMeta, hasLoadedOlderPages]);

  useEffect(() => {
    const computeCardHeight = () => {
      const viewport = listViewportRef.current;
      if (!viewport) return;

      const availableHeight = viewport.clientHeight;
      if (availableHeight <= 0) return;

      const totalGap = cardGap * (pageSize - 1);
      const fittedHeight = Math.floor((availableHeight - totalGap) / pageSize);
      setCardHeightPx(Math.max(minCardHeight, fittedHeight));
    };

    computeCardHeight();
    window.addEventListener("resize", computeCardHeight);
    return () => window.removeEventListener("resize", computeCardHeight);
  }, [cardGap, pageSize, minCardHeight, hasMore, error, isLoading, notes.length]);

  const handleLoadMore = async () => {
    if (!user || !nextCursor || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const response = await getQueryOnce()(userNotesQuery(user.id, pageSize, nextCursor));
      const pageData = (response.data?.notes ?? []) as Note[];
      const pageDataInfo = response.pageInfo?.notes;

      setOlderNotes((prev) => appendUniqueNotes(prev, pageData));
      setNextCursor(pageDataInfo?.endCursor ?? null);
      setHasMore(Boolean(pageDataInfo?.hasNextPage));
      setHasLoadedOlderPages(true);
    } catch (err) {
      console.error("Failed to load more notes:", err);
      setLoadMoreError("Unable to load more notes. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return {
    user,
    notes,
    isLoading,
    error,
    hasMore,
    isLoadingMore,
    loadMoreError,
    cardHeightPx,
    shouldEnableScroll,
    listViewportRef,
    handleLoadMore,
  };
}
