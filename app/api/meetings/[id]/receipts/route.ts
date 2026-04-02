import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { saveReceipt } from '@/lib/storage';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const { id } = await params;
  const meetingId = parseInt(id);
  const formData = await request.formData();
  const file = formData.get('receipt') as File;
  if (!file) return NextResponse.json({ error: '영수증 파일을 선택해주세요.' }, { status: 400 });

  const result = await saveReceipt(file, meetingId);
  const rows = await query<{ id: number }>(
    'INSERT INTO moim_receipts (meeting_id, filename, original_name, file_path, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [meetingId, result.filename, result.originalName, result.filePath, session.userId]
  );
  return NextResponse.json({ data: { id: rows[0].id, ...result } }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const { id } = await params;
  const { receiptId } = await request.json();
  await execute('DELETE FROM moim_receipts WHERE id = $1 AND meeting_id = $2', [receiptId, parseInt(id)]);
  return NextResponse.json({ data: { ok: true } });
}
