import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const [stats, recentUsers, recentGroups, recentMeetings] = await Promise.all([
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
      FROM moim_users ORDER BY created_at DESC LIMIT 10
    `),
    query(`
      SELECT g.id, g.name, g.created_at,
        u.display_name as creator_name,
        (SELECT COUNT(*) FROM moim_group_members WHERE group_id = g.id)::int as member_count,
        (SELECT COUNT(*) FROM moim_meetings WHERE group_id = g.id)::int as meeting_count
      FROM moim_groups g JOIN moim_users u ON g.created_by = u.id
      ORDER BY g.created_at DESC LIMIT 20
    `),
    query(`
      SELECT m.id, m.title, m.meeting_date, m.location, m.created_at,
        g.name as group_name, u.display_name as creator_name,
        (SELECT COUNT(*) FROM moim_photos WHERE meeting_id = m.id)::int as photo_count,
        (SELECT COUNT(*) FROM moim_comments WHERE meeting_id = m.id AND is_deleted = 0)::int as comment_count
      FROM moim_meetings m
      JOIN moim_groups g ON m.group_id = g.id
      JOIN moim_users u ON m.created_by = u.id
      ORDER BY m.created_at DESC LIMIT 20
    `),
  ]);

  return NextResponse.json({ data: { stats, recentUsers, recentGroups, recentMeetings } });
}
