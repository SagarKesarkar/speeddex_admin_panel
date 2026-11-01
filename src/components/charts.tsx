import { useState } from 'react';
import { fmtNumber } from '../lib/format';

/**
 * Single-series charts. One hue (--series-1, validated against the panel
 * surface), thin bars with rounded data ends on a shared baseline, a hover/
 * focus tooltip on each bar, and a table view with the same numbers.
 */

type Point = { label: string; sub?: string; value: number };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

export function ColumnChart({ title, points, unit }: { title: string; points: Point[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const W = 560, H = 180, padL = 32, padB = 22, padT = 8;
  const plotW = W - padL, plotH = H - padB - padT;
  const step = plotW / points.length;
  const barW = Math.min(22, step - 4);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const h = hover != null ? points[hover] : null;

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        <button type="button" className="link-btn" onClick={() => setTable((t) => !t)}>{table ? 'Show chart' : 'Show table'}</button>
      </figcaption>
      {table ? (
        <table className="table compact">
          <thead><tr><th>Day</th><th className="num">{unit}</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.label}><td>{p.sub ?? p.label}</td><td className="num">{fmtNumber(p.value)}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="chart-plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: bar chart, ${points.length} days`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="grid" />
                <text x={padL - 6} y={y(t) + 4} className="axis" textAnchor="end">{fmtNumber(t)}</text>
              </g>
            ))}
            {points.map((p, i) => {
              const x = padL + i * step + (step - barW) / 2;
              const top = y(p.value);
              const hgt = H - padB - top;
              return (
                <g key={p.label}>
                  {p.value > 0 && <path className={`bar ${hover === i ? 'on' : ''}`} d={roundedTop(x, top, barW, hgt, 4)} />}
                  {(i % 2 === points.length % 2 || points.length <= 7) && (
                    <text x={x + barW / 2} y={H - 6} className="axis" textAnchor="middle">{p.label}</text>
                  )}
                  {/* The hit target is the whole column, larger than the bar. */}
                  <rect x={padL + i * step} y={padT} width={step} height={plotH} className="hit" tabIndex={0}
                    aria-label={`${p.sub ?? p.label}: ${p.value} ${unit}`}
                    onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
                </g>
              );
            })}
          </svg>
          {h && hover != null && (
            <div className="tooltip" style={{ left: `${((padL + hover * step + step / 2) / W) * 100}%` }}>
              <strong>{fmtNumber(h.value)}</strong> <span>{unit}</span>
              <div className="faint">{h.sub ?? h.label}</div>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

/** Bar path with rounded data end (top) and a square baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/** Horizontal bars with the value written at the end: for a few named categories. */
export function BarList({ title, rows, empty }: { title: string; rows: { label: string; value: number; note?: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="chart">
      <figcaption className="chart-head"><span className="chart-title">{title}</span></figcaption>
      {rows.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <ul className="barlist">
          {rows.map((r) => (
            <li key={r.label} title={`${r.label}: ${r.value}`}>
              <span className="barlist-label">{r.label}</span>
              <span className="barlist-track">
                <span className="barlist-bar" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
              </span>
              <span className="barlist-value">{fmtNumber(r.value)}{r.note && <span className="faint"> {r.note}</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
