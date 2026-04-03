export const dynamic = 'force-dynamic';

import { getSession } from '@/lib/auth';
import { queryOne, query, initDb } from '@/lib/db';
import { redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/groups');

  await initDb();

  const [stats, users, groups, meetings] = await Promise.all([
    queryOne<{ user_count: number; group_count: number; meeting_count: number; comment_count: number; photo_count: number }>(`
      SELECT
        (SELECT COUNT(*) FROM moim_users)::int as user_count,
        (SELECT COUNT(*) FROM moim_groups)::int as group_count,
        (SELECT COUNT(*) FROM moim_meetings)::int as meeting_count,
        (SELECT COUNT(*) FROM moim_comments WHERE is_deleted = 0)::int as comment_count,
        (SELECT COUNT(*) FROM moim_photos)::int as photo_count
    `),
    query(`
      SELECT id, username, display_name, role, created_at, is_active
      FROM moim_users ORDER BY created_at DESC
    `),
    query(`
      SELECT g.id, g.name, g.created_at,
        u.display_name as creator_name,
        (SELECT COUNT(*) FROM moim_group_members WHERE group_id = g.id)::int as member_count,
        (SELECT COUNT(*) FROM moim_meetings WHERE group_id = g.id)::int as meeting_count
      FROM moim_groups g JOIN moim_users u ON g.created_by = u.id
      ORDER BY g.created_at DESC
    `),
    query(`
      SELECT m.id, m.title, m.meeting_date, m.location, m.created_at,
        g.name as group_name, u.display_name as creator_name,
        (SELECT COUNT(*) FROM moim_photos WHERE meeting_id = m.id)::int as photo_count,
        (SELECT COUNT(*) FROM moim_comments WHERE meeting_id = m.id AND is_deleted = 0)::int as comment_count
      FROM moim_meetings m
      JOIN moim_groups g ON m.group_id = g.id
      JOIN moim_users u ON m.created_by = u.id
      ORDER BY m.created_at DESC
    `),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={{ displayName: session.displayName, role: session.role }} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">관리자 대시보드</h1>
          <a href="/admin/users" className="text-sm text-indigo-600 hover:underline">회원 관리 →</a>
        </div>
        <AdminDashboardClient
          stats={stats ?? { user_count: 0, group_count: 0, meeting_count: 0, comment_count: 0, photo_count: 0 }}
          initialUsers={users}
          initialGroups={groups}
          initialMeetings={meetings}
        />
      </main>
    </div>
  );
}
