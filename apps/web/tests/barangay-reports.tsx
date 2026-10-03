import React from 'react';
import { createRoot } from 'react-dom/client';
import { Reports } from '../src/components/admin/pages/BarangayReports';
import { Reports as AdminReports } from '../src/components/admin/pages/Reports';
import '../src/index.css';

const params = new URLSearchParams(location.search);
const admin = params.get('role') === 'admin';
let fail = params.get('state') === 'error';
const empty = params.get('state') === 'empty';
window.fetch = async (input) => {
  await new Promise(resolve => setTimeout(resolve, 150));
  if (fail) return new Response(JSON.stringify({ message: 'Fixture: report request failed.' }), { status: 500 });
  const url = new URL(String(input));
  if (url.pathname.endsWith('/admin/stats')) return new Response(JSON.stringify({ overview: { totalUsers: 120, signupsToday: 5, totalLessons: 2, totalChallenges: 3, totalPoints: 10, lessonCompletions: 2, onlineNow: 1, activeToday: 5 }, activityTrend: [] }), { headers: { 'Content-Type': 'application/json' } });
  const report = {
    barangay: admin ? (url.searchParams.get('barangay') === 'all' ? null : url.searchParams.get('barangay')) : 'Yukos',
    barangays: admin ? ['Abo', 'Yukos'] : ['Yukos'], from: url.searchParams.get('from'), to: url.searchParams.get('to'), generatedAt: new Date().toISOString(),
    sections: [
      { title: 'Barangay Overview', metrics: { 'Registered residents (current)': empty ? 0 : 120, 'New registrations': empty ? 0 : 5, 'Residents with last activity in period': empty ? 0 : 12 } },
      { title: 'Announcements', metrics: { 'Published announcements in period': empty ? 0 : 1 } },
      ...['Challenges', 'Events', 'Learning Progress', 'Rewards & Badges', 'Give & Get', 'Redeem Requests'].map(title => ({ title, metrics: { 'Fixture count': empty ? 0 : 3 } })),
    ],
    announcements: empty ? [] : [{ id: 'fixture', title: 'Fixture: community cleanup announcement', status: 'Published', category: 'Community', publishedAt: '2026-10-02T00:00:00Z' }],
    notes: 'Explicit test fixtures, not production resident data.',
  };
  if (url.pathname.endsWith('/pdf') || url.pathname.endsWith('/excel')) return new Response('fixture export');
  return new Response(JSON.stringify(report), { headers: { 'Content-Type': 'application/json' } });
};
createRoot(document.getElementById('root')!).render(<div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950">
  <div className="mb-5 flex flex-wrap gap-4"><strong>Verification fixture</strong><button onClick={() => document.documentElement.classList.toggle('dark')}>Toggle test theme</button><button onClick={() => { fail = false; }}>Recover test API</button></div>
  {admin ? <AdminReports /> : <Reports role="moderator" />}
</div>);
