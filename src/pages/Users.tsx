import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import type { Page, Role, User, UserDetail } from '../api/types';
import { useAuth, useIsAdmin } from '../auth';
import { useToast } from '../components/toast';
import {
  Badge, Button, Empty, Field, KV, Loader, PageHeader, Pager, Panel, ReasonDialog, SearchBox, StatusBadge, Thumb,
} from '../components/ui';
import { fmtAgo, fmtDate, fmtDateTime, fmtNumber, fmtPercent, humanize, idempotencyKey } from '../lib/format';
import { useFilters } from '../lib/useFilters';

const LIMIT = 25;

export function Users() {
  const { values, offset, set } = useFilters(['search', 'status', 'role'] as const);
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['users', values, offset],
    queryFn: () => api.get<Page<User>>('/v1/admin/users', { ...values, limit: LIMIT, offset }),
  });
  return (
    <>
      <PageHeader title="Users" subtitle={isAdmin ? 'Search by name, username or email.' : 'Search by name or username. Emails are visible to admins only.'} />
      <div className="toolbar">
        <SearchBox value={values.search} onChange={(v) => set({ search: v })} placeholder={isAdmin ? 'Name, username or email' : 'Name or username'} />
        <select className="input" aria-label="Account status" value={values.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          {['active', 'suspended', 'banned', 'pending_verification', 'deletion_pending'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <select className="input" aria-label="Role" value={values.role} onChange={(e) => set({ role: e.target.value })}>
          <option value="">All roles</option>
          {['user', 'moderator', 'admin'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
      </div>
      <Loader q={q}>
        {(d) =>
          d.items.length === 0 ? <Empty title="No users match" /> : (
            <Panel>
              <table className="table clickable">
                <thead>
                  <tr><th>Player</th>{isAdmin && <th>Email</th>}<th>Status</th><th>Role</th><th className="num">Level</th><th className="num">Cards</th><th className="num">Coins</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {d.items.map((u) => (
                    <tr key={u.userId} onClick={() => navigate(`/users/${u.userId}`)}>
                      <td><Link to={`/users/${u.userId}`} onClick={(e) => e.stopPropagation()}>{u.displayName}</Link><div className="faint small">@{u.username}</div></td>
                      {isAdmin && <td className="small">{u.email}</td>}
                      <td><StatusBadge status={u.accountStatus} /></td>
                      <td><StatusBadge status={u.role} /></td>
                      <td className="num">{u.level}</td>
                      <td className="num">{fmtNumber(u.carCount)}</td>
                      <td className="num">{fmtNumber(u.coins)}</td>
                      <td>{fmtDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager offset={offset} limit={LIMIT} total={d.total} onChange={(o) => set({ offset: o })} />
            </Panel>
          )
        }
      </Loader>
    </>
  );
}

type Action = { kind: 'status'; status: 'active' | 'suspended' | 'banned' } | { kind: 'role' } | { kind: 'coins' };

export function UserView() {
  const id = Number(useParams().id);
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [action, setAction] = useState<Action | null>(null);
  const q = useQuery({ queryKey: ['user', id], queryFn: () => api.get<UserDetail>(`/v1/admin/users/${id}`) });
  return (
    <>
      <PageHeader title="User" subtitle={<Link to="/users">← All users</Link>} />
      <Loader q={q}>
        {(u) => {
          const self = u.userId === me?.userId;
          const canEnforce = isAdmin && !self && u.role !== 'admin';
          return (
            <div className="stack">
              <Panel>
                <div className="profile-head">
                  <div className="avatar" aria-hidden="true">{u.displayName.slice(0, 1).toUpperCase()}</div>
                  <div className="grow">
                    <h2 className="profile-name">{u.displayName}</h2>
                    <div className="muted">@{u.username}{u.email && ` · ${u.email}`}</div>
                    <div className="row">
                      <StatusBadge status={u.accountStatus} /> <StatusBadge status={u.role} />
                      {u.emailVerified ? <Badge tone="good">Email confirmed</Badge> : <Badge tone="warn">Email not confirmed</Badge>}
                      {self && <Badge tone="muted">You</Badge>}
                    </div>
                  </div>
                  {isAdmin && !self && (
                    <div className="row wrap">
                      {u.accountStatus === 'active' ? (
                        <>
                          <Button disabled={!canEnforce} onClick={() => setAction({ kind: 'status', status: 'suspended' })}>Suspend</Button>
                          <Button kind="danger" disabled={!canEnforce} onClick={() => setAction({ kind: 'status', status: 'banned' })}>Ban</Button>
                        </>
                      ) : (
                        <Button kind="primary" disabled={!canEnforce} onClick={() => setAction({ kind: 'status', status: 'active' })}>Reinstate</Button>
                      )}
                      <Button onClick={() => setAction({ kind: 'role' })}>Change role</Button>
                      <Button onClick={() => setAction({ kind: 'coins' })}>Adjust coins</Button>
                    </div>
                  )}
                </div>
                {isAdmin && !self && u.role === 'admin' && <p className="faint small">Remove the admin role before suspending or banning this account.</p>}
                <div className="tiles compact">
                  {([
                    ['Level', u.level], ['XP', u.xp], ['Coins', u.coins], ['Cards', u.carCount], ['Scans', u.counts.captures],
                    ['Followers', u.counts.followers], ['Following', u.counts.following], ['Reports against', u.counts.reportsAgainst],
                  ] as const).map(([k, v]) => (
                    <div key={k} className="tile"><div className="tile-label">{k}</div><div className="tile-value small">{fmtNumber(v)}</div></div>
                  ))}
                </div>
                <KV items={[
                  ['Region', [u.city, u.countryCode].filter(Boolean).join(', ') || '—'],
                  ['Joined', fmtDateTime(u.createdAt)],
                ]} />
              </Panel>

              <Panel title="Recent scans" actions={<Link className="link-btn" to={`/captures?userId=${u.userId}`}>All scans →</Link>}>
                {u.recentCaptures.length === 0 ? <p className="muted small">No scans yet.</p> : (
                  <div className="scan-strip">
                    {u.recentCaptures.map((c) => (
                      <Link key={c.captureId} to={`/captures/${c.captureId}`} className="scan-tile">
                        <Thumb url={c.imageUrl} alt={`Scan ${c.captureId}`} size="md" />
                        <div className="small">{c.vehicle ?? 'No match'}</div>
                        <div className="row"><StatusBadge status={c.status} /><span className="faint small">{fmtPercent(c.confidence)}</span></div>
                        <div className="faint small">{fmtAgo(c.createdAt)}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </Panel>

              <div className="grid-2">
                <Panel title="Coin ledger (latest)">
                  {u.coinTransactions.length === 0 ? <p className="muted small">No coin activity.</p> : (
                    <table className="table compact">
                      <thead><tr><th>When</th><th>Type</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
                      <tbody>{u.coinTransactions.map((t) => (
                        <tr key={t.transactionId}><td>{fmtDateTime(t.createdAt)}</td><td>{humanize(t.type)}</td>
                          <td className={`num ${t.amount < 0 ? 'neg' : 'pos'}`}>{t.amount > 0 ? '+' : ''}{t.amount}</td><td className="num">{t.balanceAfter}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                </Panel>
                <Panel title="Admin history">
                  {u.history.length === 0 ? <p className="muted small">No admin actions on this account.</p> : (
                    <ul className="timeline">
                      {u.history.map((h) => <li key={h.auditId}><strong>{humanize(h.action)}</strong> — {h.reason} <span className="faint">@{h.actor}, {fmtDateTime(h.createdAt)}</span></li>)}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
          );
        }}
      </Loader>
      {action && q.data && <UserActionDialog user={q.data} action={action} onClose={() => setAction(null)} />}
    </>
  );
}

function UserActionDialog({ user, action, onClose }: { user: UserDetail; action: Action; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [role, setRole] = useState<Role>(user.role);
  const [amount, setAmount] = useState('');
  // One key per dialog: pressing confirm twice can't adjust twice.
  const key = useMemo(idempotencyKey, []);
  const done = (text: string) => {
    qc.invalidateQueries({ queryKey: ['user', user.userId] });
    qc.invalidateQueries({ queryKey: ['users'] });
    toast(text);
  };
  const m = useMutation({
    mutationFn: async (reason: string) => {
      if (action.kind === 'status') {
        await api.post(`/v1/admin/users/${user.userId}/status`, { status: action.status, reason });
        done(action.status === 'active' ? 'Account reinstated.' : action.status === 'banned' ? 'Account banned.' : 'Account suspended.');
      } else if (action.kind === 'role') {
        await api.post(`/v1/admin/users/${user.userId}/role`, { role, reason });
        done(`Role changed to ${role}.`);
      } else {
        const n = Number(amount);
        if (!Number.isInteger(n) || n === 0) throw new Error('Enter a whole number other than 0, e.g. 50 or -20.');
        const r = await api.post<{ coins: number; alreadyApplied: boolean }>(`/v1/admin/users/${user.userId}/coins`, {
          amount: n, reason, idempotencyKey: key,
        });
        done(r.alreadyApplied ? 'This adjustment was already applied.' : `Balance is now ${r.coins} coins.`);
      }
    },
  });

  if (action.kind === 'status') {
    const words = { active: ['Reinstate', 'They can sign in and play again.'], suspended: ['Suspend', 'They are signed out everywhere and cannot sign in until reinstated.'], banned: ['Ban', 'They are signed out everywhere and cannot sign in. Use for serious or repeated abuse.'] }[action.status];
    return (
      <ReasonDialog title={`${words[0]} @${user.username}?`} description={words[1]} confirmLabel={words[0]!}
        danger={action.status !== 'active'} onClose={onClose} onConfirm={(r) => m.mutateAsync(r)} />
    );
  }
  if (action.kind === 'role') {
    return (
      <ReasonDialog title={`Change @${user.username}'s role`} confirmLabel="Change role" onClose={onClose} onConfirm={(r) => m.mutateAsync(r)}
        description="Moderators review scans and reports. Admins can also manage accounts, the catalogue, the store and the audit log.">
        <Field label="Role">
          {(id) => (
            <select id={id} className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option>
            </select>
          )}
        </Field>
      </ReasonDialog>
    );
  }
  return (
    <ReasonDialog title={`Adjust @${user.username}'s coins`} confirmLabel="Apply adjustment" onClose={onClose} onConfirm={(r) => m.mutateAsync(r)}
      description={<>Current balance: <strong>{user.coins}</strong>. The change is written to the coin ledger and can't be undone except by another adjustment.</>}>
      <Field label="Amount" hint="Positive to add, negative to remove. The balance can't go below 0.">
        {(id) => <input id={id} className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50 or -20" />}
      </Field>
    </ReasonDialog>
  );
}
