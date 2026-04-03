import { NextRequest, NextResponse } from 'next/server';
import { query, execute, initDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  await initDb();
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');

  const meetings = await query(`
    SELECT m.*,
      COALESCE(NULLIF(gm.display_name,''), u.display_name) as creator_name,
      (SELECT COUNT(*) FROM moim_photos WHERE meeting_id = m.id)::int as photo_count,
      (SELECT COUNT(*) FROM moim_comments WHERE meeting_id = m.id AND is_deleted = 0)::int as comment_count,
      (SELECT file_path FROM moim_photos WHERE meeting_id = m.id ORDER BY sort_order ASC LIMIT 1) as thumb_path
    FROM moim_meetings m
    JOIN moim_users u ON m.created_by = u.id
    LEFT JOIN moim_group_members gm ON gm.group_id = m.group_id AND gm.user_id = m.created_by
    WHERE m.group_id = $1
    ORDER BY m.meeting_date DESC, m.created_at DESC
  `, [groupId ? parseInt(groupId) : null]);

  return NextResponse.json({ data: meetings });
}

export async function POST(request: NextRequest) {
  await initDb();
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { title, meetingDate, location, description, topics, members, groupId } = await request.json();
  if (!title || !meetingDate) return NextResponse.json({ error: '제목과 날짜는 필수입니다.' }, { status: 400 });

  const rows = await query<{ id: number }>(
    `INSERT INTO moim_meetings (title, meeting_date, location, description, topics, created_by, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [title, meetingDate, location || null, description || null, JSON.stringify(topics || []), session.userId, groupId || null]
  );
  const meetingId = rows[0].id;

  if (Array.isArray(members) && members.length > 0) {
    for (const userId of members) {
      await execute(
        'INSERT INTO moim_meeting_members (meeting_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [meetingId, userId]
      );
    }
  }

  const meeting = await query('SELECT * FROM moim_meetings WHERE id = $1', [meetingId]);
  return NextResponse.json({ data: meeting[0] }, { status: 201 });
}
