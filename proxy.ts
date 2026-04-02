import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'moim-record-secret-key-change-in-production'
);

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const token = request.cookies.get('session')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const headers = new Headers(request.headers);
    headers.set('x-user-id', String(payload.userId));
    headers.set('x-user-username', String(payload.username));
    headers.set('x-user-display-name', String(payload.displayName));
    headers.set('x-user-role', String(payload.role));
    return NextResponse.next({ request: { headers } });
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '세션이 만료되었습니다.' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
