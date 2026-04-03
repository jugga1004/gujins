import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query, execute, initDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  await initDb();
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id);

  // 멤버인지 확인
  const member = await queryOne(
    'SELECT 1 FROM moim_group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, session.userId]
  );
  if (!member) return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  const group = await queryOne<{ id: number; name: string; created_by: number }>(
    'SELECT id, name, created_by FROM moim_groups WHERE id = $1',
    [groupId]
  );
  if (!group) return NextResponse.json({ error: '모임을 찾을 수 없습니다.' }, { status: 404 });

  const members = await query(
    `SELECT u.id, u.username, COALESCE(NULLIF(gm.display_name,''), u.display_name) as display_name
     FROM moim_group_members gm JOIN moim_users u ON gm.user_id = u.id
     WHERE gm.group_id = $1`,
    [groupId]
  );

  const myMembership = await queryOne<{ display_name: string }>(
    'SELECT display_name FROM moim_group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, session.userId]
  );

  return NextResponse.json({ data: { ...group, members, myDisplayName: myMembership?.display_name ?? '' } });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  await initDb();
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id);
  const { displayName } = await request.json();
  if (!displayName?.trim()) return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });

  const member = await queryOne(
    'SELECT 1 FROM moim_group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, session.userId]
  );
  if (!member) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  await execute(
    'UPDATE moim_group_members SET display_name = $1 WHERE group_id = $2 AND user_id = $3',
    [displayName.trim(), groupId, session.userId]
  );

  return NextResponse.json({ data: { ok: true } });
}
