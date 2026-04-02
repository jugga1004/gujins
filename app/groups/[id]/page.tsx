export const dynamic = 'force-dynamic';

import { getSession } from '@/lib/auth';
import { query, queryOne, initDb } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Header from '@/components/layout/Header';

type Params = { params: Promise<{ id: string }> };

interface MeetingRow {
  id: number;
  title: string;
  meeting_date: string;
  location: string | null;
  total_cost: number;
  topics: string;
  creator_name: string;
  photo_count: number;
  comment_count: number;
  thumb_path: string | null;
}

export default async function GroupDetailPage({ params }: Params) {
  const session = await getSession();
  if (!session) redirect('/login');
  await initDb();

  const { id } = await params;
  const groupId = parseInt(id);

  // 멤버 확인
  const member = await queryOne(
    'SELECT 1 FROM moim_group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, session.userId]
  );
  if (!member) redirect('/groups');

  const group = await queryOne<{ id: number; name: string; created_by: number }>(
    'SELECT id, name, created_by FROM moim_groups WHERE id = $1',
    [groupId]
  );
  if (!group) notFound();

  const meetings = await query<MeetingRow>(`
    SELECT
      m.id, m.title, m.meeting_date, m.location, m.total_cost, m.topics,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM moim_photos WHERE meeting_id = m.id)::int as photo_count,
      (SELECT COUNT(*) FROM moim_comments WHERE meeting_id = m.id AND is_deleted = 0)::int as comment_count,
      (SELECT file_path FROM moim_photos WHERE meeting_id = m.id ORDER BY sort_order ASC LIMIT 1) as thumb_path
    FROM moim_meetings m
    JOIN moim_users u ON m.created_by = u.id
    WHERE m.group_id = $1
    ORDER BY m.meeting_date DESC, m.created_at DESC
  `, [groupId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={{ displayName: session.displayName, role: session.role }} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/groups" className="text-gray-400 hover:text-gray-600 text-xl">←</Link>
            <h1 className="text-2xl font-bold text-gray-800">{group.name}</h1>
          </div>
          <Link
            href={`/groups/${groupId}/meetings/new`}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition text-sm"
          >
            + 새 기록
          </Link>
        </div>

        {meetings.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📝</div>
            <p className="text-lg">아직 기록된 모임이 없어요.</p>
            <p className="text-sm mt-2">첫 번째 모임을 기록해보세요!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => {
              const topics: string[] = JSON.parse(meeting.topics || '[]');
              const formattedDate = (() => {
                try {
                  return format(new Date(meeting.meeting_date), 'yyyy년 M월 d일 (E)', { locale: ko });
                } catch {
                  return meeting.meeting_date;
                }
              })();

              return (
                <Link key={meeting.id} href={`/meetings/${meeting.id}?groupId=${groupId}`}>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition cursor-pointer">
                    <div className="h-44 bg-gradient-to-br from-indigo-100 to-purple-100 relative overflow-hidden">
                      {meeting.thumb_path ? (
                        <img src={meeting.thumb_path} alt="모임 사진" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-4xl text-indigo-300">📷</div>
                      )}
                      {meeting.photo_count > 0 && (
                        <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
                          📷 {meeting.photo_count}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-indigo-500 font-medium mb-1">{formattedDate}</p>
                      <h2 className="font-bold text-gray-800 text-lg leading-tight line-clamp-2">{meeting.title}</h2>
                      {meeting.location && (
                        <p className="text-xs text-gray-400 mt-1">📍 {meeting.location}</p>
                      )}
                      {topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {topics.slice(0, 3).map((topic, i) => (
                            <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{topic}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                        <span className="text-xs text-gray-400">{meeting.creator_name}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {meeting.total_cost > 0 && <span>💰 {meeting.total_cost.toLocaleString('ko-KR')}원</span>}
                          <span>💬 {meeting.comment_count}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
