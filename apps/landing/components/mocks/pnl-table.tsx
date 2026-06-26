import { PNL } from "@/lib/mock-data";
import { cn, usd } from "@/lib/utils";

const fmt = (n: number) =>
  n < 0 ? `−${usd(Math.abs(n))}` : usd(n);

export function PnlTableMock() {
  return (
    <div className="flex h-full flex-col justify-center text-xs">
      {PNL.map((row) => {
        const isResult = row.kind === "result";
        return (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between gap-2 py-1",
              isResult && "mt-1 border-t border-foreground/15 pt-2 font-semibold",
            )}
          >
            <span className={isResult ? "text-foreground" : "text-muted-foreground"}>
              {row.label}
            </span>
            <div className="flex items-center gap-3 tabular-nums">
              <span
                className={cn(
                  isResult
                    ? "text-primary"
                    : row.kind === "subtract"
                      ? "text-foreground/75"
                      : "text-foreground",
                )}
              >
                {fmt(row.amount)}
              </span>
              <span className="w-12 text-right text-muted-foreground">
                {row.pct}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
