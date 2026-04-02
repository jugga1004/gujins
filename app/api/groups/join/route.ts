import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, initDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  await initDb();
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: '모임 이름을 입력해주세요.' }, { status: 400 });

  const group = await queryOne<{ id: number; name: string }>(
    'SELECT id, name FROM moim_groups WHERE name = $1',
    [name.trim()]
  );

  if (!group) return NextResponse.json({ error: '존재하지 않는 모임입니다.' }, { status: 404 });

  // 이미 멤버인지 확인
  const already = await queryOne(
    'SELECT 1 FROM moim_group_members WHERE group_id = $1 AND user_id = $2',
    [group.id, session.userId]
  );

  if (!already) {
    await execute(
      'INSERT INTO moim_group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, session.userId]
    );
  }

  return NextResponse.json({ data: group });
}
