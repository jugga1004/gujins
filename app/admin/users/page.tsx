export const dynamic = 'force-dynamic';

import { getSession } from '@/lib/auth';
import { query, initDb } from '@/lib/db';
import { redirect } from 'next/navigation';
import AdminUsersClient from './AdminUsersClient';
import Header from '@/components/layout/Header';

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/meetings');

  await initDb();
  const users = await query(
    'SELECT id, username, display_name, role, created_at, is_active FROM moim_users ORDER BY created_at ASC'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={{ displayName: session.displayName, role: session.role }} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <AdminUsersClient initialUsers={users} />
      </main>
    </div>
  );
}
