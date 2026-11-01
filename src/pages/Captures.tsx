import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import type { Capture, CaptureDetail, Page } from '../api/types';
import { useToast } from '../components/toast';
import {
  Badge, Button, Empty, KV, Loader, PageHeader, Pager, Panel, ReasonDialog, SearchBox, Segmented, StatusBadge, Thumb,
} from '../components/ui';
import { fmtAgo, fmtDateTime, fmtNumber, fmtPercent, humanize } from '../lib/format';
import { useFilters } from '../lib/useFilters';

const LIMIT = 25;
const STATUSES = ['', 'identified', 'review_required', 'added_to_garage', 'rejected', 'failed', 'discarded', 'processing'] as const;

const vehicle = (c: Capture) => (c.candidate ? `${c.candidate.brand} ${c.candidate.model}` : null);

export function Captures() {
  const { values, offset, set } = useFilters(['status', 'flagged', 'search', 'userId'] as const);
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['captures', values, offset],
    queryFn: () =>
      api.get<Page<Capture>>('/v1/admin/captures', {
        status: values.status, flagged: values.flagged, search: values.search, userId: values.userId, limit: LIMIT, offset,
      }),
  });
  return (
    <>
      <PageHeader title="Captures" subtitle="Every scan, newest first. Photos of scans that never became cards are deleted automatically." />
      <div className="toolbar">
        <SearchBox value={values.search} onChange={(v) => set({ search: v })} placeholder="Player or vehicle" />
        <select className="input" aria-label="Status" value={values.status} onChange={(e) => set({ status: e.target.value })}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? humanize(s) : 'All statuses'}</option>)}
        </select>
        <Segmented label="Flags" value={values.flagged || 'any'} onChange={(v) => set({ flagged: v === 'any' ? '' : v })}
          options={[{ value: 'any', label: 'All' }, { value: 'true', label: 'Flagged' }, { value: 'false', label: 'Not flagged' }]} />
        {values.userId && <Button kind="ghost" onClick={() => set({ userId: '' })}>Player #{values.userId} ✕</Button>}
      </div>
      <Loader q={q}>
        {(d) =>
          d.items.length === 0 ? (
            <Empty title="No captures match these filters" />
          ) : (
            <Panel>
              <table className="table clickable">
                <thead>
                  <tr>
                    <th>Photo</th><th>Vehicle</th><th>Player</th><th>Status</th>
                    <th className="num">Confidence</th><th>AI model</th><th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {d.items.map((c) => (
                    <tr key={c.captureId} onClick={() => navigate(`/captures/${c.captureId}`)}>
                      <td><Thumb url={c.imageUrl} alt={`Scan ${c.captureId}`} size="sm" /></td>
                      <td>
                        <Link to={`/captures/${c.captureId}`} onClick={(e) => e.stopPropagation()}>{vehicle(c) ?? <span className="faint">No match</span>}</Link>
                        <div className="faint small">#{c.captureId}{c.riskReasons.length > 0 && ' · '}
                          {c.riskReasons.map((f) => <Badge key={f} tone="bad">{humanize(f)}</Badge>)}</div>
                      </td>
                      <td>@{c.user.username}</td>
                      <td><StatusBadge status={c.status} />{c.statusReason && <div className="faint small">{humanize(c.statusReason)}</div>}</td>
                      <td className="num">{fmtPercent(c.confidence)}</td>
                      <td className="mono small">{c.aiModel ?? '—'}</td>
                      <td title={fmtDateTime(c.createdAt)}>{fmtAgo(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager offset={offset} limit={LIMIT} total={d.total} onChange={(o) => set({ offset: o })} />
            </Panel>
          )
        }
      </Loader>
    </>
  );
}

export function CaptureView() {
  const id = Number(useParams().id);
  const qc = useQueryClient();
  const toast = useToast();
  const [action, setAction] = useState<'reject' | 'clear_flags' | null>(null);
  const q = useQuery({ queryKey: ['capture', id], queryFn: () => api.get<CaptureDetail>(`/v1/admin/captures/${id}`) });
  const m = useMutation({
    mutationFn: (v: { decision: 'reject' | 'clear_flags'; reason: string }) => api.post(`/v1/admin/captures/${id}/decision`, v),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['capture', id] });
      qc.invalidateQueries({ queryKey: ['captures'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast(v.decision === 'reject' ? 'Scan rejected.' : 'Flags cleared.');
    },
  });
  return (
    <>
      <PageHeader title={`Capture #${id}`} subtitle={<Link to="/captures">← All captures</Link>} />
      <Loader q={q}>
        {(c) => {
          const rejectable = ['uploaded', 'identified', 'review_required', 'failed'].includes(c.status);
          const r = c.recognition;
          return (
            <div className="detail-grid">
              <Panel>
                <Thumb url={c.imageUrl} alt={`Scan ${c.captureId}`} size="lg" />
                <p className="faint small">Faces and number plates are blurred on the phone before upload.</p>
              </Panel>
              <div className="stack">
                <Panel title="Scan" actions={
                  <div className="row">
                    {c.riskReasons.length > 0 && <Button onClick={() => setAction('clear_flags')}>Clear flags</Button>}
                    <Button kind="danger" disabled={!rejectable} onClick={() => setAction('reject')}
                      title={rejectable ? undefined : 'Only scans not yet in a garage can be rejected'}>Reject scan</Button>
                  </div>
                }>
                  <KV items={[
                    ['Status', <><StatusBadge status={c.status} /> {c.statusReason && <span className="faint">{humanize(c.statusReason)}</span>}</>],
                    ['Player', <Link to={`/users/${c.user.userId}`}>@{c.user.username}</Link>],
                    ['Matched vehicle', c.candidate ? `${c.candidate.brand} ${c.candidate.model} · ${c.candidate.variant} (${c.candidate.modelYear})` : 'No catalogue match'],
                    ['Confidence', fmtPercent(c.confidence)],
                    ['AI model', <span className="mono">{c.aiModel ?? '—'}</span>],
                    ['Flags', c.riskReasons.length ? c.riskReasons.map((f) => <Badge key={f} tone="bad">{humanize(f)}</Badge>) : 'None'],
                    ['Camera', humanize(c.cameraSource)],
                    ['Photo size', c.imageBytes ? `${fmtNumber(Math.round(c.imageBytes / 1024))} KB` : '—'],
                    ['Location sent', c.hasLocation ? 'Yes (not shown here)' : 'No'],
                    ['Created', fmtDateTime(c.createdAt)],
                    ['Updated', fmtDateTime(c.updatedAt)],
                  ]} />
                </Panel>
                <Panel title="What the AI answered">
                  {r?.kind === 'vehicle' ? (
                    <KV items={[
                      ['Vehicle', `${r.make} ${r.model}${r.variant ? ` ${r.variant}` : ''}`],
                      ['Year', r.year ?? '—'],
                      ['Colour', r.color ?? '—'],
                      ['Confidence', fmtPercent(r.confidence)],
                      ['Could also be', r.alternatives?.length ? r.alternatives.map((a) => `${a.make} ${a.model}`).join(', ') : '—'],
                    ]} />
                  ) : (
                    <p>{r ? humanize(r.kind === 'unavailable' && r.reason ? r.reason : r.kind) : 'No answer recorded.'}</p>
                  )}
                </Panel>
                {c.review && (
                  <Panel title="Review">
                    <KV items={[
                      ['Queued because', humanize(c.review.reason)],
                      ['Status', <StatusBadge status={c.review.status} />],
                      ['Decision', c.review.decisionReason ?? '—'],
                      ['Reviewed', fmtDateTime(c.review.reviewedAt)],
                    ]} />
                    {c.review.status === 'pending' && <Link to="/review" className="link-btn">Open the review queue →</Link>}
                  </Panel>
                )}
                {c.history.length > 0 && (
                  <Panel title="Admin history">
                    <ul className="timeline">
                      {c.history.map((h) => <li key={h.auditId}><strong>{humanize(h.action)}</strong> — {h.reason} <span className="faint">@{h.actor}, {fmtDateTime(h.createdAt)}</span></li>)}
                    </ul>
                  </Panel>
                )}
              </div>
            </div>
          );
        }}
      </Loader>
      {action && (
        <ReasonDialog
          title={action === 'reject' ? 'Reject this scan?' : 'Clear the flags on this scan?'}
          description={action === 'reject'
            ? 'The player is told the scan was rejected, can no longer add it, and its photo is deleted.'
            : 'Use this when you have checked the scan and the flags were a false alarm.'}
          confirmLabel={action === 'reject' ? 'Reject scan' : 'Clear flags'}
          danger={action === 'reject'}
          onClose={() => setAction(null)}
          onConfirm={(reason) => m.mutateAsync({ decision: action, reason })}
        />
      )}
    </>
  );
}
