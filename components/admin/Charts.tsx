"use client";

import { useId, useState } from "react";

/**
 * Small single-series charts for the admin dashboard (inline SVG, no library).
 * One hue (navy), thin marks, recessive grid, hover crosshair + tooltip,
 * and a data table for screen readers / when color is unavailable.
 */

interface Point { label: string; value: number }
interface Props { points: Point[]; format?: (v: number) => string; height?: number; title: string; kind?: "bar" | "area" }

const NAVY = "#0F2A4A";

export function TimeSeries({ points, format = (v) => String(v), height = 160, title, kind = "bar" }: Props) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 340, H = height, PAD = { l: 34, r: 8, t: 8, b: 22 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  const max = Math.max(1, ...points.map(p => p.value));
  const niceMax = niceCeil(max);
  const n = points.length;
  const x = (i: number) => PAD.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - (v / niceMax) * innerH;
  const ticks = [0, niceMax / 2, niceMax];
  const barW = Math.max(2, (innerW / Math.max(1, n)) * 0.6);
  const total = points.reduce((s, p) => s + p.value, 0);
  const areaPath = n > 1 ? `M${x(0)},${y(points[0].value)} ` + points.slice(1).map((p, i) => `L${x(i + 1)},${y(p.value)}`).join(" ") : "";

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-labelledby={`${id}-t`} onMouseLeave={() => setHover(null)}>
        <title id={`${id}-t`}>{title}</title>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 3.5} fontSize={10} textAnchor="end" fill="#8A97A8">{format(t)}</text>
          </g>
        ))}
        {kind === "area" && n > 1 && (
          <>
            <path d={`${areaPath} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={NAVY} fillOpacity={0.08} />
            <path d={areaPath} fill="none" stroke={NAVY} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {kind === "bar" && points.map((p, i) => {
          const h = Math.max(0, y(0) - y(p.value));
          return <rect key={i} x={x(i) - barW / 2} y={y(p.value)} width={barW} height={h} rx={h > 0 ? Math.min(3, barW / 2) : 0} fill={NAVY} fillOpacity={hover === null || hover === i ? 1 : 0.45} />;
        })}
        {/* x labels: first, middle, last */}
        {[0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => n > 0 && a.indexOf(v) === i).map(i => (
          <text key={i} x={x(i)} y={H - 6} fontSize={10} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fill="#8A97A8">{points[i].label}</text>
        ))}
        {/* hover layer */}
        {hover !== null && points[hover] && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={y(0)} stroke={NAVY} strokeOpacity={0.35} strokeDasharray="3 3" />
            {kind === "area" && <circle cx={x(hover)} cy={y(points[hover].value)} r={4.5} fill={NAVY} stroke="#fff" strokeWidth={2} />}
          </g>
        )}
        {points.map((p, i) => (
          <rect key={`h${i}`} x={x(i) - innerW / Math.max(1, n) / 2} y={PAD.t} width={innerW / Math.max(1, n)} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
        ))}
      </svg>
      <div className="relative h-6">
        {hover !== null && points[hover] ? (
          <div className="absolute left-0 top-0 rounded-md bg-navy px-2 py-1 text-[11px] font-semibold text-white shadow" style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}>
            {points[hover].label}: {format(points[hover].value)}
          </div>
        ) : (
          <div className="text-[11px] text-slate-500">Total {format(total)} over {n} days · hover for daily values</div>
        )}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-navy">View as table</summary>
        <div className="mt-1 max-h-40 overflow-y-auto rounded border border-slate-200">
          <table className="w-full text-[11px]"><tbody>{points.map(p => <tr key={p.label} className="border-b border-slate-100 last:border-0"><td className="px-2 py-0.5 text-slate-600">{p.label}</td><td className="px-2 py-0.5 text-right tabular-nums text-navy">{format(p.value)}</td></tr>)}</tbody></table>
        </div>
      </details>
    </figure>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const s = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return s * p;
}
