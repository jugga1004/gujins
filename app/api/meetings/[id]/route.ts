import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  const meetingId = parseInt(id);

  const meeting = await queryOne(
    'SELECT m.*, u.display_name as creator_name FROM moim_meetings m JOIN moim_users u ON m.created_by = u.id WHERE m.id = $1',
    [meetingId]
  );
  if (!meeting) return NextResponse.json({ error: '모임을 찾을 수 없습니다.' }, { status: 404 });

  const [photos, expenses, receipts, audioFiles, comments, members] = await Promise.all([
    query('SELECT * FROM moim_photos WHERE meeting_id = $1 ORDER BY sort_order ASC, uploaded_at ASC', [meetingId]),
    query('SELECT * FROM moim_expense_items WHERE meeting_id = $1 ORDER BY created_at ASC', [meetingId]),
    query('SELECT * FROM moim_receipts WHERE meeting_id = $1 ORDER BY uploaded_at ASC', [meetingId]),
    query('SELECT * FROM moim_audio_files WHERE meeting_id = $1 ORDER BY uploaded_at ASC', [meetingId]),
    query('SELECT c.*, u.display_name as author_name FROM moim_comments c JOIN moim_users u ON c.author_id = u.id WHERE c.meeting_id = $1 AND c.is_deleted = 0 ORDER BY c.created_at ASC', [meetingId]),
    query(`SELECT u.id, u.username,
       COALESCE(NULLIF(gm.display_name,''), u.display_name) as display_name
     FROM moim_meeting_members mm
     JOIN moim_users u ON mm.user_id = u.id
     LEFT JOIN moim_meetings m2 ON m2.id = mm.meeting_id
     LEFT JOIN moim_group_members gm ON gm.group_id = m2.group_id AND gm.user_id = u.id
     WHERE mm.meeting_id = $1`, [meetingId]),
  ]);

  return NextResponse.json({
    data: { ...meeting, topics: JSON.parse((meeting.topics as string) || '[]'), photos, expenses, receipts, audioFiles, comments, members },
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  const meetingId = parseInt(id);
  const { title, meetingDate, location, description, topics, members } = await request.json();

  await execute(
    'UPDATE moim_meetings SET title=$1, meeting_date=$2, location=$3, description=$4, topics=$5, updated_at=NOW() WHERE id=$6',
    [title, meetingDate, location || null, description || null, JSON.stringify(topics || []), meetingId]
  );

  if (Array.isArray(members)) {
    await execute('DELETE FROM moim_meeting_members WHERE meeting_id = $1', [meetingId]);
    for (const userId of members) {
      await execute('INSERT INTO moim_meeting_members (meeting_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [meetingId, userId]);
    }
  }

  const updated = await queryOne('SELECT * FROM moim_meetings WHERE id = $1', [meetingId]);
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  const meetingId = parseInt(id);

  const meeting = await queryOne<{ created_by: number }>('SELECT created_by FROM moim_meetings WHERE id = $1', [meetingId]);
  if (!meeting) return NextResponse.json({ error: '모임을 찾을 수 없습니다.' }, { status: 404 });
  if (session.role !== 'admin' && meeting.created_by !== session.userId) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  await execute('DELETE FROM moim_meetings WHERE id = $1', [meetingId]);
  return NextResponse.json({ data: { ok: true } });
}
