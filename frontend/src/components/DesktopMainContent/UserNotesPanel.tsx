import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useUserNotesPanel } from "../../hooks/useUserNotesPanel";
import { renderTextWithAdminMention } from "../../utils/adminMentionStyling";
import type { Note, TiptapNode } from "financial-graph-shared/types";

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

function tiptapToText(node: TiptapNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";

  if (node.type === "companyMention") {
    const mentionName = typeof node.attrs?.companyName === "string" ? node.attrs.companyName : "";
    return mentionName ? `@${mentionName}` : "@company";
  }

  const childText = (node.content ?? []).map(tiptapToText).join("");
  if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
    return `${childText}\n`;
  }
  return childText;
}

function getNotePreview(note: Note): string {
  const raw = (note.content?.content ?? []).map(tiptapToText).join(" ");
  const normalized = raw.replace(/\s+/g, " ").trim();
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
  const showDoneIndicator = note.reportStatus === "done";

  return (
    <div
      style={{
        position: "relative",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.02)",
        boxSizing: "border-box",
        height: `${cardHeightPx}px`,
        minHeight: `${cardHeightPx}px`,
        overflow: "hidden",
      }}
    >
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
          color: "rgba(255,255,255,0.5)",
          marginBottom: "6px",
          paddingRight: "36px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {note.company?.name || "Unknown company"} • {formatCreatedAt(note.createdAt)}
        {showDoneIndicator && (
          <span
            style={{
              marginLeft: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "rgba(134, 239, 172, 0.95)",
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
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1.42,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: "40px",
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
    shouldEnableScroll,
    listViewportRef,
    handleLoadMore,
  } = useUserNotesPanel({
    pageSize: PAGE_SIZE,
    cardGap: CARD_GAP,
    minCardHeight: CARD_MIN_HEIGHT,
  });
  const hasError = Boolean(error);

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
          {hasMore ? `${notes.length}+` : notes.length} {notes.length === 1 ? "note" : "notes"}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          ref={listViewportRef}
          className={shouldEnableScroll ? undefined : "hide-scrollbar"}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: shouldEnableScroll ? "scroll" : "hidden",
            scrollbarGutter: shouldEnableScroll ? "stable" : undefined,
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

          {!hasError && notes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: `${CARD_GAP}px` }}>
              {notes.map((note) => (
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
