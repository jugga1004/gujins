import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const { id } = await params;
  const comments = await query(
    'SELECT c.*, u.display_name as author_name FROM moim_comments c JOIN moim_users u ON c.author_id = u.id WHERE c.meeting_id = $1 AND c.is_deleted = 0 ORDER BY c.created_at ASC',
    [parseInt(id)]
  );
  return NextResponse.json({ data: comments });
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const { id } = await params;
  const meetingId = parseInt(id);
  const { content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: '댓글 내용을 입력해주세요.' }, { status: 400 });

  const rows = await query<{ id: number }>(
    'INSERT INTO moim_comments (meeting_id, author_id, content) VALUES ($1, $2, $3) RETURNING id',
    [meetingId, session.userId, content.trim()]
  );
  const comment = await queryOne(
    'SELECT c.*, u.display_name as author_name FROM moim_comments c JOIN moim_users u ON c.author_id = u.id WHERE c.id = $1',
    [rows[0].id]
  );
  return NextResponse.json({ data: comment }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const { id } = await params;
  const meetingId = parseInt(id);
  const { commentId } = await request.json();

  const comment = await queryOne<{ author_id: number }>(
    'SELECT author_id FROM moim_comments WHERE id = $1 AND meeting_id = $2',
    [commentId, meetingId]
  );
  if (!comment) return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
  if (session.role !== 'admin' && comment.author_id !== session.userId) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  await execute('UPDATE comments SET is_deleted = 1 WHERE id = $1', [commentId]);
  return NextResponse.json({ data: { ok: true } });
}
