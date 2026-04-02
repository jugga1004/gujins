import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { summarizeAudio } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { audioId } = await request.json();
  if (!audioId) return NextResponse.json({ error: 'audioId 필요' }, { status: 400 });

  const audio = await queryOne<{ id: number; meeting_id: number; file_path: string }>(
    'SELECT id, meeting_id, file_path FROM moim_audio_files WHERE id = $1',
    [audioId]
  );
  if (!audio) return NextResponse.json({ error: '음성 파일을 찾을 수 없습니다.' }, { status: 404 });

  try {
    const result = await summarizeAudio(audio.file_path);
    await execute(
      'UPDATE audio_files SET transcript=$1, summary=$2, topics_extracted=$3, processed=1 WHERE id=$4',
      [result.transcript, result.summary, JSON.stringify(result.topics), audioId]
    );
    if (result.summary) {
      await execute('UPDATE meetings SET ai_summary = $1 WHERE id = $2', [result.summary, audio.meeting_id]);
    }
    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ error: '음성 분석에 실패했습니다.' }, { status: 500 });
  }
}
