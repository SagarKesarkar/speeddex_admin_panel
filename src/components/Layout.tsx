import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';
import { api } from '../api';
import type { Stats } from '../api/types';
import { useAuth } from '../auth';
import { Badge } from './ui';

type Item = { to: string; label: string; icon: string; adminOnly?: boolean; count?: (s: Stats) => number };

const NAV: { section: string; items: Item[] }[] = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: '◧' }] },
  {
    section: 'Moderation',
    items: [
      { to: '/review', label: 'Review queue', icon: '◎', count: (s) => s.totals.pendingReviews },
      { to: '/captures', label: 'Captures', icon: '▣' },
      { to: '/reports', label: 'Reports', icon: '⚑', count: (s) => s.totals.openReports },
      { to: '/users', label: 'Users', icon: '◉' },
    ],
  },
  {
    section: 'Configuration',
    items: [
      { to: '/catalog', label: 'Catalogue', icon: '▤' },
      { to: '/store', label: 'Store', icon: '◈', adminOnly: true },
      { to: '/audit', label: 'Audit log', icon: '☰', adminOnly: true },
    ],
  },
];

export function Layout() {
  const { me, signOut } = useAuth();
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api.get<Stats>('/v1/admin/stats'), refetchInterval: 60_000 });
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">SD</span>
          <div>
            <div className="brand-name">SpeedDex</div>
            <div className="brand-sub">Admin console</div>
          </div>
        </div>
        <nav aria-label="Main">
          {NAV.map((g) => {
            const items = g.items.filter((i) => !i.adminOnly || me?.role === 'admin');
            if (!items.length) return null;
            return (
              <div key={g.section} className="nav-group">
                <div className="nav-section">{g.section}</div>
                {items.map((i) => {
                  const n = stats.data && i.count ? i.count(stats.data) : 0;
                  return (
                    <NavLink key={i.to} to={i.to} end={i.to === '/'} className="nav-link">
                      <span className="nav-icon" aria-hidden="true">{i.icon}</span>
                      <span>{i.label}</span>
                      {n > 0 && <span className="nav-count" aria-label={`${n} waiting`}>{n}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <div className="who-name">{me?.displayName}</div>
            <div className="who-sub">
              @{me?.username} · <Badge tone={me?.role === 'admin' ? 'gold' : 'info'}>{me?.role}</Badge>
            </div>
          </div>
          <button type="button" className="btn btn-ghost full" onClick={() => signOut()}>Sign out</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
