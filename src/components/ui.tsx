import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ApiError, sameOrigin } from '../api';
import { humanize } from '../lib/format';

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'gold' | 'muted';

const STATUS_TONES: Record<string, Tone> = {
  active: 'good', identified: 'info', added_to_garage: 'good', approved: 'good', reassigned: 'good', actioned: 'good',
  visible: 'good', review_required: 'warn', pending: 'warn', open: 'warn', reviewing: 'warn', processing: 'info',
  uploaded: 'info', created: 'muted', pending_verification: 'warn', suspended: 'bad', banned: 'bad', rejected: 'bad',
  failed: 'bad', hidden: 'bad', removed: 'bad', discarded: 'muted', replaced: 'muted', dismissed: 'muted',
  deletion_pending: 'muted', admin: 'gold', moderator: 'info', user: 'muted',
};

const TONE_ICON: Record<Tone, string> = { good: '●', warn: '▲', bad: '■', info: '◆', gold: '★', muted: '○' };

/** A status shown with a shape and words, never colour alone. */
export function Badge({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`badge tone-${tone}`} title={title}>
      <span aria-hidden="true" className="badge-icon">{TONE_ICON[tone]}</span>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'muted'}>{humanize(status)}</Badge>;
}

export function Button({
  children, kind = 'secondary', busy, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; busy?: boolean }) {
  return (
    <button type="button" {...rest} className={`btn btn-${kind} ${rest.className ?? ''}`} disabled={rest.disabled || busy} aria-busy={busy}>
      {busy && <span className="spinner small" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || actions) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export function errorText(e: unknown) {
  if (e instanceof ApiError) return e.fieldErrors.length ? e.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(' · ') : e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'Something went wrong.';
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="error-note" role="alert">
      <span>{errorText(error)}</span>
      {error instanceof ApiError && error.requestId && <span className="mono faint">Ref {error.requestId.slice(0, 8)}</span>}
      {onRetry && <Button kind="ghost" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Query-state wrapper: spinner, error with retry, or the content. */
export function Loader<T>({ q, children }: { q: { data?: T; error: unknown; isPending: boolean; refetch: () => unknown }; children: (d: T) => ReactNode }) {
  if (q.isPending) return <Spinner />;
  if (q.error || q.data === undefined) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

export function Pager({ offset, limit, total, onChange }: { offset: number; limit: number; total: number; onChange: (o: number) => void }) {
  if (total <= limit && offset === 0) return null;
  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + limit, total);
  return (
    <nav className="pager" aria-label="Pages">
      <span className="muted">{from}–{to} of {total}</span>
      <Button kind="ghost" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>‹ Previous</Button>
      <Button kind="ghost" disabled={to >= total} onClick={() => onChange(offset + limit)}>Next ›</Button>
    </nav>
  );
}

/** Pill buttons for one-of-many filters. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => text !== value && onChange(text), 300);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <input className="input search" type="search" value={text} placeholder={placeholder} aria-label={placeholder}
      onChange={(e) => setText(e.target.value)} />
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={(e) => { e.preventDefault(); onClose(); }}
      aria-labelledby="modal-title">
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </dialog>
  );
}

/**
 * Confirms an action that needs a reason (every admin change is audited with
 * one). [onConfirm] may throw; its error is shown and the dialog stays open.
 */
export function ReasonDialog({ title, description, confirmLabel, danger, onConfirm, onClose, children }: {
  title: string; description?: ReactNode; confirmLabel: string; danger?: boolean;
  onConfirm: (reason: string) => Promise<unknown>; onClose: () => void; children?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const tooShort = reason.trim().length < 3;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind={danger ? 'danger' : 'primary'} busy={busy} disabled={tooShort} onClick={submit}>{confirmLabel}</Button>
      </>
    }>
      {description && <div className="modal-text">{description}</div>}
      {children}
      <Field label="Reason (saved in the audit log)" hint="At least 3 characters. Users don't see it.">
        {(id) => (
          <textarea id={id} className="input" rows={3} maxLength={500} value={reason} autoFocus
            onChange={(e) => setReason(e.target.value)} />
        )}
      </Field>
      {error != null && <ErrorNote error={error} />}
    </Modal>
  );
}

export function Thumb({ url, alt, size = 'md' }: { url: string | null; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  const src = sameOrigin(url);
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <div className={`thumb thumb-${size} thumb-empty`} title="Photo deleted or unavailable">No photo</div>;
  }
  return <img className={`thumb thumb-${size}`} src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
