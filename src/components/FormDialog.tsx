import { useState } from 'react';
import { ApiError } from '../api';
import { Button, ErrorNote, Field, Modal } from './ui';

export type FieldSpec = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'decimal' | 'select' | 'checkbox' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
};

type Values = Record<string, string | boolean>;

/**
 * A create/edit form with a required audit reason. On edit, only fields that
 * changed are sent; empty optional fields are sent as null (cleared).
 */
export function FormDialog({ title, fields, initial, editing, submitLabel, onSubmit, onClose }: {
  title: string;
  fields: FieldSpec[];
  initial: Record<string, unknown>;
  editing: boolean;
  submitLabel: string;
  onSubmit: (changes: Record<string, unknown>, reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const start: Values = Object.fromEntries(
    fields.map((f) => [f.key, f.type === 'checkbox' ? Boolean(initial[f.key] ?? true) : initial[f.key] == null ? '' : String(initial[f.key])]),
  );
  const [values, setValues] = useState<Values>(start);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fieldErrors = error instanceof ApiError ? Object.fromEntries(error.fieldErrors.map((e) => [e.field, e.message])) : {};

  const convert = (f: FieldSpec, v: string | boolean): unknown => {
    if (f.type === 'checkbox') return v;
    const s = String(v).trim();
    if (s === '') return null;
    if (f.type === 'number') return Number.isInteger(Number(s)) ? Number(s) : s; // the server rejects non-integers
    if (f.type === 'decimal') return Number.isFinite(Number(s)) ? Number(s) : s;
    return s;
  };

  const submit = async () => {
    const changes: Record<string, unknown> = {};
    for (const f of fields) {
      if (editing && values[f.key] === start[f.key]) continue;
      const v = convert(f, values[f.key]!);
      if (v === null && !editing) continue; // new record: leave unset
      changes[f.key] = v;
    }
    const missing = fields.filter((f) => f.required && convert(f, values[f.key]!) === null);
    if (missing.length) {
      setError(new ApiError(400, 'VALIDATION_FAILED', 'Fill in the required fields.', missing.map((f) => ({ field: f.key, message: 'Required.' }))));
      return;
    }
    if (!Object.keys(changes).length) {
      setError(new Error('Nothing has changed.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(changes, reason.trim());
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide footer={
      <>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" busy={busy} disabled={reason.trim().length < 3} onClick={submit}>{submitLabel}</Button>
      </>
    }>
      <div className="form-grid">
        {fields.map((f) => (
          <div key={f.key} className={f.type === 'textarea' ? 'span-2' : ''}>
            {f.type === 'checkbox' ? (
              <label className="check">
                <input type="checkbox" checked={Boolean(values[f.key])} onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })} />
                {f.label}
              </label>
            ) : (
              <Field label={`${f.label}${f.required ? ' *' : ''}`} hint={f.hint} error={fieldErrors[f.key]}>
                {(id) =>
                  f.type === 'select' ? (
                    <select id={id} className="input" value={String(values[f.key])} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                      {!f.required && <option value="">—</option>}
                      {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea id={id} className="input" rows={3} value={String(values[f.key])} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                  ) : (
                    <input id={id} className="input" inputMode={f.type === 'text' ? undefined : 'decimal'} value={String(values[f.key])}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                  )
                }
              </Field>
            )}
          </div>
        ))}
        <div className="span-2">
          <Field label="Reason (saved in the audit log) *" error={fieldErrors.reason}>
            {(id) => <input id={id} className="input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Corrected horsepower from the brochure" />}
          </Field>
        </div>
      </div>
      {error != null && <ErrorNote error={error} />}
    </Modal>
  );
}
