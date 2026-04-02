import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, initDb } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await initDb();
    const { username } = await request.json();
    if (!username?.trim()) {
      return NextResponse.json({ error: '아이디를 입력해주세요.' }, { status: 400 });
    }

    const trimmed = username.trim();

    // 기존 유저 조회
    let user = await queryOne<{ id: number; username: string; display_name: string; role: string }>(
      'SELECT id, username, display_name, role FROM moim_users WHERE username = $1 AND is_active = 1',
      [trimmed]
    );

    // 없으면 자동 생성
    if (!user) {
      user = await queryOne<{ id: number; username: string; display_name: string; role: string }>(
        `INSERT INTO moim_users (username, display_name, role)
         VALUES ($1, $1, 'member')
         ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
         RETURNING id, username, display_name, role`,
        [trimmed]
      );
    }

    if (!user) return NextResponse.json({ error: '로그인에 실패했습니다.' }, { status: 500 });

    await setSessionCookie({
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role as 'admin' | 'member',
    });

    return NextResponse.json({ data: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } });
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
