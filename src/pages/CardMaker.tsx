import '@fontsource/inter/latin-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Rarity, VariantHit } from '../api/types';
import { variantLabel, VariantPicker } from '../components/VariantPicker';
import { Button, ErrorNote, Field, PageHeader, Panel, Segmented } from '../components/ui';
import { renderCard, TIERS, type CardData, type Photo } from '../lib/card-render';

/** A generation as a card shows it (GET /v1/admin/catalog/variants/:id/card). */
type VariantCard = {
  make: string; model: string; variant: string | null; yearLabel: string; category: string; origin: string;
  rarity: Rarity; xp: number;
  specs: { topSpeedMph: number | null; horsepower: number | null; zeroToSixtySeconds: number | null; engine: string | null; displacementCc: number | null; fuelType: string | null };
  hidden: { drivetrain: string | null; transmission: string | null; curbWeightKg: number | null; lengthMm: number | null } | null;
};

const EMPTY: CardData = {
  make: 'Brand', model: 'Model', variant: '', tier: 'base', yearLabel: '', category: '', origin: '',
  serial: 'SDX-00001', note: '', xp: 100, topSpeedMph: null, horsepower: null, zeroToSixty: null, displacementCc: null,
  engine: '', fuel: '', drive: '', gearbox: '', weightKg: null, lengthMm: null, specSheet: 'unlocked', yourCatch: false,
};

const fromVariant = (v: VariantCard, keep: CardData): CardData => ({
  ...keep,
  make: v.make, model: v.model, variant: v.variant ?? '', tier: v.rarity, yearLabel: v.yearLabel,
  category: v.category, origin: v.origin, xp: v.xp,
  topSpeedMph: v.specs.topSpeedMph, horsepower: v.specs.horsepower, zeroToSixty: v.specs.zeroToSixtySeconds,
  displacementCc: v.specs.displacementCc, engine: v.specs.engine ?? '', fuel: v.specs.fuelType ?? '',
  drive: v.hidden?.drivetrain ?? '', gearbox: v.hidden?.transmission ?? '',
  weightKg: v.hidden?.curbWeightKg ?? null, lengthMm: v.hidden?.lengthMm ?? null,
});

const fileName = (d: CardData) =>
  `speeddex-${`${d.make}-${d.model}-${d.variant}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;

/**
 * Card maker: any photo plus a catalogue car (or typed-in details) becomes a
 * Car Card PNG, drawn exactly as the app draws cards. Everything happens in
 * the browser: the photo is never uploaded.
 */
export function CardMaker() {
  const [data, setData] = useState<CardData>(EMPTY);
  const [picked, setPicked] = useState<VariantHit | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [frame, setFrame] = useState({ zoom: 1, x: 0, y: 0 });
  const [backdrop, setBackdrop] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const preview = useRef<HTMLCanvasElement>(null);

  const set = <K extends keyof CardData>(k: K, v: CardData[K]) => setData((d) => ({ ...d, [k]: v }));
  const numOrNull = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s));
  const photo: Photo | null = image ? { image, ...frame } : null;

  // Canvas text uses only fonts already loaded: wait for the card's fonts.
  useEffect(() => {
    void Promise.all([
      document.fonts.load('700 26px "Chakra Petch"'), document.fonts.load('600 10px "Chakra Petch"'),
      document.fonts.load('500 11px "JetBrains Mono"'), document.fonts.load('700 11px "JetBrains Mono"'),
    ]).finally(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    if (preview.current) renderCard(preview.current, data, photo, { scale: 2, backdrop });
  });

  async function pick(v: VariantHit) {
    setPicked(v);
    setLoadError(null);
    try {
      const card = await api.get<VariantCard>(`/v1/admin/catalog/variants/${v.modelVariantId}/card`);
      setData((d) => fromVariant(card, d));
    } catch (e) {
      setLoadError(e);
    }
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    image?.close();
    setImage(await createImageBitmap(file));
    setFrame({ zoom: 1, x: 0, y: 0 });
  }

  function download() {
    const canvas = document.createElement('canvas');
    renderCard(canvas, data, photo, { scale: 3, backdrop });
    canvas.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = fileName(data);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    }, 'image/png');
  }

  const textField = (label: string, k: 'make' | 'model' | 'variant' | 'yearLabel' | 'category' | 'origin' | 'serial' | 'note' | 'engine' | 'fuel' | 'drive' | 'gearbox', hint?: string) => (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} className="input" value={data[k]} onChange={(e) => set(k, e.target.value)} />}
    </Field>
  );
  const numberField = (label: string, k: 'xp' | 'topSpeedMph' | 'horsepower' | 'zeroToSixty' | 'displacementCc' | 'weightKg' | 'lengthMm') => (
    <Field label={label}>
      {(id) => (
        <input id={id} className="input" inputMode="decimal" value={data[k] ?? ''} onChange={(e) => set(k, numOrNull(e.target.value))} />
      )}
    </Field>
  );
  const slider = (label: string, k: 'zoom' | 'x' | 'y', min: number, max: number) => (
    <Field label={label}>
      {(id) => (
        <input id={id} type="range" min={min} max={max} step={0.01} value={frame[k]} disabled={!image}
          onChange={(e) => setFrame((f) => ({ ...f, [k]: Number(e.target.value) }))} />
      )}
    </Field>
  );

  return (
    <div>
      <PageHeader
        title="Card maker"
        subtitle="Turn any car photo into a SpeedDex card PNG, drawn as the app draws it. The photo stays in your browser."
        actions={<Button kind="primary" onClick={download} disabled={!fontsReady}>Download PNG</Button>}
      />
      <div className="card-maker">
        <div className="stack">
          <Panel title="1. Photo">
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Car photo"
              onChange={(e) => void choose(e.target.files?.[0])} />
            <div className="grid-3 card-maker-sliders">
              {slider('Zoom', 'zoom', 1, 3)}
              {slider('Left ↔ right', 'x', -1, 1)}
              {slider('Up ↕ down', 'y', -1, 1)}
            </div>
          </Panel>
          <Panel title="2. Car">
            <VariantPicker value={picked} onChange={(v) => void pick(v)} />
            {picked && <p className="muted small">Filled in from {variantLabel(picked)}. You can edit anything below.</p>}
            {loadError != null && <ErrorNote error={loadError} />}
            <div className="grid-2">
              {textField('Brand', 'make')}
              {textField('Model', 'model')}
              {textField('Generation', 'variant', 'Empty shows STANDARD.')}
              <Field label="Tier">
                {(id) => (
                  <select id={id} className="input" value={data.tier} onChange={(e) => set('tier', e.target.value as Rarity)}>
                    {TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                )}
              </Field>
              {textField('Category', 'category')}
              {textField('Origin', 'origin')}
              {textField('Years', 'yearLabel', 'e.g. 2024–present')}
              {numberField('XP', 'xp')}
            </div>
          </Panel>
          <Panel title="3. Performance and spec sheet">
            <div className="grid-2">
              {numberField('Top speed (mph)', 'topSpeedMph')}
              {numberField('Horsepower', 'horsepower')}
              {numberField('0–60 mph (s)', 'zeroToSixty')}
              {numberField('Engine size (cc)', 'displacementCc')}
              {textField('Engine', 'engine', 'e.g. 2.0 L I4 turbo')}
              {textField('Fuel', 'fuel')}
              {textField('Drive', 'drive')}
              {textField('Gearbox', 'gearbox')}
              {numberField('Weight (kg)', 'weightKg')}
              {numberField('Length (mm)', 'lengthMm')}
            </div>
            <p className="muted small">The card shows up to three bars: speed, power, 0–60 and engine size, in that order, skipping empty ones.</p>
          </Panel>
          <Panel title="4. Finish">
            <Field label="Spec sheet">
              {() => (
                <Segmented label="Spec sheet" value={data.specSheet} onChange={(v) => set('specSheet', v)}
                  options={[{ value: 'unlocked', label: 'Unlocked' }, { value: 'locked', label: 'Sealed' }, { value: 'hidden', label: 'Hidden' }]} />
              )}
            </Field>
            <div className="grid-2">
              {textField('Serial', 'serial')}
              {textField('Footer note', 'note', 'Empty shows the XP, e.g. "+420 XP" for a fresh catch.')}
            </div>
            <label className="row"><input type="checkbox" checked={data.yourCatch} onChange={(e) => set('yourCatch', e.target.checked)} /> Mark as “Your catch”</label>
            <label className="row"><input type="checkbox" checked={backdrop} onChange={(e) => setBackdrop(e.target.checked)} /> Dark background with glow (for social posts); off gives a transparent PNG</label>
          </Panel>
        </div>
        <div className="card-maker-preview">
          <canvas ref={preview} aria-label="Card preview" />
          <p className="muted small">Downloads at 1080 px wide{backdrop ? ', with the dark background' : ', transparent around the card'}.</p>
        </div>
      </div>
    </div>
  );
}
