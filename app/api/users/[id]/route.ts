import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  const { id } = await params;
  const userId = parseInt(id);
  const { displayName, role, isActive } = await request.json();

  if (displayName) await execute('UPDATE users SET display_name = $1 WHERE id = $2', [displayName, userId]);
  if (role) await execute('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
  if (isActive !== undefined) await execute('UPDATE users SET is_active = $1 WHERE id = $2', [isActive ? 1 : 0, userId]);

  const user = await query('SELECT id, username, display_name, role, created_at, is_active FROM moim_users WHERE id = $1', [userId]);
  return NextResponse.json({ data: user[0] });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  const { id } = await params;
  const userId = parseInt(id);
  if (userId === session.userId) return NextResponse.json({ error: '자신의 계정은 삭제할 수 없습니다.' }, { status: 400 });
  await execute('UPDATE users SET is_active = 0 WHERE id = $1', [userId]);
  return NextResponse.json({ data: { ok: true } });
}
