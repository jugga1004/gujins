import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { savePhoto } from '@/lib/storage';
import { extractExif } from '@/lib/exif';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  const meetingId = parseInt(id);

  const meeting = await queryOne('SELECT id FROM moim_meetings WHERE id = $1', [meetingId]);
  if (!meeting) return NextResponse.json({ error: '모임을 찾을 수 없습니다.' }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll('photos') as File[];
  if (files.length === 0) return NextResponse.json({ error: '업로드할 사진을 선택해주세요.' }, { status: 400 });

  const maxRow = await queryOne<{ m: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM moim_photos WHERE meeting_id = $1',
    [meetingId]
  );
  const currentMax = maxRow?.m ?? -1;

  const saved = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await savePhoto(file, meetingId);
    const buffer = Buffer.from(await file.arrayBuffer());
    const exif = await extractExif(buffer);

    const rows = await query<{ id: number }>(
      `INSERT INTO moim_photos (meeting_id, filename, original_name, file_path, file_size, mime_type,
        exif_taken_at, exif_lat, exif_lng, exif_make, exif_model, uploaded_by, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [meetingId, result.filename, result.originalName, result.filePath,
       result.fileSize, result.mimeType,
       exif.takenAt, exif.lat, exif.lng, exif.make, exif.model,
       session.userId, currentMax + 1 + i]
    );
    saved.push({ id: rows[0].id, ...result, exif });
  }

  return NextResponse.json({ data: saved }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const { id } = await params;
  const { photoId } = await request.json();
  await execute('DELETE FROM moim_photos WHERE id = $1 AND meeting_id = $2', [photoId, parseInt(id)]);
  return NextResponse.json({ data: { ok: true } });
}
