import { useMemo } from "react";
import { UserNotesPanel } from "./UserNotesPanel";
import { useUserNotesPanel } from "../../hooks/useUserNotesPanel";
import { db } from "../../db/client";

function calculateHeight(noteCount: number): string {
  if (noteCount === 0) return "200px";

  const headerHeight = 50;
  const footerPadding = 30;
  const cardHeight = 80;
  const cardGap = 8;
  const contentHeight = headerHeight + footerPadding + (noteCount * cardHeight) + ((noteCount - 1) * cardGap);
  const maxHeight = Math.min(contentHeight, 800);

  return `${maxHeight}px`;
}

export function DynamicUserNotesPanel() {
  const { user } = db.useAuth();
  const { notes, isLoading } = useUserNotesPanel({
    pageSize: 8,
    cardGap: 8,
    minCardHeight: 72,
  });

  const dynamicHeight = useMemo(() => {
    if (isLoading || !user) return "420px";
    return calculateHeight(notes.length);
  }, [notes.length, isLoading, user]);

  return (
    <div className="relative h-full min-h-0 p-6">
      <div
        style={{
          width: "min(420px, 100%)",
          height: dynamicHeight,
          minHeight: "200px",
          maxHeight: "calc(100% - 54px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "8px",
          overflow: "hidden",
          background: "hsl(240 6% 4%)",
          transition: "height 0.3s ease",
        }}
      >
        <UserNotesPanel />
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-[12px]"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          backgroundColor: "hsl(155, 80%, 8%)",
          border: "1px solid hsl(155, 60%, 18%)",
          borderRadius: "6px",
          padding: "2px 8px",
          color: "hsl(150, 60%, 70%)",
          textShadow: "0 0 6px hsl(150, 60%, 70%, 0.18)",
          fontSize: "12px",
          lineHeight: "1",
        }}
      >
        Press{" "}
        <kbd
          className="px-1.5 py-[1px] text-xs rounded"
          style={{
            backgroundColor: "hsl(155, 95%, 4%)",
            border: "1px solid hsl(155, 75%, 14%)",
            color: "hsl(150, 60%, 70%)",
            lineHeight: "1",
            margin: "0 6px",
          }}
        >
          ⌘ + Shift + F
        </kbd>{" "}
        to search
      </div>
    </div>
  );
}
