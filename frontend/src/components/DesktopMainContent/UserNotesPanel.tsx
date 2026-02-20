import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useUserNotesPanel } from "../../hooks/useUserNotesPanel";
import { renderTextWithAdminMention } from "../../utils/adminMentionStyling";
import {
  getNoteType,
  getNoteTypeCounts,
  NOTE_TYPE_META,
  tiptapToPlainText,
  type NoteTypeFilter,
} from "../../utils/noteType";
import type { Note } from "financial-graph-shared/types";

const PREVIEW_LIMIT = 200;
const PAGE_SIZE = 8;
const CARD_GAP = 8;
const CARD_MIN_HEIGHT = 72;

const panelShellStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

const headerStyle: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const TYPE_FILTERS: NoteTypeFilter[] = ["all", "issue", "todo", "other"];

function getNotePreview(note: Note): string {
  const normalized = tiptapToPlainText(note.content);
  if (!normalized) return "(No text content)";
  return normalized.length > PREVIEW_LIMIT
    ? `${normalized.slice(0, PREVIEW_LIMIT - 1)}...`
    : normalized;
}

function getRelativeNoteUrl(note: Note): string | null {
  if (!note.company?.id) return null;
  return `/company/${note.company.id}?noteId=${note.id}`;
}

function getAbsoluteNoteUrl(relativeUrl: string): string {
  if (typeof window === "undefined") return relativeUrl;
  return `${window.location.origin}${relativeUrl}`;
}

function formatCreatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString();
}

function RedirectIcon({ relativeUrl, absoluteUrl }: { relativeUrl: string | null; absoluteUrl: string | null }) {
  const iconStyle: React.CSSProperties = {
    width: "26px",
    height: "26px",
    borderRadius: "6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (relativeUrl && absoluteUrl) {
    return (
      <Link
        to={relativeUrl}
        aria-label="Open note"
        title={absoluteUrl}
        style={{
          ...iconStyle,
          color: "#60a5fa",
          border: "1px solid rgba(96, 165, 250, 0.45)",
          background: "rgba(96, 165, 250, 0.08)",
        }}
      >
        <ExternalLink size={14} />
      </Link>
    );
  }

  return (
    <span
      style={{
        ...iconStyle,
        color: "rgba(255,255,255,0.28)",
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.02)",
      }}
      aria-hidden="true"
    >
      <ExternalLink size={14} />
    </span>
  );
}

function NoteCardRow({
  note,
  cardHeightPx,
}: {
  note: Note;
  cardHeightPx: number;
}) {
  const relativeUrl = getRelativeNoteUrl(note);
  const absoluteUrl = relativeUrl ? getAbsoluteNoteUrl(relativeUrl) : null;
  const previewText = getNotePreview(note);
  const noteType = getNoteType(note);
  const noteTypeMeta = NOTE_TYPE_META[noteType];
  const companyUrl = note.company?.id ? `/company/${note.company.id}` : null;
  const companyName = note.company?.name || "Unknown company";
  const showDoneIndicator = note.reportStatus === "done";
  const accentColor = showDoneIndicator ? "rgba(110, 231, 183, 0.78)" : "rgba(125, 211, 252, 0.7)";
  const accentBackground = showDoneIndicator
    ? "linear-gradient(180deg, rgba(17, 30, 25, 0.9) 0%, rgba(12, 21, 18, 0.95) 100%)"
    : "linear-gradient(180deg, rgba(20, 26, 37, 0.9) 0%, rgba(13, 18, 27, 0.95) 100%)";
  const cardBorderColor = showDoneIndicator ? "rgba(110, 231, 183, 0.25)" : "rgba(148, 163, 184, 0.2)";
  const metadataColor = showDoneIndicator ? "rgba(167, 243, 208, 0.72)" : "rgba(148, 163, 184, 0.74)";

  return (
    <div
      style={{
        position: "relative",
        padding: "10px 12px",
        borderRadius: "8px",
        border: `1px solid ${cardBorderColor}`,
        background: accentBackground,
        boxSizing: "border-box",
        height: `${cardHeightPx}px`,
        minHeight: `${cardHeightPx}px`,
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "7px",
          bottom: "7px",
          left: "7px",
          width: "3px",
          borderRadius: "999px",
          background: accentColor,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "6px",
          right: "6px",
        }}
      >
        <RedirectIcon relativeUrl={relativeUrl} absoluteUrl={absoluteUrl} />
      </div>

      <div
        style={{
          fontSize: "11px",
          color: metadataColor,
          marginBottom: "6px",
          paddingRight: "36px",
          paddingLeft: "10px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {companyUrl ? (
          <Link
            to={companyUrl}
            style={{
              color: "rgba(186, 230, 253, 0.88)",
              textDecoration: "underline",
              textDecorationColor: "rgba(125, 211, 252, 0.45)",
              textUnderlineOffset: "2px",
            }}
          >
            {companyName}
          </Link>
        ) : (
          companyName
        )}{" "}
        • {formatCreatedAt(note.createdAt)}
        <span
          style={{
            marginLeft: "8px",
            padding: "1px 6px",
            borderRadius: "999px",
            border: `1px solid ${noteTypeMeta.borderColor}`,
            background: noteTypeMeta.background,
            color: noteTypeMeta.textColor,
            fontSize: "10px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {noteTypeMeta.label}
        </span>
        {showDoneIndicator && (
          <span
            style={{
              marginLeft: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "rgba(134, 239, 172, 0.9)",
              fontWeight: 500,
            }}
            title="Admin marked this report as done"
          >
            <CheckCircle2 size={12} />
            Done
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "rgba(226, 232, 240, 0.96)",
          lineHeight: 1.42,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: "40px",
          paddingLeft: "10px",
        }}
      >
        {renderTextWithAdminMention(previewText)}
      </div>
    </div>
  );
}

export function UserNotesPanel() {
  const {
    user,
    notes,
    isLoading,
    error,
    hasMore,
    isLoadingMore,
    loadMoreError,
    cardHeightPx,
    listViewportRef,
    handleLoadMore,
  } = useUserNotesPanel({
    pageSize: PAGE_SIZE,
    cardGap: CARD_GAP,
    minCardHeight: CARD_MIN_HEIGHT,
  });
  const [activeTypeFilter, setActiveTypeFilter] = useState<NoteTypeFilter>("all");
  const hasError = Boolean(error);
  const typeCounts = useMemo(() => getNoteTypeCounts(notes), [notes]);
  const filteredNotes = useMemo(
    () => (activeTypeFilter === "all" ? notes : notes.filter((note) => getNoteType(note) === activeTypeFilter)),
    [notes, activeTypeFilter]
  );
  const shouldEnableScrollForDisplay = filteredNotes.length > PAGE_SIZE;
  const activeFilterLabel = activeTypeFilter === "all" ? "all" : NOTE_TYPE_META[activeTypeFilter].label.toLowerCase();

  if (!user) {
    return (
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", textAlign: "center" }}>
        Sign in to load your notes.
      </div>
    );
  }

  return (
    <div style={panelShellStyle}>
      <div style={headerStyle}>
        <h3
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.72)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: 0,
          }}
        >
          Your Notes
        </h3>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>
          {activeTypeFilter === "all"
            ? `${hasMore ? `${notes.length}+` : notes.length} ${notes.length === 1 ? "note" : "notes"}`
            : `${filteredNotes.length} ${activeFilterLabel} ${filteredNotes.length === 1 ? "note" : "notes"}`}
        </span>
      </div>

      <div
        style={{
          padding: "8px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
        }}
      >
        {TYPE_FILTERS.map((filterType) => {
          const isActive = activeTypeFilter === filterType;
          const isAll = filterType === "all";
          const label = isAll ? "All" : NOTE_TYPE_META[filterType].label;
          const count = isAll ? notes.length : typeCounts[filterType];
          const tone = isAll
            ? {
                borderColor: "rgba(125, 211, 252, 0.28)",
                background: "rgba(14, 116, 144, 0.18)",
                textColor: "rgba(186, 230, 253, 0.9)",
              }
            : NOTE_TYPE_META[filterType];

          return (
            <button
              key={filterType}
              type="button"
              onClick={() => setActiveTypeFilter(filterType)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 9px",
                borderRadius: "999px",
                border: `1px solid ${isActive ? tone.borderColor : "rgba(148,163,184,0.18)"}`,
                background: isActive ? tone.background : "rgba(255,255,255,0.02)",
                color: isActive ? tone.textColor : "rgba(203,213,225,0.74)",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
              aria-pressed={isActive}
            >
              <span>{label}</span>
              <span
                style={{
                  padding: "1px 5px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.24)",
                  fontSize: "10px",
                  lineHeight: 1.1,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          ref={listViewportRef}
          className={shouldEnableScrollForDisplay ? undefined : "hide-scrollbar"}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: shouldEnableScrollForDisplay ? "scroll" : "hidden",
            scrollbarGutter: shouldEnableScrollForDisplay ? "stable" : undefined,
            padding: `${CARD_GAP}px 20px`,
          }}
        >
          {isLoading && notes.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>Loading notes...</div>
          )}

          {hasError && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "6px",
                background: "rgba(248, 113, 113, 0.08)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
                color: "#f87171",
                fontSize: "12px",
              }}
            >
              Unable to load notes. Please try again.
            </div>
          )}

          {!isLoading && !hasError && notes.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>
              You do not have any notes yet.
            </div>
          )}

          {!isLoading && !hasError && notes.length > 0 && filteredNotes.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>
              No {activeFilterLabel} notes yet.
            </div>
          )}

          {!hasError && filteredNotes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: `${CARD_GAP}px` }}>
              {filteredNotes.map((note) => (
                <NoteCardRow
                  key={note.id}
                  note={note}
                  cardHeightPx={cardHeightPx}
                />
              ))}
            </div>
          )}
        </div>

        {!hasError && hasMore && (
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              padding: "8px 20px 14px 20px",
              display: "flex",
              justifyContent: "center",
              background: "linear-gradient(180deg, rgba(15,15,16,0.12) 0%, rgba(15,15,16,0.45) 100%)",
            }}
          >
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              style={{
                border: "1px solid rgba(96, 165, 250, 0.45)",
                background: isLoadingMore ? "rgba(96, 165, 250, 0.12)" : "rgba(96, 165, 250, 0.18)",
                color: "rgba(191, 219, 254, 0.95)",
                fontSize: "12px",
                fontWeight: 500,
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: isLoadingMore ? "default" : "pointer",
                minWidth: "96px",
              }}
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}

        {!hasError && loadMoreError && (
          <div
            style={{
              padding: "0 12px 10px 12px",
              textAlign: "center",
              color: "#f87171",
              fontSize: "11px",
            }}
          >
            {loadMoreError}
          </div>
        )}
      </div>
    </div>
  );
}
