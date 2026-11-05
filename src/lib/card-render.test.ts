import { describe, expect, it } from 'vitest';
import { cardHeight, renderCard, TIERS, type CardData } from './card-render';

/** Records what the renderer asks the canvas for, and rejects colours a browser can't parse. */
function fakeCanvas() {
  const colours: string[] = [];
  const valid = (c: unknown) => typeof c !== 'string' || /^(#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,[\d.]+\))$/i.test(c);
  const gradient = { addColorStop: (_: number, c: string) => { if (!valid(c)) throw new Error(`bad colour ${c}`); colours.push(c); } };
  const g = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (typeof k === 'string' && k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 }) : k.toString().startsWith('create') ? () => gradient : () => {}),
    set: (t, k, v) => { if ((k === 'fillStyle' || k === 'strokeStyle' || k === 'shadowColor') && !valid(v)) throw new Error(`bad colour ${String(v)}`); t[k as string] = v; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => g } as unknown as HTMLCanvasElement, colours };
}

const card: CardData = {
  make: 'Ferrari', model: 'F40', variant: '', tier: 'base', yearLabel: '1987–1992', category: 'Coupe', origin: 'Italy',
  serial: 'SDX-00001', note: '', xp: 2000, topSpeedMph: 201, horsepower: 471, zeroToSixty: 3.8, displacementCc: 2936,
  engine: '2.9 L V8 turbo', fuel: 'Petrol', drive: 'RWD', gearbox: '5-speed Manual', weightKg: 1100, lengthMm: 4358,
  specSheet: 'unlocked', yourCatch: false,
};

describe('card renderer', () => {
  it('uses only colours a browser can parse, for every tier and option', () => {
    for (const t of TIERS) {
      for (const backdrop of [false, true]) {
        const { canvas } = fakeCanvas();
        expect(() => renderCard(canvas, { ...card, tier: t.id, specSheet: 'locked' }, null, { scale: 3, backdrop })).not.toThrow();
        expect(canvas.width).toBe(backdrop ? (360 + 48) * 3 : 1080);
        expect(canvas.height).toBe(Math.round((cardHeight(card) + (backdrop ? 48 : 0)) * 3));
      }
    }
  });
});
