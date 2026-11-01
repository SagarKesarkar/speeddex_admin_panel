import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { BODY_STYLES, RARITIES, type Brand, type Model, type ModelDetail, type Page, type Variant } from '../api/types';
import { useIsAdmin } from '../auth';
import { FormDialog, type FieldSpec } from '../components/FormDialog';
import { useToast } from '../components/toast';
import { Badge, Button, Empty, KV, Loader, PageHeader, Pager, Panel, ReasonDialog, SearchBox, StatusBadge } from '../components/ui';
import { bodyLabel, cap, fmtNumber } from '../lib/format';
import { useFilters } from '../lib/useFilters';
import { VariantPhotosDialog } from '../components/VariantPhotos';

const LIMIT = 30;
const opts = (xs: readonly string[], label = cap) => xs.map((x) => ({ value: x, label: label(x) }));

const BRAND_FIELDS: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'countryOfOrigin', label: 'Country of origin', type: 'text' },
  { key: 'isActive', label: 'Active (offered to recognition and players)', type: 'checkbox' },
];
const MODEL_FIELDS: FieldSpec[] = [
  { key: 'name', label: 'Model name', type: 'text', required: true, hint: 'Without the brand, e.g. "Creta".' },
  { key: 'rarity', label: 'Rarity', type: 'select', options: opts(RARITIES), required: true, hint: 'Shown on every card of this model, old and new.' },
  { key: 'bodyStyle', label: 'Body style', type: 'select', options: opts(BODY_STYLES, bodyLabel), required: true },
  { key: 'vehicleCategory', label: 'Category', type: 'text', hint: 'e.g. SUV, Sedan, Hatchback' },
  { key: 'introductionYear', label: 'Introduced', type: 'number' },
  { key: 'discontinuedYear', label: 'Discontinued', type: 'number' },
  { key: 'summary', label: 'Summary', type: 'textarea' },
  { key: 'isActive', label: 'Active', type: 'checkbox' },
];
const VARIANT_FIELDS: FieldSpec[] = [
  { key: 'modelVariantName', label: 'Variant / generation', type: 'text', required: true },
  { key: 'modelYear', label: 'First year', type: 'number', required: true },
  { key: 'modelYearEnd', label: 'Last year', type: 'number', hint: 'Empty if still on sale.' },
  { key: 'xpReward', label: 'XP reward', type: 'number', required: true, hint: 'For new cards; existing cards keep theirs.' },
  { key: 'fuelType', label: 'Fuel', type: 'text' },
  { key: 'engineDisplacementCc', label: 'Engine (cc)', type: 'number' },
  { key: 'engineCylinders', label: 'Cylinders', type: 'number' },
  { key: 'horsepowerHp', label: 'Power (hp)', type: 'number' },
  { key: 'torqueNm', label: 'Torque (Nm)', type: 'number' },
  { key: 'topSpeedMph', label: 'Top speed (mph)', type: 'number' },
  { key: 'acceleration0To60Mph', label: '0–60 mph (s)', type: 'decimal' },
  { key: 'transmissionType', label: 'Transmission', type: 'text' },
  { key: 'drivetrain', label: 'Drivetrain', type: 'text', hint: 'FWD, RWD, AWD, 4WD' },
  { key: 'seatingCapacity', label: 'Seats', type: 'number' },
  { key: 'doorCount', label: 'Doors', type: 'number' },
  { key: 'curbWeightKg', label: 'Kerb weight (kg)', type: 'number' },
  { key: 'numberOfGears', label: 'Gears', type: 'number' },
  { key: 'lengthMm', label: 'Length (mm)', type: 'number' },
  { key: 'widthMm', label: 'Width (mm)', type: 'number' },
  { key: 'heightMm', label: 'Height (mm)', type: 'number' },
  { key: 'wheelbaseMm', label: 'Wheelbase (mm)', type: 'number' },
  { key: 'isActive', label: 'Active', type: 'checkbox' },
];

export function Catalog() {
  const { values, offset, set } = useFilters(['brandId', 'search', 'brandSearch'] as const);
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<{ kind: 'brand'; brand?: Brand } | { kind: 'model' } | null>(null);
  const brands = useQuery({
    queryKey: ['brands', values.brandSearch],
    queryFn: () => api.get<Page<Brand>>('/v1/admin/catalog/brands', { search: values.brandSearch, limit: 100 }),
  });
  const models = useQuery({
    queryKey: ['models', values.brandId, values.search, offset],
    queryFn: () => api.get<Page<Model>>('/v1/admin/catalog/models', { brandId: values.brandId, search: values.search, limit: LIMIT, offset }),
  });
  const brand = brands.data?.items.find((b) => String(b.brandId) === values.brandId);

  return (
    <>
      <PageHeader title="Catalogue" subtitle="The vehicles recognition can match a scan to. Records are deactivated, never deleted: existing cards refer to them."
        actions={isAdmin && (
          <div className="row">
            <Button onClick={() => setForm({ kind: 'brand' })}>Add brand</Button>
            <Button kind="primary" onClick={() => navigate('/catalog/ai')}>Add a car with AI</Button>
          </div>
        )} />
      <div className="catalog">
        <Panel className="brand-panel" title="Brands">
          <SearchBox value={values.brandSearch} onChange={(v) => set({ brandSearch: v, brandId: values.brandId })} placeholder="Filter brands" />
          <Loader q={brands}>
            {(d) => (
              <ul className="brand-list">
                <li><button type="button" className={!values.brandId ? 'on' : ''} onClick={() => set({ brandId: '', brandSearch: values.brandSearch })}>All brands</button></li>
                {d.items.map((b) => (
                  <li key={b.brandId}>
                    <button type="button" className={String(b.brandId) === values.brandId ? 'on' : ''}
                      onClick={() => set({ brandId: b.brandId, brandSearch: values.brandSearch })}>
                      <span className={b.isActive ? '' : 'strike'}>{b.name}</span>
                      <span className="faint">{b.modelCount}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Loader>
        </Panel>
        <div className="stack">
          {brand && (
            <Panel title={<>{brand.name} {!brand.isActive && <Badge tone="bad">Inactive</Badge>}</>} actions={isAdmin && (
              <div className="row">
                <Button onClick={() => setForm({ kind: 'brand', brand })}>Edit brand</Button>
                <Button kind="primary" onClick={() => setForm({ kind: 'model' })}>Add model</Button>
              </div>
            )}>
              <KV items={[['Country', brand.countryOfOrigin ?? '—'], ['Models', brand.modelCount]]} />
            </Panel>
          )}
          <div className="toolbar">
            <SearchBox value={values.search} onChange={(v) => set({ search: v, brandId: values.brandId, brandSearch: values.brandSearch })} placeholder="Search models, e.g. Swift" />
          </div>
          <Loader q={models}>
            {(d) => d.items.length === 0 ? <Empty title="No models match" /> : (
              <Panel>
                <table className="table clickable">
                  <thead><tr><th>Model</th><th>Rarity</th><th>Body</th><th>Years</th><th className="num">Variants</th><th>Status</th></tr></thead>
                  <tbody>
                    {d.items.map((m) => (
                      <tr key={m.modelId} onClick={() => navigate(`/catalog/models/${m.modelId}`)}>
                        <td><Link to={`/catalog/models/${m.modelId}`} onClick={(e) => e.stopPropagation()}>{m.brandName} {m.name}</Link>
                          {m.vehicleCategory && <div className="faint small">{m.vehicleCategory}</div>}</td>
                        <td><Badge tone="gold">{cap(m.rarity)}</Badge></td>
                        <td>{bodyLabel(m.bodyStyle)}</td>
                        <td>{m.introductionYear ?? '?'}–{m.discontinuedYear ?? 'now'}</td>
                        <td className="num">{m.variantCount}</td>
                        <td>{m.isActive ? <StatusBadge status="active" /> : <Badge tone="bad">Inactive</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pager offset={offset} limit={LIMIT} total={d.total} onChange={(o) => set({ offset: o, brandId: values.brandId, search: values.search, brandSearch: values.brandSearch })} />
              </Panel>
            )}
          </Loader>
        </div>
      </div>
      {form?.kind === 'brand' && (
        <FormDialog title={form.brand ? `Edit ${form.brand.name}` : 'Add a brand'} fields={BRAND_FIELDS} editing={!!form.brand}
          initial={form.brand ?? { isActive: true }} submitLabel={form.brand ? 'Save' : 'Add brand'} onClose={() => setForm(null)}
          onSubmit={async (changes, reason) => {
            const b = form.brand
              ? await api.patch<Brand>(`/v1/admin/catalog/brands/${form.brand.brandId}`, { ...changes, reason })
              : await api.post<Brand>('/v1/admin/catalog/brands', { ...changes, reason });
            qc.invalidateQueries({ queryKey: ['brands'] });
            toast(form.brand ? 'Brand saved.' : `${b.name} added.`);
            if (!form.brand) set({ brandId: b.brandId });
          }} />
      )}
      {form?.kind === 'model' && brand && (
        <FormDialog title={`Add a ${brand.name} model`} fields={MODEL_FIELDS} editing={false}
          initial={{ rarity: 'base', bodyStyle: 'sedan', isActive: true }} submitLabel="Add model" onClose={() => setForm(null)}
          onSubmit={async (changes, reason) => {
            const m = await api.post<Model>('/v1/admin/catalog/models', { ...changes, brandId: brand.brandId, reason });
            qc.invalidateQueries({ queryKey: ['models'] });
            qc.invalidateQueries({ queryKey: ['brands'] });
            toast(`${m.name} added. Add a variant so scans can match it.`);
            navigate(`/catalog/models/${m.modelId}`);
          }} />
      )}
    </>
  );
}

export function ModelView() {
  const id = Number(useParams().id);
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<{ kind: 'model' } | { kind: 'variant'; variant?: Variant } | { kind: 'photos'; variantId: number } | { kind: 'alias' } | { kind: 'unalias'; aliasId: number; alias: string } | null>(null);
  const [alias, setAlias] = useState('');
  const q = useQuery({ queryKey: ['model', id], queryFn: () => api.get<ModelDetail>(`/v1/admin/catalog/models/${id}`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['model', id] });
    qc.invalidateQueries({ queryKey: ['models'] });
  };
  const removeAlias = useMutation({
    mutationFn: (v: { aliasId: number; reason: string }) => api.delete(`/v1/admin/catalog/aliases/${v.aliasId}`, { reason: v.reason }),
    onSuccess: () => { refresh(); toast('Alias removed.'); },
  });

  return (
    <>
      <Loader q={q}>
        {(m) => (
          <>
            <PageHeader title={`${m.brandName} ${m.name}`}
              subtitle={<Link to={`/catalog?brandId=${m.brandId}`}>← {m.brandName} models</Link>}
              actions={isAdmin && <Button onClick={() => setForm({ kind: 'model' })}>Edit model</Button>} />
            <div className="stack">
              <Panel>
                <KV items={[
                  ['Rarity', <Badge tone="gold">{cap(m.rarity)}</Badge>],
                  ['Body style', bodyLabel(m.bodyStyle)],
                  ['Category', m.vehicleCategory ?? '—'],
                  ['Years', `${m.introductionYear ?? '?'}–${m.discontinuedYear ?? 'now'}`],
                  ['Status', m.isActive ? <StatusBadge status="active" /> : <Badge tone="bad">Inactive</Badge>],
                  ['Cards collected', fmtNumber(m.cardCount)],
                ]} />
                {m.summary && <p className="summary">{m.summary}</p>}
              </Panel>

              <Panel title="Variants" actions={isAdmin && <Button kind="primary" onClick={() => setForm({ kind: 'variant' })}>Add variant</Button>}>
                {m.variants.length === 0 ? <p className="muted small">No variants: scans can't match this model until one is added.</p> : (
                  <div className="table-scroll">
                    <table className="table">
                      <thead><tr><th>Variant</th><th>Years</th><th className="num">XP</th><th>Fuel</th><th className="num">Engine</th><th className="num">Power</th><th className="num">Top speed</th><th className="num">0–60</th><th>Photos</th><th>Status</th>{isAdmin && <th />}</tr></thead>
                      <tbody>
                        {m.variants.map((v) => (
                          <tr key={v.modelVariantId}>
                            <td>{v.modelVariantName}<div className="faint small">#{v.modelVariantId}</div></td>
                            <td>{v.modelYear}–{v.modelYearEnd ?? 'now'}</td>
                            <td className="num">{v.xpReward}</td>
                            <td>{v.fuelType ?? '—'}</td>
                            <td className="num">{v.engineDisplacementCc ? `${fmtNumber(v.engineDisplacementCc)} cc` : '—'}</td>
                            <td className="num">{v.horsepowerHp ? `${v.horsepowerHp} hp` : '—'}</td>
                            <td className="num">{v.topSpeedMph ? `${v.topSpeedMph} mph` : '—'}</td>
                            <td className="num">{v.acceleration0To60Mph ? `${v.acceleration0To60Mph} s` : '—'}</td>
                            <td className="photo-count">
                              {isAdmin
                                ? <Button kind="ghost" onClick={() => setForm({ kind: 'photos', variantId: v.modelVariantId })}>{v.photos?.length ?? 0} / 4</Button>
                                : `${v.photos?.length ?? 0} / 4`}
                            </td>
                            <td>{v.isActive ? <StatusBadge status="active" /> : <Badge tone="bad">Inactive</Badge>}</td>
                            {isAdmin && <td><Button kind="ghost" onClick={() => setForm({ kind: 'variant', variant: v })}>Edit</Button></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Other names recognition may use">
                <p className="muted small">When the AI answers with one of these names, the scan matches this model.</p>
                <div className="chips">
                  {m.aliases.map((a) => (
                    <span key={a.aliasId} className="chip">
                      {a.alias}
                      {isAdmin && <button type="button" aria-label={`Remove ${a.alias}`} onClick={() => setForm({ kind: 'unalias', ...a })}>✕</button>}
                    </span>
                  ))}
                  {m.aliases.length === 0 && <span className="faint small">None</span>}
                </div>
                {isAdmin && (
                  <div className="row">
                    <input className="input" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder={`e.g. ${m.brandName} ${m.name} facelift`} aria-label="New alias" />
                    <Button disabled={alias.trim().length < 2} onClick={() => setForm({ kind: 'alias' })}>Add name</Button>
                  </div>
                )}
              </Panel>
            </div>

            {form?.kind === 'model' && (
              <FormDialog title={`Edit ${m.brandName} ${m.name}`} fields={MODEL_FIELDS} editing initial={m} submitLabel="Save" onClose={() => setForm(null)}
                onSubmit={async (changes, reason) => {
                  await api.patch(`/v1/admin/catalog/models/${id}`, { ...changes, reason });
                  refresh();
                  toast('Model saved.');
                }} />
            )}
            {form?.kind === 'variant' && (
              <FormDialog title={form.variant ? `Edit ${form.variant.modelVariantName}` : `Add a ${m.name} variant`} fields={VARIANT_FIELDS}
                editing={!!form.variant} initial={form.variant ?? { isActive: true, xpReward: 100 }} submitLabel={form.variant ? 'Save' : 'Add variant'}
                onClose={() => setForm(null)}
                onSubmit={async (changes, reason) => {
                  if (form.variant) await api.patch(`/v1/admin/catalog/variants/${form.variant.modelVariantId}`, { ...changes, reason });
                  else await api.post(`/v1/admin/catalog/models/${id}/variants`, { ...changes, reason });
                  refresh();
                  toast(form.variant ? 'Variant saved.' : 'Variant added.');
                }} />
            )}
            {form?.kind === 'photos' && (() => {
              const v = m.variants.find((x) => x.modelVariantId === form.variantId);
              return v && (
                <VariantPhotosDialog variant={v} title={v.modelVariantName === `${m.brandName} ${m.name}` ? v.modelVariantName : `${m.brandName} ${m.name} · ${v.modelVariantName}`}
                  onClose={() => setForm(null)}
                  onSaved={(summary) => { refresh(); setForm(null); toast(summary); }} />
              );
            })()}
            {form?.kind === 'alias' && (
              <ReasonDialog title={`Add “${alias.trim()}”?`} description={`Scans the AI names “${alias.trim()}” will match ${m.brandName} ${m.name}.`}
                confirmLabel="Add name" onClose={() => setForm(null)}
                onConfirm={async (reason) => {
                  await api.post(`/v1/admin/catalog/models/${id}/aliases`, { alias: alias.trim(), reason });
                  setAlias('');
                  refresh();
                  toast('Name added.');
                }} />
            )}
            {form?.kind === 'unalias' && (
              <ReasonDialog title={`Remove “${form.alias}”?`} confirmLabel="Remove" danger onClose={() => setForm(null)}
                onConfirm={(reason) => removeAlias.mutateAsync({ aliasId: form.aliasId, reason })} />
            )}
          </>
        )}
      </Loader>
    </>
  );
}
