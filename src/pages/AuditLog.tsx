import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import type { AuditEntry, Page } from '../api/types';
import { Empty, Loader, PageHeader, Pager, Panel } from '../components/ui';
import { fmtDateTime, humanize } from '../lib/format';
import { useFilters } from '../lib/useFilters';

const LIMIT = 30;
const TARGETS = ['user', 'capture', 'brand', 'model', 'variant', 'post', 'comment', 'card', 'coin_offer', 'garage_offer'];
const ACTIONS = ['review_', 'capture_', 'user_', 'coins_', 'report_', 'catalog_', 'alias_', 'offer_'];

/** Where an audit target can be opened in the console, if anywhere. */
function targetLink(e: AuditEntry) {
  if (e.targetType === 'user') return `/users/${e.targetId}`;
  if (e.targetType === 'capture') return `/captures/${e.targetId}`;
  if (e.targetType === 'model') return `/catalog/models/${e.targetId}`;
  return null;
}

export function AuditLog() {
  const { values, offset, set } = useFilters(['targetType', 'targetId', 'action'] as const);
  const [open, setOpen] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ['audit', values, offset],
    queryFn: () => api.get<Page<AuditEntry>>('/v1/admin/audit-log', { ...values, limit: LIMIT, offset }),
  });
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin and moderator change, with who made it and why. Entries can't be edited or deleted." />
      <div className="toolbar">
        <select className="input" aria-label="Target type" value={values.targetType} onChange={(e) => set({ targetType: e.target.value, targetId: '' })}>
          <option value="">Everything</option>
          {TARGETS.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
        </select>
        {values.targetType && (
          <input className="input narrow" inputMode="numeric" placeholder="ID" aria-label="Target ID" value={values.targetId}
            onChange={(e) => set({ targetId: e.target.value.replace(/\D/g, '') })} />
        )}
        <select className="input" aria-label="Action" value={values.action} onChange={(e) => set({ action: e.target.value })}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{humanize(a.slice(0, -1))}</option>)}
        </select>
      </div>
      <Loader q={q}>
        {(d) => d.items.length === 0 ? <Empty title="No entries" /> : (
          <Panel>
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Reason</th><th /></tr></thead>
              <tbody>
                {d.items.map((e) => {
                  const link = targetLink(e);
                  return (
                    <Fragment key={e.auditId}>
                      <tr>
                        <td className="nowrap">{fmtDateTime(e.createdAt)}</td>
                        <td><Link to={`/users/${e.actorId}`}>@{e.actorUsername ?? e.actorId}</Link></td>
                        <td>{humanize(e.action)}</td>
                        <td>{link ? <Link to={link}>{humanize(e.targetType)} #{e.targetId}</Link> : `${humanize(e.targetType)} #${e.targetId}`}</td>
                        <td>{e.reason}</td>
                        <td>
                          {(e.before != null || e.after != null) && (
                            <button type="button" className="link-btn" aria-expanded={open === e.auditId}
                              onClick={() => setOpen(open === e.auditId ? null : e.auditId)}>
                              {open === e.auditId ? 'Hide' : 'Changes'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {open === e.auditId && (
                        <tr className="expanded">
                          <td colSpan={6}>
                            <Diff before={e.before} after={e.after} />
                            {e.requestId && <div className="faint small mono">Request {e.requestId}</div>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <Pager offset={offset} limit={LIMIT} total={d.total} onChange={(o) => set({ offset: o })} />
          </Panel>
        )}
      </Loader>
    </>
  );
}

/** Field-by-field before/after; on edits, only the fields that changed. */
function Diff({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const show = (v: unknown) => (v === undefined ? '' : JSON.stringify(v));
  const rows = before == null || after == null ? keys : keys.filter((k) => show(b[k]) !== show(a[k]));
  if (!rows.length) return <p className="faint small">No field changes.</p>;
  return (
    <table className="table compact diff">
      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
      <tbody>{rows.map((k) => <tr key={k}><td className="mono">{k}</td><td className="mono neg">{show(b[k])}</td><td className="mono pos">{show(a[k])}</td></tr>)}</tbody>
    </table>
  );
}
