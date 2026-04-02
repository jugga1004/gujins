export const dynamic = 'force-dynamic';

import { getSession } from '@/lib/auth';
import { query, initDb } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';

interface GroupRow {
  id: number;
  name: string;
  code: string;
  created_by: number;
  member_count: number;
  created_at: string;
}

export default async function GroupsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  await initDb();

  const groups = await query<GroupRow>(
    `SELECT g.id, g.name, g.code, g.created_by, g.created_at,
       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id)::int as member_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1
     ORDER BY g.created_at DESC`,
    [session.userId]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={{ displayName: session.displayName, role: session.role }} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">내 모임</h1>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <Link
            href="/groups/new"
            className="flex flex-col items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl py-5 font-medium hover:bg-indigo-700 transition"
          >
            <span className="text-2xl">➕</span>
            <span>모임 만들기</span>
          </Link>
          <Link
            href="/groups/join"
            className="flex flex-col items-center justify-center gap-2 bg-white text-indigo-600 border-2 border-indigo-200 rounded-2xl py-5 font-medium hover:bg-indigo-50 transition"
          >
            <span className="text-2xl">🚪</span>
            <span>모임 참여하기</span>
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">👥</div>
            <p className="text-lg font-medium">참여 중인 모임이 없어요</p>
            <p className="text-sm mt-2">모임을 만들거나 방 코드로 참여해보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-800 text-lg">{group.name}</h2>
                    <p className="text-sm text-gray-400 mt-0.5">멤버 {group.member_count}명</p>
                  </div>
                  <div className="text-gray-300 text-xl">›</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
