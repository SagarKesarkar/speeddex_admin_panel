import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import type { CoinOffer, GarageOffer, Purchases } from '../api/types';
import { FormDialog, type FieldSpec } from '../components/FormDialog';
import { useToast } from '../components/toast';
import { Badge, Button, Loader, PageHeader, Panel, StatusBadge } from '../components/ui';
import { fmtDateTime, fmtMoney, fmtNumber, humanize } from '../lib/format';

const COMMON: FieldSpec[] = [
  { key: 'price', label: 'Price', type: 'decimal', hint: '0 for free / ad offers' },
  { key: 'currency', label: 'Currency', type: 'text', hint: '3-letter code, e.g. USD or INR' },
  { key: 'productIdentifier', label: 'Store product ID', type: 'text', hint: 'The SKU in Google Play / App Store' },
  { key: 'isActive', label: 'Listed in the app', type: 'checkbox' },
];
const COIN_FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'coinsAmount', label: 'Coins', type: 'number', required: true },
  { key: 'bonusCoins', label: 'Bonus coins', type: 'number' },
  ...COMMON,
];
const GARAGE_FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'rewardSlots', label: 'Garage slots', type: 'number', required: true },
  { key: 'offerType', label: 'Type', type: 'select', required: true, options: [{ value: 'PURCHASE', label: 'Purchase' }, { value: 'AD_WATCH', label: 'Watch an ad' }] },
  ...COMMON,
];

type Form = { kind: 'coin'; offer?: CoinOffer } | { kind: 'garage'; offer?: GarageOffer };

export function Store() {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => api.get<{ coinOffers: CoinOffer[]; garageOffers: GarageOffer[] }>('/v1/admin/offers') });
  const purchases = useQuery({ queryKey: ['purchases'], queryFn: () => api.get<Purchases>('/v1/admin/purchases', { limit: 50 }) });

  return (
    <>
      <PageHeader title="Store" subtitle="Coin bundles and garage-slot offers shown in the app." />
      <div className="callout info" role="note">
        Purchases and rewarded ads are switched off in the app until Google Play / App Store receipt checks and an ad network are connected.
        Offers you list here are shown, but can't be bought yet.
      </div>
      <Loader q={offers}>
        {(d) => (
          <div className="grid-2">
            <Panel title="Coin bundles" actions={<Button kind="primary" onClick={() => setForm({ kind: 'coin' })}>Add bundle</Button>}>
              {d.coinOffers.length === 0 ? <p className="muted small">No coin bundles yet.</p> : (
                <table className="table">
                  <thead><tr><th>Offer</th><th className="num">Coins</th><th className="num">Price</th><th>Listed</th><th /></tr></thead>
                  <tbody>{d.coinOffers.map((o) => (
                    <tr key={o.offerId}>
                      <td>{o.title}<div className="faint small mono">{o.productIdentifier ?? 'no product ID'}</div></td>
                      <td className="num">{fmtNumber(o.coinsAmount)}{o.bonusCoins > 0 && <span className="pos"> +{o.bonusCoins}</span>}</td>
                      <td className="num">{fmtMoney(o.price, o.currency)}</td>
                      <td>{o.isActive ? <StatusBadge status="active" /> : <Badge tone="muted">Hidden</Badge>}</td>
                      <td><Button kind="ghost" onClick={() => setForm({ kind: 'coin', offer: o })}>Edit</Button></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </Panel>
            <Panel title="Garage slots" actions={<Button kind="primary" onClick={() => setForm({ kind: 'garage' })}>Add offer</Button>}>
              {d.garageOffers.length === 0 ? <p className="muted small">No garage offers yet.</p> : (
                <table className="table">
                  <thead><tr><th>Offer</th><th className="num">Slots</th><th>Type</th><th className="num">Price</th><th>Listed</th><th /></tr></thead>
                  <tbody>{d.garageOffers.map((o) => (
                    <tr key={o.offerId}>
                      <td>{o.title}<div className="faint small mono">{o.productIdentifier ?? 'no product ID'}</div></td>
                      <td className="num">{o.rewardSlots}</td>
                      <td>{humanize(o.offerType)}</td>
                      <td className="num">{o.offerType === 'AD_WATCH' ? '—' : fmtMoney(o.price, o.currency)}</td>
                      <td>{o.isActive ? <StatusBadge status="active" /> : <Badge tone="muted">Hidden</Badge>}</td>
                      <td><Button kind="ghost" onClick={() => setForm({ kind: 'garage', offer: o })}>Edit</Button></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </Panel>
          </div>
        )}
      </Loader>

      <Panel title="Purchases">
        <Loader q={purchases}>
          {(p) => p.coinPurchases.length + p.garageRedemptions.length === 0 ? (
            <p className="muted small">No purchases recorded. They will appear here once verified store notifications are connected.</p>
          ) : (
            <table className="table">
              <thead><tr><th>When</th><th>Player</th><th>Offer</th><th>Granted</th><th>Status</th><th>Store reference</th></tr></thead>
              <tbody>
                {p.coinPurchases.map((x) => (
                  <tr key={`c${x.purchaseId}`}><td>{fmtDateTime(x.createdAt)}</td><td>@{x.username}</td><td>{x.offerTitle} · {fmtMoney(x.amountPaid, x.currency)}</td>
                    <td>{x.coinsReceived} coins</td><td><StatusBadge status={x.paymentStatus.toLowerCase()} /></td><td className="mono small">{x.storeTransactionId ?? '—'}</td></tr>
                ))}
                {p.garageRedemptions.map((x) => (
                  <tr key={`g${x.redemptionId}`}><td>{fmtDateTime(x.createdAt)}</td><td>@{x.username}</td><td>{x.offerTitle}</td>
                    <td>{x.slotsGranted} slots</td><td><StatusBadge status={x.paymentStatus.toLowerCase()} /></td><td className="mono small">{x.transactionReference ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Loader>
      </Panel>

      {form && (
        <FormDialog
          title={form.offer ? `Edit ${form.offer.title}` : form.kind === 'coin' ? 'Add a coin bundle' : 'Add a garage offer'}
          fields={form.kind === 'coin' ? COIN_FIELDS : GARAGE_FIELDS}
          editing={!!form.offer}
          initial={form.offer ?? { currency: 'USD', isActive: false, ...(form.kind === 'garage' ? { offerType: 'PURCHASE' } : {}) }}
          submitLabel={form.offer ? 'Save' : 'Add'}
          onClose={() => setForm(null)}
          onSubmit={async (changes, reason) => {
            if (form.offer) await api.patch(`/v1/admin/offers/${form.kind}/${form.offer.offerId}`, { ...changes, reason });
            else await api.post(`/v1/admin/offers/${form.kind}`, { ...changes, reason });
            qc.invalidateQueries({ queryKey: ['offers'] });
            toast(form.offer ? 'Offer saved.' : 'Offer added (hidden until you list it).');
          }}
        />
      )}
    </>
  );
}
