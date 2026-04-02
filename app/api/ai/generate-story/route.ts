import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { generateMeetingStory } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { meetingId } = await request.json();
  if (!meetingId) return NextResponse.json({ error: 'meetingId 필요' }, { status: 400 });

  const meeting = await queryOne(
    'SELECT m.*, u.display_name as creator_name FROM moim_meetings m JOIN moim_users u ON m.created_by = u.id WHERE m.id = $1',
    [meetingId]
  );
  if (!meeting) return NextResponse.json({ error: '모임을 찾을 수 없습니다.' }, { status: 404 });

  const photos = await query<{ exif_taken_at: string; exif_lat: number; exif_lng: number }>(
    'SELECT exif_taken_at, exif_lat, exif_lng FROM moim_photos WHERE meeting_id = $1 ORDER BY exif_taken_at ASC',
    [meetingId]
  );
  const members = await query<{ display_name: string }>(
    'SELECT u.display_name FROM moim_meeting_members mm JOIN moim_users u ON mm.user_id = u.id WHERE mm.meeting_id = $1',
    [meetingId]
  );

  const topics: string[] = JSON.parse((meeting.topics as string) || '[]');
  const participantNames = members.map(m => m.display_name);
  if (participantNames.length === 0) participantNames.push(meeting.creator_name as string);

  try {
    const story = await generateMeetingStory({
      title: meeting.title as string,
      date: meeting.meeting_date as string,
      location: meeting.location as string | undefined,
      topics,
      participants: participantNames,
      photoCount: photos.length,
      exifTimeline: photos.map(p => ({ takenAt: p.exif_taken_at, lat: p.exif_lat, lng: p.exif_lng })),
      description: meeting.description as string | undefined,
    });
    await execute('UPDATE meetings SET ai_story = $1 WHERE id = $2', [story, meetingId]);
    return NextResponse.json({ data: { story } });
  } catch {
    return NextResponse.json({ error: 'AI 이야기 생성에 실패했습니다.' }, { status: 500 });
  }
}
