export const dynamic = 'force-dynamic';

import { getSession } from '@/lib/auth';
import { query, queryOne, initDb } from '@/lib/db';
import { notFound } from 'next/navigation';
import MeetingDetailClient from './MeetingDetailClient';

type Params = { params: Promise<{ id: string }> };

export default async function MeetingDetailPage({ params }: Params) {
  const { id } = await params;
  const meetingId = parseInt(id);
  const session = await getSession();
  await initDb();

  const meeting = await queryOne(
    'SELECT m.*, u.display_name as creator_name FROM moim_meetings m JOIN moim_users u ON m.created_by = u.id WHERE m.id = $1',
    [meetingId]
  );
  if (!meeting) notFound();

  const [photos, expenses, receipts, audioFiles, comments, members] = await Promise.all([
    query('SELECT * FROM moim_photos WHERE meeting_id = $1 ORDER BY sort_order ASC, uploaded_at ASC', [meetingId]),
    query('SELECT * FROM moim_expense_items WHERE meeting_id = $1 ORDER BY created_at ASC', [meetingId]),
    query('SELECT * FROM moim_receipts WHERE meeting_id = $1 ORDER BY uploaded_at ASC', [meetingId]),
    query('SELECT * FROM moim_audio_files WHERE meeting_id = $1 ORDER BY uploaded_at ASC', [meetingId]),
    query('SELECT c.*, u.display_name as author_name FROM moim_comments c JOIN moim_users u ON c.author_id = u.id WHERE c.meeting_id = $1 AND c.is_deleted = 0 ORDER BY c.created_at ASC', [meetingId]),
    query('SELECT u.id, u.username, u.display_name FROM moim_meeting_members mm JOIN moim_users u ON mm.user_id = u.id WHERE mm.meeting_id = $1', [meetingId]),
  ]);

  const initialData = {
    ...meeting,
    topics: JSON.parse((meeting.topics as string) || '[]'),
    photos, expenses, receipts, audioFiles, comments, members,
  };

  return <MeetingDetailClient initialData={initialData} session={session!} />;
}
