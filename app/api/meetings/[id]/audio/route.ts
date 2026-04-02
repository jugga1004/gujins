import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { saveAudio } from '@/lib/storage';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const { id } = await params;
  const meetingId = parseInt(id);
  const formData = await request.formData();
  const file = formData.get('audio') as File;
  if (!file) return NextResponse.json({ error: '음성 파일을 선택해주세요.' }, { status: 400 });

  const result = await saveAudio(file, meetingId);
  const rows = await query<{ id: number }>(
    'INSERT INTO moim_audio_files (meeting_id, filename, original_name, file_path, file_size, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [meetingId, result.filename, result.originalName, result.filePath, result.fileSize, session.userId]
  );
  return NextResponse.json({ data: { id: rows[0].id, ...result } }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const { id } = await params;
  const { audioId } = await request.json();
  await execute('DELETE FROM moim_audio_files WHERE id = $1 AND meeting_id = $2', [audioId, parseInt(id)]);
  return NextResponse.json({ data: { ok: true } });
}
