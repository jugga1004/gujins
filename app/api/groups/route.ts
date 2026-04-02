import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, initDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  await initDb();
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const groups = await query<{ id: number; name: string; created_by: number; created_at: string; member_count: number }>(
    `SELECT g.id, g.name, g.created_by, g.created_at,
       (SELECT COUNT(*) FROM moim_group_members WHERE group_id = g.id)::int as member_count
     FROM moim_groups g
     JOIN moim_group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1
     ORDER BY g.created_at DESC`,
    [session.userId]
  );

  return NextResponse.json({ data: groups });
}

export async function POST(request: NextRequest) {
  await initDb();
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: '모임 이름을 입력해주세요.' }, { status: 400 });

  // 이름 중복 체크
  const existing = await queryOne('SELECT id FROM moim_groups WHERE name = $1', [name.trim()]);
  if (existing) return NextResponse.json({ error: '이미 사용 중인 모임 이름입니다.' }, { status: 409 });

  const rows = await query<{ id: number }>(
    `INSERT INTO moim_groups (name, created_by) VALUES ($1, $2) RETURNING id`,
    [name.trim(), session.userId]
  );
  const groupId = rows[0].id;

  // 방장을 멤버로 추가
  await execute(
    'INSERT INTO moim_group_members (group_id, user_id) VALUES ($1, $2)',
    [groupId, session.userId]
  );

  const group = await queryOne('SELECT * FROM moim_groups WHERE id = $1', [groupId]);
  return NextResponse.json({ data: group }, { status: 201 });
}
