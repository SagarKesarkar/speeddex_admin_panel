import { useState } from 'react';
import { api, ApiError, sameOrigin } from '../api';
import type { PhotoView, Variant } from '../api/types';
import { Button, ErrorNote, Field, Modal } from './ui';

export const VIEWS: { view: PhotoView; label: string }[] = [
  { view: 'front', label: 'Front' },
  { view: 'left', label: 'Left side' },
  { view: 'right', label: 'Right side' },
  { view: 'rear', label: 'Rear' },
];

/**
 * Re-encodes the chosen picture as a JPEG, at most 1600 px on the long side.
 * This also drops EXIF data (camera, GPS) and accepts PNG/WebP sources.
 */
export async function toJpeg(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image.'))), 'image/jpeg', 0.85),
  );
}

/** A data: URL for the preview (the console's CSP allows data: images, not blob:). */
const dataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read that image.'));
    r.readAsDataURL(b);
  });

type Staged = { jpeg: Blob; preview: string };

/**
 * The four reference photos of one generation. Changes are staged: + picks
 * a photo, ✕ takes one away, and Upload sends them all with one reason.
 */
export function VariantPhotosDialog({ variant, title, onSaved, onClose }: {
  variant: Variant; title: string; onSaved: (summary: string) => void; onClose: () => void;
}) {
  const saved = new Map((variant.photos ?? []).map((p) => [p.view, p]));
  const [added, setAdded] = useState<Partial<Record<PhotoView, Staged>>>({});
  const [removed, setRemoved] = useState<Partial<Record<PhotoView, true>>>({});
  const [reason, setReason] = useState('');
  const [credit, setCredit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const uploads = VIEWS.filter(({ view }) => added[view]);
  const deletes = VIEWS.filter(({ view }) => removed[view] && saved.has(view) && !added[view]);
  const changes = uploads.length + deletes.length;
  const reasonOk = reason.trim().length >= 3;

  const pick = async (view: PhotoView, file: File) => {
    setError(null);
    try {
      const jpeg = await toJpeg(file);
      const preview = await dataUrl(jpeg);
      setAdded((a) => ({ ...a, [view]: { jpeg, preview } }));
    } catch (e) {
      setError(e);
    }
  };
  const clear = (view: PhotoView) => {
    setAdded(({ [view]: _gone, ...rest }) => rest);
    if (saved.has(view)) setRemoved((r) => ({ ...r, [view]: true }));
  };

  const upload = async () => {
    setBusy(true);
    setError(null);
    const base = `/v1/admin/catalog/variants/${variant.modelVariantId}/photos`;
    try {
      for (const { view } of deletes) await api.delete(`${base}/${view}`, { reason: reason.trim() });
      for (const { view } of uploads) {
        await api.put(`${base}/${view}`, added[view]!.jpeg, { reason: reason.trim(), credit: credit.trim() || undefined });
      }
      const parts = [uploads.length && `${uploads.length} uploaded`, deletes.length && `${deletes.length} removed`].filter(Boolean);
      onSaved(`Photos saved: ${parts.join(', ')}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new Error((e as Error).message));
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide footer={
      <>
        <Button kind="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button kind="primary" busy={busy} disabled={!changes || !reasonOk} onClick={() => void upload()}>
          {busy ? 'Uploading…' : changes ? `Upload (${changes} change${changes > 1 ? 's' : ''})` : 'Upload'}
        </Button>
      </>
    }>
      <p className="muted small">
        Shown on every card of this generation, in this order. Use photos you have the right to publish
        (manufacturer press kits, your own, or openly licensed) and credit them.
      </p>
      <div className="photo-slots">
        {VIEWS.map(({ view, label }) => {
          const staged = added[view];
          const current = !removed[view] ? saved.get(view) : undefined;
          const src = staged?.preview ?? sameOrigin(current?.imageUrl);
          return (
            <div key={view} className="photo-slot">
              <div className="photo-slot-label">{label}</div>
              {src ? (
                <div className="photo-tile filled">
                  <img src={src} alt={`${label} of ${title}`} />
                  {staged && <span className="photo-new">New</span>}
                  <button type="button" className="photo-remove" disabled={busy} onClick={() => clear(view)}
                    aria-label={`Remove ${label.toLowerCase()} photo`}>
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                      <path d="M2 2 10 10M10 2 2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className={`photo-tile empty ${busy ? 'disabled' : ''}`}>
                  <span className="photo-plus" aria-hidden>+</span>
                  <span className="small">Add photo</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
                    aria-label={`Add ${label.toLowerCase()} photo`}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(view, f); }} />
                </label>
              )}
              <div className="faint small photo-credit">
                {staged ? (credit.trim() ? `© ${credit.trim()}` : ' ') : current?.credit ? `© ${current.credit}` : ' '}
              </div>
            </div>
          );
        })}
      </div>
      <div className="form-grid">
        <Field label="Reason (for the audit log)">
          {(id) => <input id={id} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Official press photos" />}
        </Field>
        <Field label="Photo credit for new photos (optional)">
          {(id) => <input id={id} className="input" value={credit} maxLength={200} onChange={(e) => setCredit(e.target.value)} placeholder="e.g. Maruti Suzuki press kit" />}
        </Field>
      </div>
      {changes > 0 && !reasonOk && <p className="faint small">Enter a reason to upload your changes.</p>}
      {error != null && <ErrorNote error={error} />}
    </Modal>
  );
}
