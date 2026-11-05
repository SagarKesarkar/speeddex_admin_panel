import type { Rarity } from '../api/types';

/**
 * Draws a SpeedDex Car Card on a canvas, as the app's CollectorCard shows it
 * (Mobile/lib/features/cards/presentation/collector_card.dart): header plate,
 * framed photo, tier strip, performance bars, spec sheet and footer. Laid out
 * in the app's 360-point width and drawn at [scale] (3 → 1080 px wide).
 */

export const TIERS: { id: Rarity; label: string; color: string }[] = [
  { id: 'base', label: 'Base', color: '#8C919B' },
  { id: 'special', label: 'Special', color: '#4AA6A8' },
  { id: 'sporty', label: 'Sporty', color: '#3F7FE6' },
  { id: 'royal', label: 'Royal', color: '#9361DB' },
  { id: 'classic', label: 'Classic', color: '#C48D4E' },
  { id: 'rare', label: 'Rare', color: '#2FB880' },
  { id: 'elite', label: 'Elite', color: '#E56B2C' },
  { id: 'legendary', label: 'Legendary', color: '#E9C25B' },
  { id: 'mythic', label: 'Mythic', color: '#E44D7E' },
];

const C = {
  ink: '#0B0C0F', surface: '#14161B', surfaceRaised: '#1B1E24', surfaceHigh: '#242830',
  line: '#2B2F38', lineStrong: '#3B404C', text: '#F3EFE7', textMuted: '#A3A6AE', textFaint: '#6B6F79',
  gold: '#D9B970', success: '#4DB384',
};
const DISPLAY = '"Chakra Petch", Inter, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export type CardData = {
  make: string;
  model: string;
  variant: string;
  tier: Rarity;
  yearLabel: string;
  category: string;
  origin: string;
  serial: string;
  /** Shown in the footer; empty shows "<xp> XP". */
  note: string;
  xp: number | null;
  topSpeedMph: number | null;
  horsepower: number | null;
  zeroToSixty: number | null;
  displacementCc: number | null;
  engine: string;
  fuel: string;
  drive: string;
  gearbox: string;
  weightKg: number | null;
  lengthMm: number | null;
  /** unlocked: values shown; locked: sealed bars; hidden: no spec sheet. */
  specSheet: 'unlocked' | 'locked' | 'hidden';
  yourCatch: boolean;
};

export type Photo = { image: CanvasImageSource & { width: number; height: number }; zoom: number; x: number; y: number };

// ------------------------------------------------------------------ colour
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const rgba = (h: string, a: number) => `rgba(${hex(h).join(',')},${a})`;
const lerp = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i]! - v) * t)).join(',')})`;
};
const tierOf = (id: Rarity) => TIERS.find((t) => t.id === id) ?? TIERS[0]!;

// ------------------------------------------------------------------ helpers
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, opts: { align?: CanvasTextAlign; spacing?: number; maxWidth?: number } = {}) {
  g.font = font;
  g.fillStyle = color;
  g.textAlign = opts.align ?? 'left';
  g.textBaseline = 'alphabetic';
  g.letterSpacing = `${opts.spacing ?? 0}px`;
  let t = s;
  if (opts.maxWidth != null && g.measureText(t).width > opts.maxWidth) {
    while (t.length > 1 && g.measureText(`${t}…`).width > opts.maxWidth) t = t.slice(0, -1);
    t = `${t.trimEnd()}…`;
  }
  g.fillText(t, x, y);
  g.letterSpacing = '0px';
}
const num = (n: number) => n.toLocaleString('en-US');

/** Up to three stats the card has, as the app picks them. */
function stats(d: CardData): [string, number, string][] {
  const out: [string, number, string][] = [];
  if (d.topSpeedMph != null) out.push(['SPD', d.topSpeedMph / 270, `${d.topSpeedMph} MPH`]);
  if (d.horsepower != null) out.push(['HP', d.horsepower / 1100, `${d.horsepower}`]);
  if (d.zeroToSixty != null) out.push(['0–60', (13 - d.zeroToSixty) / 11, `${d.zeroToSixty}s`]);
  if (d.displacementCc != null) out.push(['CC', d.displacementCc / 6500, num(d.displacementCc)]);
  return out.slice(0, 3);
}

// ------------------------------------------------------------------ layout
const W = 360;
const PAD = 8;
const X0 = 3 + PAD;
const CW = W - 2 * X0;
const GAP = 8;
const HEADER_H = 56;
const PHOTO_W = CW - 8;
const PHOTO_H = (PHOTO_W * 3) / 4;
const FRAME_H = PHOTO_H + 8;
const STRIP_H = 27;
const STAT_ROW = 22;
const SPEC_ROW = 22;
const FOOTER_H = 25;

function perfHeight(d: CardData) {
  return 12 + 14 + 8 + Math.max(1, stats(d).length) * STAT_ROW + 6;
}
const specHeight = () => 8 + 14 + 4 + 3 * SPEC_ROW + 6;

export function cardHeight(d: CardData) {
  const spec = d.specSheet === 'hidden' ? 0 : GAP + specHeight();
  return 3 + PAD + HEADER_H + GAP + FRAME_H + GAP + STRIP_H + GAP + perfHeight(d) + spec + GAP + FOOTER_H + PAD + 3;
}

/** Margin around the card when it's drawn on a dark backdrop. */
export const BACKDROP = 24;

export function renderCard(canvas: HTMLCanvasElement, d: CardData, photo: Photo | null, opts: { scale: number; backdrop: boolean }) {
  const H = cardHeight(d);
  const m = opts.backdrop ? BACKDROP : 0;
  canvas.width = Math.round((W + 2 * m) * opts.scale);
  canvas.height = Math.round((H + 2 * m) * opts.scale);
  const g = canvas.getContext('2d')!;
  g.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
  g.clearRect(0, 0, W + 2 * m, H + 2 * m);
  const tier = tierOf(d.tier);
  const tierIndex = TIERS.indexOf(tier);
  const deep = lerp(tier.color, C.ink, 0.55);

  if (opts.backdrop) {
    g.fillStyle = C.ink;
    g.fillRect(0, 0, W + 2 * m, H + 2 * m);
    g.save();
    g.shadowColor = rgba(tier.color, 0.28);
    g.shadowBlur = 36;
    g.shadowOffsetY = 10;
    rr(g, m, m, W, H, 14);
    g.fillStyle = deep;
    g.fill();
    g.restore();
  }
  g.translate(m, m);

  // Frame: tier gradient, with a foil sheen from Rare up.
  const frame = g.createLinearGradient(0, 0, W, H);
  const stops = tierIndex >= 5
    ? [tier.color, deep, lerp(tier.color, '#FFFFFF', 0.3), deep]
    : [lerp(deep, tier.color, 0.35), deep];
  stops.forEach((s, i) => frame.addColorStop(i / (stops.length - 1), s));
  rr(g, 0, 0, W, H, 14);
  g.fillStyle = frame;
  g.fill();
  rr(g, 3, 3, W - 6, H - 6, 11);
  g.fillStyle = C.surface;
  g.fill();

  let y = 3 + PAD;

  // Header plate: make over model.
  const plate = g.createLinearGradient(X0, 0, X0 + CW, 0);
  plate.addColorStop(0, rgba(tier.color, 0.28));
  plate.addColorStop(1, rgba(tier.color, 0.06));
  rr(g, X0, y, CW, HEADER_H, 6);
  g.fillStyle = plate;
  g.fill();
  g.strokeStyle = rgba(tier.color, 0.45);
  g.lineWidth = 1;
  rr(g, X0 + 0.5, y + 0.5, CW - 1, HEADER_H - 1, 6);
  g.stroke();
  text(g, d.make.toUpperCase(), X0 + 12, y + 20, `600 10px ${DISPLAY}`, tier.color, { spacing: 1.6, maxWidth: CW - 24 });
  // The model name shrinks to fit, never wraps.
  let size = 26;
  g.font = `700 ${size}px ${DISPLAY}`;
  g.letterSpacing = '0.5px';
  const modelText = d.model.toUpperCase();
  while (size > 12 && g.measureText(modelText).width > CW - 24) {
    size -= 1;
    g.font = `700 ${size}px ${DISPLAY}`;
  }
  text(g, modelText, X0 + 12, y + 46, `700 ${size}px ${DISPLAY}`, C.text, { spacing: 0.5 });
  y += HEADER_H + GAP;

  // Framed photo with viewfinder corners.
  rr(g, X0 + 0.5, y + 0.5, CW - 1, FRAME_H - 1, 6);
  g.strokeStyle = C.lineStrong;
  g.stroke();
  const px = X0 + 4;
  const py = y + 4;
  g.save();
  rr(g, px, py, PHOTO_W, PHOTO_H, 3);
  g.clip();
  g.fillStyle = C.surfaceHigh;
  g.fillRect(px, py, PHOTO_W, PHOTO_H);
  if (photo) {
    // Cover the 4:3 frame, then zoom and move within what's left over.
    const cover = Math.max(PHOTO_W / photo.image.width, PHOTO_H / photo.image.height) * photo.zoom;
    const iw = photo.image.width * cover;
    const ih = photo.image.height * cover;
    const ix = px + (PHOTO_W - iw) / 2 + ((iw - PHOTO_W) / 2) * -photo.x;
    const iy = py + (PHOTO_H - ih) / 2 + ((ih - PHOTO_H) / 2) * -photo.y;
    g.drawImage(photo.image, ix, iy, iw, ih);
  } else {
    text(g, 'UPLOAD A PHOTO', px + PHOTO_W / 2, py + PHOTO_H / 2 + 4, `600 12px ${DISPLAY}`, C.textFaint, { align: 'center', spacing: 1.6 });
  }
  g.restore();
  g.strokeStyle = rgba(tier.color, 0.9);
  g.lineWidth = 1.6;
  const [l, i, r, b] = [12, 6, px + PHOTO_W - 6, py + PHOTO_H - 6];
  for (const [ax, ay, bx, by, cx, cy] of [
    [px + i, py + i + l, px + i, py + i, px + i + l, py + i],
    [r - l, py + i, r, py + i, r, py + i + l],
    [px + i, b - l, px + i, b, px + i + l, b],
    [r - l, b, r, b, r, b - l],
  ] as const) {
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.lineTo(cx, cy);
    g.stroke();
  }
  g.lineWidth = 1;
  y += FRAME_H + GAP;

  // Tier strip: generation name and tier chip.
  rr(g, X0, y, CW, STRIP_H, 3);
  g.fillStyle = C.surfaceRaised;
  g.fill();
  g.font = `700 9px ${DISPLAY}`;
  g.letterSpacing = '1.4px';
  const chipText = tier.label.toUpperCase();
  const chipW = g.measureText(chipText).width + 12;
  g.letterSpacing = '0px';
  const chipX = X0 + CW - 12 - chipW;
  rr(g, chipX, y + 6, chipW, 15, 3);
  g.fillStyle = rgba(tier.color, 0.16);
  g.fill();
  g.strokeStyle = rgba(tier.color, 0.7);
  g.stroke();
  text(g, chipText, chipX + 6, y + 17, `700 9px ${DISPLAY}`, tier.color, { spacing: 1.4 });
  text(g, (d.variant || 'Standard').toUpperCase(), X0 + 12, y + 18, `600 11px ${DISPLAY}`, C.text, { spacing: 1.6, maxWidth: chipX - X0 - 20 });
  y += STRIP_H + GAP;

  // Performance: category · origin · years, then up to three bars.
  const perfH = perfHeight(d);
  rr(g, X0, y, CW, perfH, 3);
  g.fillStyle = C.ink;
  g.fill();
  const facts = [d.category, d.origin, d.yearLabel].filter(Boolean).join(' · ').toUpperCase();
  text(g, facts, X0 + 12, y + 23, `500 11px ${MONO}`, C.textMuted, { spacing: 0.6, maxWidth: CW - 24 });
  let sy = y + 12 + 14 + 8;
  const st = stats(d);
  if (!st.length) {
    text(g, d.engine || 'Performance figures not published', X0 + 12, sy + 14, `500 11px ${MONO}`, C.textFaint, { spacing: 0.6, maxWidth: CW - 24 });
  }
  for (const [label, value, display] of st) {
    text(g, label, X0 + 12, sy + 14, `500 11px ${MONO}`, C.textMuted, { spacing: 0.6 });
    const bx = X0 + 12 + 40;
    const bw = CW - 24 - 40 - 78;
    const segW = (bw - 15 * 2) / 16;
    const filled = Math.round(Math.min(1, Math.max(0, value)) * 16);
    for (let s = 0; s < 16; s++) {
      rr(g, bx + s * (segW + 2), sy + 7.5, segW, 7, 1);
      g.fillStyle = s < filled ? tier.color : C.line;
      g.fill();
    }
    text(g, display, X0 + CW - 12, sy + 15, `500 13px ${MONO}`, C.text, { align: 'right' });
    sy += STAT_ROW;
  }
  y += perfH;

  // Spec sheet: unlocked values, or sealed bars.
  if (d.specSheet !== 'hidden') {
    y += GAP;
    const sh = specHeight();
    rr(g, X0, y, CW, sh, 3);
    g.fillStyle = C.ink;
    g.fill();
    text(g, 'SPEC SHEET', X0 + 12, y + 19, `600 10px ${DISPLAY}`, C.gold, { spacing: 1.6 });
    const locked = d.specSheet === 'locked';
    if (d.yourCatch) {
      text(g, 'YOUR CATCH', X0 + CW - 12, y + 19, `600 9px ${DISPLAY}`, C.success, { align: 'right', spacing: 1.6 });
    } else if (locked) {
      // A small padlock.
      const lx = X0 + CW - 20;
      const ly = y + 11;
      g.fillStyle = C.textFaint;
      rr(g, lx, ly + 4, 8, 6, 1);
      g.fill();
      g.strokeStyle = C.textFaint;
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(lx + 4, ly + 4, 2.6, Math.PI, 0);
      g.stroke();
      g.lineWidth = 1;
    }
    const rows: [string, string][] = [
      ['ENGINE', d.engine], ['FUEL', d.fuel],
      ['DRIVE', d.drive], ['GEARBOX', d.gearbox],
      ['WEIGHT', d.weightKg != null ? `${num(d.weightKg)} kg` : ''], ['LENGTH', d.lengthMm != null ? `${num(d.lengthMm)} mm` : ''],
    ];
    const colW = (CW - 24 - 16) / 2;
    rows.forEach(([label, value], k) => {
      const cx = X0 + 12 + (k % 2) * (colW + 16);
      const cy = y + 8 + 14 + 4 + Math.floor(k / 2) * SPEC_ROW;
      text(g, label, cx, cy + 14, `500 11px ${MONO}`, C.textMuted, { spacing: 0.6 });
      g.font = `500 11px ${MONO}`;
      g.letterSpacing = '0.6px';
      const labelW = g.measureText(label).width + 8;
      g.letterSpacing = '0px';
      if (locked) {
        const sealed = g.createLinearGradient(cx + colW - 44, 0, cx + colW, 0);
        sealed.addColorStop(0, C.surfaceHigh);
        sealed.addColorStop(0.5, C.lineStrong);
        sealed.addColorStop(1, C.surfaceHigh);
        rr(g, cx + colW - 44, cy + 5, 44, 10, 2);
        g.fillStyle = sealed;
        g.fill();
      } else {
        // Long values shrink to fit (down to 9 px) before they're cut short.
        const v = value || '—';
        let px = v.length > 14 ? 11 : 12.5;
        g.font = `500 ${px}px ${MONO}`;
        while (px > 9 && g.measureText(v).width > colW - labelW) g.font = `500 ${(px -= 0.5)}px ${MONO}`;
        text(g, v, cx + colW, cy + 14, `500 ${px}px ${MONO}`, C.text, { align: 'right', maxWidth: colW - labelW });
      }
    });
    y += sh;
  }
  y += GAP;

  // Footer: serial, XP and the tier ladder.
  rr(g, X0, y, CW, FOOTER_H, 3);
  g.fillStyle = rgba(tier.color, 0.12);
  g.fill();
  text(g, d.serial, X0 + 12, y + 16.5, `500 11px ${MONO}`, C.text, { spacing: 0.6 });
  const ladderX = X0 + CW - 12 - TIERS.length * 7;
  TIERS.forEach((_, k) => {
    g.fillStyle = k <= tierIndex ? tier.color : C.lineStrong;
    g.fillRect(ladderX + k * 7 + 2, y + 10, 5, 5);
  });
  const note = d.note || (d.xp != null ? `${num(d.xp)} XP` : '');
  text(g, note, ladderX - 6, y + 16.5, `700 11px ${MONO}`, C.gold, { align: 'right', spacing: 0.6 });
}
