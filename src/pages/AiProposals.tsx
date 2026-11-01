import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { BODY_STYLES, RARITIES, type Page } from '../api/types';
import { useToast } from '../components/toast';
import { Badge, Button, Empty, ErrorNote, Field, Loader, PageHeader, Panel, ReasonDialog, Spinner, type Tone } from '../components/ui';
import { bodyLabel, cap, fmtAgo, fmtDateTime, humanize } from '../lib/format';

/** Shapes from /v1/admin/catalog/proposals (Backend/src/modules/admin-proposals.ts). */
type Variant = {
  modelVariantName: string; modelYear: number; modelYearEnd: number | null; fuelType: string | null;
  engineDisplacementCc: number | null; engineCylinders: number | null; engineConfiguration: string | null;
  inductionType: string | null; horsepowerHp: number | null; torqueNm: number | null; topSpeedMph: number | null;
  acceleration0To60Mph: number | null; transmissionType: string | null; numberOfGears: number | null;
  drivetrain: string | null; seatingCapacity: number | null; doorCount: number | null; lengthMm: number | null;
  widthMm: number | null; heightMm: number | null; wheelbaseMm: number | null; curbWeightKg: number | null;
  batteryCapacityKwh: number | null; evRangeMiles: number | null;
};
type Proposal = {
  brand: { name: string; countryOfOrigin: string | null };
  model: {
    name: string; vehicleCategory: string | null; bodyStyle: (typeof BODY_STYLES)[number]; rarity: (typeof RARITIES)[number];
    introductionYear: number | null; discontinuedYear: number | null; summary: string | null;
  };
  variants: Variant[];
  notes: string[];
};
type Item = {
  proposalId: number; query: string; status: 'researching' | 'ready' | 'failed' | 'approved' | 'rejected';
  proposal: Proposal | null; sources: { url: string; title: string | null }[]; aiModel: string | null;
  failureReason: string | null; createdBy: string | null; reviewedBy: string | null; reviewReason: string | null;
  createdModelId: number | null; createdAt: string; updatedAt: string; reviewedAt: string | null;
  catalogue?: { brandId: number | null; modelId: number | null; existingVariants: { name: string; modelYear: number }[]; variantsAlreadyThere: string[] };
};

const TONE: Record<Item['status'], Tone> = { researching: 'info', ready: 'warn', failed: 'bad', approved: 'good', rejected: 'muted' };
const LABEL: Record<Item['status'], string> = {
  researching: 'Researching', ready: 'Waiting for review', failed: 'Research failed', approved: 'Added', rejected: 'Rejected',
};

/** Failure codes from the researcher, in words. */
function failure(reason: string | null) {
  if (!reason) return 'Unknown error.';
  if (reason === 'ai_quota_exceeded') {
    return 'Google refused the web search this research needs. Grounding with Google Search is not included in the Gemini free tier, whatever tokens are left, so it needs billing enabled on the Google AI key (ai.dev). Car recognition is not affected.';
  }
  if (reason.startsWith('ai_http_429')) return 'Google is limiting requests right now. Wait a minute and try again.';
  if (reason === 'not_a_production_car') return 'The AI could not find a production car with that name. Check the spelling.';
  if (reason === 'ai_not_configured') return 'No Gemini API key is configured on the server.';
  if (reason === 'research_timeout' || reason === 'ai_timeout') return 'The research took too long. Try again.';
  if (reason.startsWith('ai_invalid_fields')) return `The AI's answer had invalid values (${reason.split(': ')[1] ?? ''}). Try again.`;
  return humanize(reason);
}

export function AiProposals() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api.get<Page<Item>>('/v1/admin/catalog/proposals', { limit: 50 }),
    // Keep checking while anything is still being researched.
    refetchInterval: (q) => (q.state.data?.items.some((i) => i.status === 'researching') ? 3000 : false),
  });
  const start = useMutation({
    mutationFn: (q: string) => api.post<{ proposalId: number }>('/v1/admin/catalog/proposals', { query: q }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
      navigate(`/catalog/ai/${r.proposalId}`);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 3) start.mutate(query.trim());
  };

  return (
    <>
      <PageHeader
        title="Add a car with AI"
        subtitle={<>Name a car and the AI researches it on the web: brand, model and every generation with its specs. You check and correct the result; nothing is added to the catalogue until you approve it. <Link to="/catalog">← Catalogue</Link></>}
      />
      <Panel>
        <form className="row wrap" onSubmit={submit}>
          <input className="input grow" style={{ minWidth: 260 }} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Brand and model, e.g. Tata Curvv" aria-label="Brand and model" maxLength={80} />
          <Button kind="primary" type="submit" busy={start.isPending} disabled={query.trim().length < 3}>Research</Button>
        </form>
        {start.error != null && <ErrorNote error={start.error} />}
      </Panel>
      <div style={{ height: 16 }} />
      <Loader q={list}>
        {(d) => d.items.length === 0 ? <Empty title="No research yet">Researched cars appear here for review.</Empty> : (
          <Panel title="Research">
            <table className="table clickable">
              <thead><tr><th>Car</th><th>Status</th><th>By</th><th>Started</th></tr></thead>
              <tbody>
                {d.items.map((p) => (
                  <tr key={p.proposalId} onClick={() => navigate(`/catalog/ai/${p.proposalId}`)}>
                    <td><Link to={`/catalog/ai/${p.proposalId}`} onClick={(e) => e.stopPropagation()}>{p.query}</Link></td>
                    <td><Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge></td>
                    <td>@{p.createdBy}</td>
                    <td title={fmtDateTime(p.createdAt)}>{fmtAgo(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </Loader>
    </>
  );
}

/** Variant fields shown for review: label, key, kind. */
const VARIANT_FIELDS: [string, keyof Variant, 'text' | 'int' | 'num'][] = [
  ['Generation', 'modelVariantName', 'text'], ['From', 'modelYear', 'int'], ['To', 'modelYearEnd', 'int'],
  ['Fuel', 'fuelType', 'text'], ['Engine (cc)', 'engineDisplacementCc', 'int'], ['Cylinders', 'engineCylinders', 'int'],
  ['Layout', 'engineConfiguration', 'text'], ['Induction', 'inductionType', 'text'], ['Power (hp)', 'horsepowerHp', 'int'],
  ['Torque (Nm)', 'torqueNm', 'int'], ['Top speed (mph)', 'topSpeedMph', 'int'], ['0–60 (s)', 'acceleration0To60Mph', 'num'],
  ['Gearbox', 'transmissionType', 'text'], ['Gears', 'numberOfGears', 'int'], ['Drivetrain', 'drivetrain', 'text'],
  ['Seats', 'seatingCapacity', 'int'], ['Doors', 'doorCount', 'int'], ['Length (mm)', 'lengthMm', 'int'],
  ['Width (mm)', 'widthMm', 'int'], ['Height (mm)', 'heightMm', 'int'], ['Wheelbase (mm)', 'wheelbaseMm', 'int'],
  ['Kerb weight (kg)', 'curbWeightKg', 'int'], ['Battery (kWh)', 'batteryCapacityKwh', 'num'], ['EV range (mi)', 'evRangeMiles', 'int'],
];

const asValue = (kind: 'text' | 'int' | 'num', s: string): string | number | null => {
  const t = s.trim();
  if (t === '') return null;
  if (kind === 'text') return t;
  const n = Number(t);
  return Number.isFinite(n) ? n : (t as unknown as number); // the server reports anything invalid
};

export function ProposalReview() {
  const id = Number(useParams().id);
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Proposal | null>(null);
  const [dirty, setDirty] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const q = useQuery({
    queryKey: ['proposal', id],
    queryFn: () => api.get<Item>(`/v1/admin/catalog/proposals/${id}`),
    refetchInterval: (s) => (s.state.data?.status === 'researching' ? 3000 : false),
  });
  useEffect(() => {
    if (q.data?.proposal && !dirty) setDraft(q.data.proposal);
  }, [q.data, dirty]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['proposal', id] });
    qc.invalidateQueries({ queryKey: ['proposals'] });
  };
  const save = useMutation({
    mutationFn: (p: Proposal) => api.patch<Item>(`/v1/admin/catalog/proposals/${id}`, { proposal: p }),
    onSuccess: () => { setDirty(false); refresh(); toast('Changes saved.'); },
  });
  const retry = useMutation({
    mutationFn: () => api.post(`/v1/admin/catalog/proposals/${id}/retry`),
    onSuccess: refresh,
  });

  const edit = (f: (p: Proposal) => Proposal) => {
    setDraft((d) => (d ? f(structuredClone(d)) : d));
    setDirty(true);
  };

  return (
    <Loader q={q}>
      {(p) => (
        <>
          <PageHeader
            title={p.query}
            subtitle={<><Link to="/catalog/ai">← All research</Link> · started by @{p.createdBy} {fmtAgo(p.createdAt)}{p.aiModel && <> · <span className="mono">{p.aiModel}</span></>}</>}
            actions={<Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge>}
          />

          {p.status === 'researching' && (
            <Panel><Spinner label="Researching on the web… this usually takes 20–60 seconds." /></Panel>
          )}

          {p.status === 'failed' && (
            <Panel title="Research failed" actions={
              <div className="row">
                <Button onClick={() => setDecision('reject')}>Discard</Button>
                <Button kind="primary" busy={retry.isPending} onClick={() => retry.mutate()}>Try again</Button>
              </div>
            }>
              <p>{failure(p.failureReason)}</p>
              {retry.error != null && <ErrorNote error={retry.error} />}
            </Panel>
          )}

          {(p.status === 'approved' || p.status === 'rejected') && (
            <Panel>
              <p>
                {p.status === 'approved' ? 'Added to the catalogue' : 'Rejected'} by @{p.reviewedBy} on {fmtDateTime(p.reviewedAt)}: “{p.reviewReason}”.
                {p.createdModelId && <> <Link to={`/catalog/models/${p.createdModelId}`}>Open the model →</Link></>}
              </p>
            </Panel>
          )}

          {draft && (
            <div className="stack" style={{ marginTop: 16 }}>
              {p.status === 'ready' && p.catalogue && (
                <div className="callout info" role="note">
                  {p.catalogue.modelId
                    ? <>This model is already in the catalogue (<Link to={`/catalog/models/${p.catalogue.modelId}`}>open it</Link>). Approving adds only the generations it doesn't have{p.catalogue.variantsAlreadyThere.length ? <>; these are already there and will be skipped: {p.catalogue.variantsAlreadyThere.join(', ')}</> : null}.</>
                    : p.catalogue.brandId
                      ? 'The brand exists; approving adds a new model and its generations.'
                      : 'Approving adds a new brand, model and generations.'}
                </div>
              )}

              {draft.notes.length > 0 && (
                <Panel title="Check these">
                  <ul className="timeline">{draft.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                </Panel>
              )}

              <Panel title="Brand and model">
                <div className="form-grid">
                  <TextField label="Brand" value={draft.brand.name} disabled={p.status !== 'ready'} onChange={(v) => edit((d) => { d.brand.name = v; return d; })} />
                  <TextField label="Country of origin" value={draft.brand.countryOfOrigin ?? ''} disabled={p.status !== 'ready'} onChange={(v) => edit((d) => { d.brand.countryOfOrigin = v || null; return d; })} />
                  <TextField label="Model" value={draft.model.name} disabled={p.status !== 'ready'} onChange={(v) => edit((d) => { d.model.name = v; return d; })} />
                  <TextField label="Category" value={draft.model.vehicleCategory ?? ''} disabled={p.status !== 'ready'} onChange={(v) => edit((d) => { d.model.vehicleCategory = v || null; return d; })} />
                  <SelectField label="Body style" value={draft.model.bodyStyle} options={BODY_STYLES} labelOf={bodyLabel} disabled={p.status !== 'ready'} onChange={(v) => edit((d) => { d.model.bodyStyle = v as Proposal['model']['bodyStyle']; return d; })} />
                  <SelectField label="Rarity (sets the XP of new cards)" value={draft.model.rarity} options={RARITIES} disabled={p.status !== 'ready'} onChange={(v) => edit((d) => { d.model.rarity = v as Proposal['model']['rarity']; return d; })} />
                  <TextField label="Introduced" value={draft.model.introductionYear?.toString() ?? ''} disabled={p.status !== 'ready'} onChange={(v) => edit((d) => { d.model.introductionYear = asValue('int', v) as number | null; return d; })} />
                  <TextField label="Discontinued" value={draft.model.discontinuedYear?.toString() ?? ''} disabled={p.status !== 'ready'} onChange={(v) => edit((d) => { d.model.discontinuedYear = asValue('int', v) as number | null; return d; })} />
                  <div className="span-2">
                    <Field label="Summary">
                      {(fid) => <textarea id={fid} className="input" rows={3} value={draft.model.summary ?? ''} disabled={p.status !== 'ready'} onChange={(e) => edit((d) => { d.model.summary = e.target.value || null; return d; })} />}
                    </Field>
                  </div>
                </div>
              </Panel>

              {draft.variants.map((v, vi) => (
                <Panel key={vi} title={`Generation ${vi + 1}: ${v.modelVariantName} (${v.modelYear}–${v.modelYearEnd ?? 'now'})`}
                  actions={p.status === 'ready' && draft.variants.length > 1 && (
                    <Button kind="ghost" onClick={() => edit((d) => { d.variants.splice(vi, 1); return d; })}>Remove</Button>
                  )}>
                  <div className="variant-grid">
                    {VARIANT_FIELDS.map(([label, key, kind]) => (
                      <TextField key={key} label={label} value={v[key]?.toString() ?? ''} disabled={p.status !== 'ready'}
                        placeholder="—" onChange={(val) => edit((d) => { (d.variants[vi] as Record<string, unknown>)[key] = asValue(kind, val); return d; })} />
                    ))}
                  </div>
                </Panel>
              ))}

              <Panel title={`Sources (${p.sources.length})`}>
                {p.sources.length === 0 ? <p className="muted small">The AI didn't return source links. Check the figures yourself before approving.</p> : (
                  <ul className="timeline">
                    {p.sources.map((s) => (
                      <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title ?? s.url}</a></li>
                    ))}
                  </ul>
                )}
              </Panel>

              {p.status === 'ready' && (
                <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
                  {save.error != null && <ErrorNote error={save.error} />}
                  <Button onClick={() => setDecision('reject')}>Reject</Button>
                  <Button disabled={!dirty} busy={save.isPending} onClick={() => save.mutate(draft)}>Save changes</Button>
                  <Button kind="primary" onClick={() => setDecision('approve')}>Approve and add</Button>
                </div>
              )}
            </div>
          )}

          {decision && (
            <ReasonDialog
              title={decision === 'approve' ? `Add ${draft?.brand.name ?? ''} ${draft?.model.name ?? ''} to the catalogue?` : 'Reject this research?'}
              description={decision === 'approve'
                ? 'Scans will be able to match this car straight away. Unsaved changes are saved first.'
                : 'Nothing is added to the catalogue.'}
              confirmLabel={decision === 'approve' ? 'Approve and add' : 'Reject'}
              danger={decision === 'reject'}
              onClose={() => setDecision(null)}
              onConfirm={async (reason) => {
                if (decision === 'approve') {
                  if (dirty && draft) {
                    await api.patch(`/v1/admin/catalog/proposals/${id}`, { proposal: draft });
                    setDirty(false);
                  }
                  const r = await api.post<{ created: { brand: boolean; model: boolean; variants: number[]; skipped: string[] } }>(
                    `/v1/admin/catalog/proposals/${id}/approve`, { reason },
                  );
                  toast(`Added: ${[r.created.brand && 'brand', r.created.model && 'model', `${r.created.variants.length} generation(s)`].filter(Boolean).join(', ')}.`);
                } else {
                  await api.post(`/v1/admin/catalog/proposals/${id}/reject`, { reason });
                  toast('Research rejected.');
                }
                refresh();
                qc.invalidateQueries({ queryKey: ['models'] });
                qc.invalidateQueries({ queryKey: ['brands'] });
              }}
            />
          )}
        </>
      )}
    </Loader>
  );
}

function TextField({ label, value, onChange, disabled, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
  return (
    <Field label={label}>
      {(fid) => <input id={fid} className="input" value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

function SelectField({ label, value, options, onChange, disabled, labelOf = cap }: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void; disabled?: boolean;
  labelOf?: (v: string) => string;
}) {
  return (
    <Field label={label}>
      {(fid) => (
        <select id={fid} className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{labelOf(o)}</option>)}
        </select>
      )}
    </Field>
  );
}

