import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api';
import { RARITIES, type Stats } from '../api/types';
import { BarList, ColumnChart } from '../components/charts';
import { Loader, PageHeader, Panel } from '../components/ui';
import { cap, fmtNumber, fmtPercent, humanize } from '../lib/format';

const dayLabel = (iso: string) => String(Number(iso.slice(8, 10)));
const dayLong = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function Dashboard() {
  const q = useQuery({ queryKey: ['stats'], queryFn: () => api.get<Stats>('/v1/admin/stats'), refetchInterval: 60_000 });
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Activity across SpeedDex. Counts refresh every minute; days are UTC." />
      <Loader q={q}>
        {(s) => {
          const t = s.totals;
          const limited = s.unresolvedReasons7d.find((r) => r.reason === 'provider_http_429');
          return (
            <>
              <div className="tiles">
                <Tile label="Players" value={t.users} note={`+${fmtNumber(t.newUsers7d)} this week`} />
                <Tile label="Cards collected" value={t.cards} />
                <Tile label="Scans today" value={t.capturesToday} />
                <Tile label="Waiting for review" value={t.pendingReviews} to="/review" attention={t.pendingReviews > 0} />
                <Tile label="Open reports" value={t.openReports} to="/reports" attention={t.openReports > 0} />
                <Tile label="Flagged scans (7 d)" value={t.flaggedCaptures7d} to="/captures?flagged=true" />
              </div>

              {limited && (
                <div className="callout warn" role="note">
                  <strong>The AI hit its daily limit {fmtNumber(limited.count)} times this week.</strong> Those scans went to the
                  review queue. Gemini's free tier allows about 20 requests a day per model; enabling billing on the Google
                  AI key removes the limit.
                </div>
              )}

              <div className="grid-2">
                <Panel>
                  <ColumnChart title="Scans per day" unit="scans"
                    points={s.daily.map((d) => ({ label: dayLabel(d.day), sub: dayLong(d.day), value: d.captures }))} />
                </Panel>
                <Panel>
                  <ColumnChart title="New cards per day" unit="cards"
                    points={s.daily.map((d) => ({ label: dayLabel(d.day), sub: dayLong(d.day), value: d.cards }))} />
                </Panel>
              </div>

              <div className="grid-3">
                <Panel>
                  <BarList title="Scan outcomes, last 7 days" empty="No scans this week."
                    rows={s.captureStatus7d.map((r) => ({ label: humanize(r.status), value: r.count }))} />
                </Panel>
                <Panel>
                  <BarList title="Why scans weren't identified (7 d)" empty="Every scan this week got a result."
                    rows={s.unresolvedReasons7d.map((r) => ({ label: humanize(r.reason), value: r.count }))} />
                </Panel>
                <Panel>
                  <BarList title="Cards by rarity" empty="No cards yet."
                    rows={RARITIES.map((r) => ({ label: cap(r), value: s.cardsByRarity.find((x) => x.rarity === r)?.count ?? 0 }))
                      .filter((r) => r.value > 0)} />
                </Panel>
              </div>

              <Panel title="Recognition models, last 7 days">
                {s.recognitionModels7d.length === 0 ? (
                  <p className="muted small">No identifications this week.</p>
                ) : (
                  <table className="table">
                    <thead><tr><th>Model</th><th className="num">Scans answered</th><th className="num">Average confidence</th></tr></thead>
                    <tbody>
                      {s.recognitionModels7d.map((m) => (
                        <tr key={m.model}><td className="mono">{m.model}</td><td className="num">{fmtNumber(m.count)}</td><td className="num">{fmtPercent(m.avgConfidence)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            </>
          );
        }}
      </Loader>
    </>
  );
}

function Tile({ label, value, note, to, attention }: { label: string; value: number; note?: string; to?: string; attention?: boolean }) {
  const body = (
    <>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{fmtNumber(value)}</div>
      {note && <div className="tile-note">{note}</div>}
    </>
  );
  const cls = `tile ${attention ? 'attention' : ''}`;
  return to ? <Link to={to} className={`${cls} tile-link`}>{body}</Link> : <div className={cls}>{body}</div>;
}
