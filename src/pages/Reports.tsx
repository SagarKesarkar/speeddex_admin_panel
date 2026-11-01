import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import type { Page, Report } from '../api/types';
import { useToast } from '../components/toast';
import { Badge, Button, Empty, Loader, PageHeader, Pager, ReasonDialog, Segmented, StatusBadge } from '../components/ui';
import { fmtAgo, fmtDateTime, humanize } from '../lib/format';
import { useFilters } from '../lib/useFilters';

const LIMIT = 25;
type Decision = 'dismiss' | 'hide_content' | 'resolve';

export function Reports() {
  const { values, offset, set } = useFilters(['status'] as const);
  const status = values.status || 'open';
  const [act, setAct] = useState<{ report: Report; decision: Decision } | null>(null);
  const q = useQuery({
    queryKey: ['reports', status, offset],
    queryFn: () => api.get<Page<Report>>('/v1/admin/reports', { status, limit: LIMIT, offset }),
  });
  return (
    <>
      <PageHeader title="Reports" subtitle="Posts, comments, cards and players reported by the community. One decision settles every open report on the same item. Reporters aren't told the outcome." />
      <div className="toolbar">
        <Segmented label="Status" value={status} onChange={(v) => set({ status: v === 'open' ? '' : v })}
          options={[{ value: 'open', label: 'Open' }, { value: 'actioned', label: 'Actioned' }, { value: 'dismissed', label: 'Dismissed' }]} />
      </div>
      <Loader q={q}>
        {(d) =>
          d.items.length === 0 ? <Empty title={status === 'open' ? 'No open reports' : 'Nothing here yet'} /> : (
            <>
              <div className="report-list">
                {d.items.map((r) => (
                  <article key={r.reportId} className="report-card">
                    <div className="report-main">
                      <div className="row wrap">
                        <Badge tone="info">{humanize(r.targetType)} #{r.targetId}</Badge>
                        <Badge tone="warn">{humanize(r.reason)}</Badge>
                        {r.reportCount > 1 && <Badge tone="bad">{r.reportCount} reports</Badge>}
                        {r.targetStatus && <StatusBadge status={r.targetStatus} />}
                        <span className="faint small" title={fmtDateTime(r.createdAt)}>{fmtAgo(r.createdAt)}</span>
                      </div>
                      {r.targetText != null && <blockquote className="quote">{r.targetText || <span className="faint">(no text)</span>}</blockquote>}
                      {r.description && <p className="small">Reporter's note: “{r.description}”</p>}
                      <p className="faint small">
                        Reported by <Link to={`/users/${r.reporterId}`}>@{r.reporterUsername}</Link>
                        {r.targetUserId && <> · about <Link to={`/users/${r.targetUserId}`}>@{r.targetUsername ?? r.targetUserId}</Link></>}
                        {r.targetType === 'capture' && <> · <Link to={`/captures/${r.targetId}`}>open scan</Link></>}
                      </p>
                    </div>
                    {status === 'open' && (
                      <div className="report-actions">
                        {(r.targetType === 'post' || r.targetType === 'comment') && r.targetStatus === 'visible' && (
                          <Button kind="danger" onClick={() => setAct({ report: r, decision: 'hide_content' })}>Hide {r.targetType}</Button>
                        )}
                        <Button onClick={() => setAct({ report: r, decision: 'resolve' })}>Mark handled</Button>
                        <Button kind="ghost" onClick={() => setAct({ report: r, decision: 'dismiss' })}>Dismiss</Button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <Pager offset={offset} limit={LIMIT} total={d.total} onChange={(o) => set({ offset: o })} />
            </>
          )
        }
      </Loader>
      {act && <ReportDialog {...act} onClose={() => setAct(null)} />}
    </>
  );
}

function ReportDialog({ report, decision, onClose }: { report: Report; decision: Decision; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: (reason: string) => api.post<{ reportsClosed: number }>(`/v1/admin/reports/${report.reportId}/decision`, { decision, reason }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast(`${r.reportsClosed} report${r.reportsClosed === 1 ? '' : 's'} closed.`);
    },
  });
  const text = {
    hide_content: [`Hide this ${report.targetType}?`, 'It disappears from the feed for everyone. Open reports on it are closed as actioned.', `Hide ${report.targetType}`],
    resolve: ['Mark as handled?', 'Use this after acting elsewhere, for example suspending the player from their user page.', 'Mark handled'],
    dismiss: ['Dismiss this report?', 'Nothing changes for the reported item. Open reports on it are closed.', 'Dismiss'],
  }[decision];
  return <ReasonDialog title={text[0]!} description={text[1]} confirmLabel={text[2]!} danger={decision === 'hide_content'}
    onClose={onClose} onConfirm={(r) => m.mutateAsync(r)} />;
}
