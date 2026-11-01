import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * List filters kept in the URL, so a filtered view can be reloaded or shared
 * with another moderator. Changing a filter goes back to the first page.
 */
export function useFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;
  const offset = Number(params.get('offset') ?? 0) || 0;
  const set = useCallback(
    (patch: Partial<Record<K | 'offset', string | number>>) =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        if (!('offset' in patch)) next.delete('offset');
        for (const [k, v] of Object.entries(patch)) {
          if (v === '' || v == null || (k === 'offset' && v === 0)) next.delete(k);
          else next.set(k, String(v));
        }
        return next;
      }, { replace: true }),
    [setParams],
  );
  return { values, offset, set };
}
