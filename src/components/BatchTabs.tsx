import { useRef, useState, useEffect, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BatchTabsProps {
  batches: string[];       // unique batch strings, sorted newest-first
  selected: string;        // "" = All Batches
  onSelect: (batch: string) => void;
}

const GRN = "linear-gradient(135deg,#1e4a34,#122a1e)";

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 20px",
    borderRadius: 50,
    border: "none",
    cursor: "pointer",
    fontSize: "0.835rem",
    fontWeight: active ? 700 : 500,
    background: active ? GRN : "transparent",
    color: active ? "#fff" : "#8a7e72",
    boxShadow: active ? "0 3px 12px rgba(26,74,52,0.3)" : "none",
    transition: "all 0.18s",
    whiteSpace: "nowrap",
    flexShrink: 0,
    outline: "none",
  };
}

function arrowStyle(enabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: `1.5px solid ${enabled ? "#c4bdb4" : "#e0dbd4"}`,
    background: enabled ? "rgba(255,255,255,0.85)" : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: enabled ? "pointer" : "default",
    color: enabled ? "#4a3c30" : "#cdc6be",
    flexShrink: 0,
    transition: "all 0.18s",
    padding: 0,
    outline: "none",
  };
}

const BatchTabs = memo(({ batches, selected, onSelect }: BatchTabsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Recompute arrow states whenever content or size changes
  const syncArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    syncArrows();
    el.addEventListener("scroll", syncArrows, { passive: true });
    const ro = new ResizeObserver(syncArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncArrows);
      ro.disconnect();
    };
  }, [syncArrows, batches]);

  // Scroll the active batch tab into view whenever selection changes
  useEffect(() => {
    if (!selected || !scrollRef.current) return;
    const el = scrollRef.current;
    const buttons = el.querySelectorAll<HTMLElement>("[data-batch]");
    for (const btn of buttons) {
      if (btn.dataset.batch === selected) {
        const btnLeft = btn.offsetLeft;
        const btnRight = btnLeft + btn.offsetWidth;
        const visLeft = el.scrollLeft;
        const visRight = visLeft + el.clientWidth;
        if (btnLeft < visLeft) {
          el.scrollTo({ left: btnLeft - 8, behavior: "smooth" });
        } else if (btnRight > visRight) {
          el.scrollTo({ left: btnRight - el.clientWidth + 8, behavior: "smooth" });
        }
        break;
      }
    }
  }, [selected]);

  const nudge = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" });
  };

  // Keyboard support: left/right arrow keys move focus between tabs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const tabs = Array.from(el.querySelectorAll<HTMLElement>("[data-batch]"));
    const focused = el.querySelector<HTMLElement>("[data-batch]:focus");
    if (!focused) return;
    const idx = tabs.indexOf(focused);
    if (e.key === "ArrowRight" && idx < tabs.length - 1) tabs[idx + 1].focus();
    if (e.key === "ArrowLeft" && idx > 0) tabs[idx - 1].focus();
    e.preventDefault();
  };

  const hasBatches = batches.length > 0;

  return (
    <>
      {/* Hides webkit scrollbar without needing a global CSS rule */}
      <style>{`
        .btabs-scroll::-webkit-scrollbar { display: none; }
        .btabs-scroll { scroll-behavior: smooth; scroll-snap-type: x mandatory; }
        .btabs-scroll button { scroll-snap-align: start; }
      `}</style>

      <div
        role="tablist"
        aria-label="Filter students by batch"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: 6,
          borderRadius: 50,
          background: "linear-gradient(135deg,#eae6dc,#f2ede4)",
          marginBottom: 24,
          boxShadow: "inset 0 1.5px 4px rgba(0,0,0,0.08)",
          border: "1px solid #d8d2c6",
          overflow: "hidden",
        }}
      >
        {/* "All Batches" — always visible, never scrolled away */}
        <button
          role="tab"
          aria-selected={selected === ""}
          aria-label="Show all batches"
          onClick={() => onSelect("")}
          style={tabStyle(selected === "")}
        >
          All Batches
        </button>

        {hasBatches && (
          <>
            {/* Divider between fixed and scrollable zones */}
            <div
              aria-hidden="true"
              style={{ width: 1, height: 20, background: "#ccc5bb", flexShrink: 0, margin: "0 2px" }}
            />

            {/* Left scroll arrow */}
            <button
              aria-label="Scroll to earlier batches"
              disabled={!canLeft}
              onClick={() => nudge("left")}
              style={arrowStyle(canLeft)}
              tabIndex={canLeft ? 0 : -1}
            >
              <ChevronLeft size={13} strokeWidth={2.5} />
            </button>

            {/* Scrollable batch strip — fills remaining space */}
            <div
              ref={scrollRef}
              className="btabs-scroll"
              onKeyDown={handleKeyDown}
              style={{
                display: "flex",
                gap: 4,
                maxWidth: 320,
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {batches.map((b) => (
                <button
                  key={b}
                  role="tab"
                  aria-selected={selected === b}
                  aria-label={`Batch ${b}`}
                  data-batch={b}
                  onClick={() => onSelect(b)}
                  style={tabStyle(selected === b)}
                >
                  Batch {b}
                </button>
              ))}
            </div>

            {/* Right scroll arrow */}
            <button
              aria-label="Scroll to more batches"
              disabled={!canRight}
              onClick={() => nudge("right")}
              style={arrowStyle(canRight)}
              tabIndex={canRight ? 0 : -1}
            >
              <ChevronRight size={13} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>
    </>
  );
});

BatchTabs.displayName = "BatchTabs";
export default BatchTabs;
