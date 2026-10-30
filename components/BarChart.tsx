"use client";
// Simple single-series bar chart drawn with plain HTML/CSS (no chart library),
// so it's easy to explain. Hover a bar to see its exact value.
//   orientation "vertical"   → columns (e.g. revenue per month)
//   orientation "horizontal" → bars    (e.g. revenue per room type)
import { useState } from "react";

type Datum = { label: string; value: number; detail?: string };

const BAR_COLOR = "#0d9488"; // teal-600, checked for contrast against the white card

// Rounds the axis maximum up to a clean number: 87,000 → 100,000.
function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max) ?? 10;
  return step * pow;
}

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export default function BarChart({ data, format, orientation = "vertical", label }: {
  data: Datum[];
  format: (n: number) => string;
  orientation?: "vertical" | "horizontal";
  label: string; // describes the chart for screen readers
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));

  if (data.length === 0) return <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>;

  if (orientation === "horizontal") {
    return (
      <div role="img" aria-label={label} className="space-y-2.5">
        {data.map((d, i) => (
          <div key={d.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="truncate text-slate-600" title={d.label}>{d.label}</span>
            <div className="relative h-5">
              <div
                className="h-full rounded-r transition-opacity"
                style={{ width: `${(d.value / max) * 100}%`, background: BAR_COLOR, opacity: hover === null || hover === i ? 1 : 0.45, minWidth: 2 }}
              />
            </div>
            <span className="w-20 text-right tabular-nums text-slate-700">{format(d.value)}</span>
            {hover === i && d.detail && <span className="col-start-2 -mt-1.5 text-xs text-slate-500">{d.detail}</span>}
          </div>
        ))}
      </div>
    );
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <div role="img" aria-label={label} className="relative">
      <div className="flex h-56 gap-2">
        {/* y-axis labels */}
        <div className="flex flex-col-reverse justify-between pb-6 text-right text-xs text-slate-400">
          {ticks.map((t) => <span key={t} className="leading-none">{compact.format(t)}</span>)}
        </div>
        <div className="relative flex-1">
          {/* hairline gridlines */}
          <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col-reverse justify-between">
            {ticks.map((t) => <div key={t} className="border-t border-slate-100" />)}
          </div>
          {/* columns: max 24px wide, 2px gap, rounded top, square at the baseline */}
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end justify-around gap-[2px]">
            {data.map((d, i) => (
              <div key={d.label} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <div
                  className="w-full max-w-6 rounded-t transition-opacity"
                  style={{ height: `${(d.value / max) * 100}%`, background: BAR_COLOR, opacity: hover === null || hover === i ? 1 : 0.45 }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow">
                    <b>{d.label}</b>: {format(d.value)}{d.detail && <span className="text-slate-300"> · {d.detail}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* x-axis labels */}
          <div className="absolute inset-x-0 bottom-0 flex justify-around gap-[2px] border-t border-slate-200 pt-1">
            {data.map((d) => <span key={d.label} className="flex-1 text-center text-xs text-slate-500">{d.label}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
