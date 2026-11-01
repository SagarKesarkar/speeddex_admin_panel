import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import type { VariantHit } from '../api/types';
import { cap } from '../lib/format';
import { ErrorNote, SearchBox, Spinner } from './ui';

export const variantLabel = (v: VariantHit) =>
  `${v.brandName} ${v.modelName} · ${v.modelVariantName} (${v.modelYear}${v.modelYearEnd ? `–${v.modelYearEnd}` : ''})`;

/** Finds a catalogue variant by brand, model and generation words ("hyundai creta 2024"). */
export function VariantPicker({ initial, value, onChange }: {
  initial?: string; value: VariantHit | null; onChange: (v: VariantHit) => void;
}) {
  const [search, setSearch] = useState(initial ?? '');
  const q = useQuery({
    queryKey: ['variants', search],
    queryFn: () => api.get<{ items: VariantHit[] }>('/v1/admin/catalog/variants', { search, limit: 12 }),
    enabled: search.trim().length >= 2,
  });
  return (
    <div className="picker">
      <SearchBox value={search} onChange={setSearch} placeholder="Search the catalogue, e.g. Hyundai Creta" />
      {search.trim().length < 2 ? (
        <p className="muted small">Type at least 2 letters.</p>
      ) : q.isPending ? (
        <Spinner label="Searching…" />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : q.data.items.length === 0 ? (
        <p className="muted small">No active vehicle matches “{search}”.</p>
      ) : (
        <ul className="picker-list" role="listbox" aria-label="Matching vehicles">
          {q.data.items.map((v) => (
            <li key={v.modelVariantId}>
              <button type="button" role="option" aria-selected={value?.modelVariantId === v.modelVariantId}
                className={value?.modelVariantId === v.modelVariantId ? 'on' : ''} onClick={() => onChange(v)}>
                <span>{variantLabel(v)}</span>
                <span className="faint">{cap(v.rarity)} · #{v.modelVariantId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
