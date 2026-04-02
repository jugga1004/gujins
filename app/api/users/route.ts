import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const users = await query('SELECT id, username, display_name, role, created_at, is_active FROM moim_users ORDER BY created_at ASC');
  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '관리자만 사용자를 추가할 수 있습니다.' }, { status: 403 });
  }
  const { username, displayName, role } = await request.json();
  if (!username || !displayName) return NextResponse.json({ error: '아이디와 이름은 필수입니다.' }, { status: 400 });

  const existing = await query('SELECT id FROM moim_users WHERE username = $1', [username]);
  if (existing.length > 0) return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });

  const rows = await query<{ id: number }>(
    'INSERT INTO moim_users (username, display_name, role) VALUES ($1, $2, $3) RETURNING id',
    [username, displayName, role || 'member']
  );
  const user = await query('SELECT id, username, display_name, role, created_at FROM moim_users WHERE id = $1', [rows[0].id]);
  return NextResponse.json({ data: user[0] }, { status: 201 });
}
