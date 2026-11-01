import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import type { Page, ReviewItem, VariantHit } from '../api/types';
import { useToast } from '../components/toast';
import { Badge, Button, Empty, Loader, PageHeader, Pager, ReasonDialog, Segmented, StatusBadge, Thumb } from '../components/ui';
import { VariantPicker, variantLabel } from '../components/VariantPicker';
import { fmtAgo, fmtDateTime, fmtPercent, humanize } from '../lib/format';

type Status = ReviewItem['status'];
type Decision = { item: ReviewItem; kind: 'approve' | 'reassign' | 'reject' };
const LIMIT = 20;

export function ReviewQueue() {
  const [status, setStatus] = useState<Status>('pending');
  const [offset, setOffset] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);
  const q = useQuery({
    queryKey: ['review', status, offset],
    queryFn: () => api.get<Page<ReviewItem>>('/v1/admin/review-queue', { status, limit: LIMIT, offset }),
  });
  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle="Scans the AI wasn't sure about, couldn't match, or a player reported. Confirm the vehicle or reject the scan. Decisions never grant coins or XP: the player still adds the card themselves."
      />
      <div className="toolbar">
        <Segmented label="Status" value={status} onChange={(v) => { setStatus(v); setOffset(0); }}
          options={[
            { value: 'pending', label: 'Waiting' }, { value: 'approved', label: 'Approved' },
            { value: 'reassigned', label: 'Reassigned' }, { value: 'rejected', label: 'Rejected' },
          ]} />
      </div>
      <Loader q={q}>
        {(d) =>
          d.items.length === 0 ? (
            <Empty title={status === 'pending' ? 'Nothing waiting for review' : 'No decisions here yet'}>
              {status === 'pending' ? 'New low-confidence and reported scans will appear here.' : undefined}
            </Empty>
          ) : (
            <>
              <div className="review-list">
                {d.items.map((item) => <ReviewCard key={item.reviewId} item={item} onDecide={(kind) => setDecision({ item, kind })} />)}
              </div>
              <Pager offset={offset} limit={LIMIT} total={d.total} onChange={setOffset} />
            </>
          )
        }
      </Loader>
      {decision && <DecisionDialog decision={decision} onClose={() => setDecision(null)} />}
    </>
  );
}

function ReviewCard({ item, onDecide }: { item: ReviewItem; onDecide: (k: Decision['kind']) => void }) {
  const r = item.proposedVehicle;
  const pending = item.status === 'pending';
  return (
    <article className="review-card">
      <Thumb url={item.imageUrl} alt={`Scan ${item.captureId}`} size="lg" />
      <div className="review-body">
        <div className="review-top">
          <Badge tone="warn">{humanize(item.reason)}</Badge>
          <StatusBadge status={item.captureStatus} />
          <span className="faint small" title={fmtDateTime(item.createdAt)}>{fmtAgo(item.createdAt)}</span>
        </div>
        <h3 className="review-title">{item.proposedLabel ?? 'No catalogue match'}</h3>
        <dl className="kv tight">
          <div>
            <dt>AI said</dt>
            <dd>
              {r?.kind === 'vehicle'
                ? `${r.make} ${r.model}${r.variant ? ` ${r.variant}` : ''}${r.year ? ` (${r.year})` : ''}${r.color ? ` · ${r.color}` : ''}`
                : r ? humanize(r.kind === 'unavailable' && r.reason ? r.reason : r.kind) : '—'}
            </dd>
          </div>
          {r?.kind === 'vehicle' && r.alternatives?.length ? (
            <div><dt>Could also be</dt><dd>{r.alternatives.map((a) => `${a.make} ${a.model}`).join(', ')}</dd></div>
          ) : null}
          <div><dt>Confidence</dt><dd>{fmtPercent(item.confidence)}</dd></div>
          <div><dt>Model</dt><dd className="mono">{item.aiModel ?? '—'}</dd></div>
          <div><dt>Scanned by</dt><dd><Link to={`/users/${item.user.userId}`}>@{item.user.username}</Link></dd></div>
          {item.riskReasons.length > 0 && (
            <div><dt>Flags</dt><dd>{item.riskReasons.map((f) => <Badge key={f} tone="bad">{humanize(f)}</Badge>)}</dd></div>
          )}
          {!pending && (
            <div><dt>Decision</dt><dd>{item.decisionReason} <span className="faint">— @{item.reviewer}, {fmtDateTime(item.reviewedAt)}</span></dd></div>
          )}
        </dl>
        {pending && (
          <div className="review-actions">
            <Button kind="primary" disabled={!item.proposedModelVariantId} onClick={() => onDecide('approve')}
              title={item.proposedModelVariantId ? undefined : 'No catalogue match to approve; reassign instead'}>
              Approve match
            </Button>
            <Button onClick={() => onDecide('reassign')}>Choose another vehicle</Button>
            <Button kind="danger" onClick={() => onDecide('reject')}>Reject scan</Button>
            <Link className="link-btn" to={`/captures/${item.captureId}`}>Scan details</Link>
          </div>
        )}
      </div>
    </article>
  );
}

function DecisionDialog({ decision: { item, kind }, onClose }: { decision: Decision; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const r = item.proposedVehicle;
  const [variant, setVariant] = useState<VariantHit | null>(null);
  const m = useMutation({
    mutationFn: (reason: string) =>
      api.post(`/v1/admin/review-queue/${item.reviewId}/decision`, {
        decision: kind, reason, ...(kind === 'reassign' ? { modelVariantId: variant?.modelVariantId } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast(kind === 'reject' ? 'Scan rejected. The player was notified.' : 'Vehicle confirmed. The player can add the card.');
    },
  });
  const titles = { approve: 'Approve this match?', reassign: 'Choose the correct vehicle', reject: 'Reject this scan?' };
  return (
    <ReasonDialog
      title={titles[kind]}
      confirmLabel={kind === 'reject' ? 'Reject scan' : kind === 'approve' ? 'Approve' : 'Confirm vehicle'}
      danger={kind === 'reject'}
      onClose={onClose}
      onConfirm={async (reason) => {
        if (kind === 'reassign' && !variant) throw new Error('Choose a vehicle first.');
        await m.mutateAsync(reason);
      }}
      description={
        kind === 'approve' ? <>The scan will be confirmed as <strong>{item.proposedLabel}</strong>.</>
          : kind === 'reject' ? 'The player is told the scan was rejected and its photo is deleted.'
            : variant ? <>Selected: <strong>{variantLabel(variant)}</strong></> : 'Search the catalogue and pick the vehicle in the photo.'
      }
    >
      {kind === 'reassign' && (
        <VariantPicker value={variant} onChange={setVariant}
          initial={r?.kind === 'vehicle' ? `${r.make} ${r.model}`.split(' ').slice(-2).join(' ') : ''} />
      )}
    </ReasonDialog>
  );
}
