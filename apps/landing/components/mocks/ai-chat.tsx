"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@/components/icons";
import { AI_TRANSCRIPT } from "@/lib/mock-data";

/** Render **bold** spans inside an otherwise plain string. */
function withBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const turnDelay = (role: string) =>
  role === "user" ? 650 : role === "tool" ? 600 : 350;

export function AiChatMock() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setShown(AI_TRANSCRIPT.length);
      return;
    }
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const advance = () => {
      i += 1;
      setShown(i);
      if (i < AI_TRANSCRIPT.length) {
        timers.push(setTimeout(advance, turnDelay(AI_TRANSCRIPT[i - 1].role)));
      }
    };
    timers.push(setTimeout(advance, 450));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);

  return (
    <div
      ref={ref}
      className="overflow-hidden bg-card ring-1 ring-foreground/10"
    >
      {/* window title bar */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          marginoptic · mcp server
        </span>
        <span className="ml-auto inline-flex h-5 items-center bg-primary/10 px-1.5 font-mono text-[10px] font-medium text-primary">
          Claude
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4 text-xs/relaxed">
        {AI_TRANSCRIPT.slice(0, shown).map((turn, i) => (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {turn.role === "user" && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-muted px-3 py-2 text-foreground">
                  {turn.text}
                </div>
              </div>
            )}

            {turn.role === "tool" && (
              <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="text-primary">▸</span>
                <span className="text-foreground/80">{turn.name}</span>
                <span className="truncate">{turn.args}</span>
                <HugeiconsIcon
                  icon={Tick02Icon}
                  className="ml-auto size-3.5 shrink-0 text-emerald-600"
                  strokeWidth={2.5}
                />
              </div>
            )}

            {turn.role === "assistant" && (
              <div className="flex gap-2">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground">
                  M
                </span>
                <div className="max-w-[92%] text-foreground/90">
                  {withBold(turn.text)}
                </div>
              </div>
            )}
          </motion.div>
        ))}

        {/* streaming cursor while turns are still arriving */}
        {!reduce && shown < AI_TRANSCRIPT.length && (
          <motion.span
            className="inline-block h-3.5 w-1.5 bg-primary"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
    </div>
  );
}
