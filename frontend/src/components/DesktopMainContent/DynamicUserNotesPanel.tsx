import { UserNotesPanel } from "./UserNotesPanel";
import { useUserNotesPanel } from "../../hooks/useUserNotesPanel";

const PANEL_HALF_HEIGHT = "min(420px, calc(100% - 54px))";
const PANEL_FULL_HEIGHT = "calc(100% - 54px)";
const AUTO_EXPAND_THRESHOLD = 4;

export function DynamicUserNotesPanel() {
  const { notes, isLoading } = useUserNotesPanel({
    pageSize: 8,
    cardGap: 8,
    minCardHeight: 72,
  });

  const shouldExpand = !isLoading && notes.length > AUTO_EXPAND_THRESHOLD;
  const panelHeight = shouldExpand ? PANEL_FULL_HEIGHT : PANEL_HALF_HEIGHT;

  return (
    <div className="relative h-full min-h-0 p-6">
      <div
        style={{
          width: "min(540px, 100%)",
          height: panelHeight,
          minHeight: "420px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "8px",
          overflow: "hidden",
          background: "hsl(240 6% 4%)",
          position: "relative",
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
