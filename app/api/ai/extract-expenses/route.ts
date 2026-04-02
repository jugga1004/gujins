import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { extractReceiptExpenses } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { receiptId } = await request.json();
  if (!receiptId) return NextResponse.json({ error: 'receiptId 필요' }, { status: 400 });

  const receipt = await queryOne<{ id: number; meeting_id: number; file_path: string }>(
    'SELECT id, meeting_id, file_path FROM moim_receipts WHERE id = $1',
    [receiptId]
  );
  if (!receipt) return NextResponse.json({ error: '영수증을 찾을 수 없습니다.' }, { status: 404 });

  try {
    const result = await extractReceiptExpenses(receipt.file_path);

    await execute('DELETE FROM moim_expense_items WHERE meeting_id = $1 AND source = $2', [receipt.meeting_id, 'ai_receipt']);

    for (const item of result.items) {
      await execute(
        `INSERT INTO moim_expense_items (meeting_id, item_name, quantity, unit_price, total_price, category, source)
         VALUES ($1,$2,$3,$4,$5,$6,'ai_receipt')`,
        [receipt.meeting_id, item.name, item.quantity, item.unitPrice, item.total, item.category || '기타']
      );
    }

    const totalRow = await queryOne<{ total: string }>(
      'SELECT COALESCE(SUM(total_price), 0) as total FROM moim_expense_items WHERE meeting_id = $1',
      [receipt.meeting_id]
    );
    await execute('UPDATE meetings SET total_cost = $1 WHERE id = $2', [parseInt(totalRow?.total || '0'), receipt.meeting_id]);
    await execute('UPDATE receipts SET ai_raw_text = $1, processed = 1 WHERE id = $2', [result.rawText, receiptId]);

    return NextResponse.json({ data: { items: result.items, grandTotal: result.grandTotal } });
  } catch {
    return NextResponse.json({ error: '영수증 분석에 실패했습니다.' }, { status: 500 });
  }
}
