'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { JWTPayload } from '@/lib/auth';

interface MeetingData {
  id: number;
  title: string;
  meeting_date: string;
  location?: string;
  total_cost: number;
  description?: string;
  ai_story?: string;
  ai_summary?: string;
  topics: string[];
  created_by: number;
  creator_name: string;
  photos: PhotoRow[];
  expenses: ExpenseRow[];
  receipts: ReceiptRow[];
  audioFiles: AudioRow[];
  comments: CommentRow[];
  members: MemberRow[];
}

interface PhotoRow { id: number; file_path: string; original_name: string; exif_taken_at?: string; sort_order: number; }
interface ExpenseRow { id: number; item_name: string; quantity: number; unit_price: number; total_price: number; category?: string; }
interface ReceiptRow { id: number; file_path: string; original_name: string; processed: number; }
interface AudioRow { id: number; original_name: string; file_path: string; file_size: number; transcript?: string; summary?: string; processed: number; }
interface CommentRow { id: number; author_id: number; author_name: string; content: string; created_at: string; }
interface MemberRow { id: number; display_name: string; }

interface MeetingDetailClientProps {
  initialData: Record<string, unknown>;
  session: JWTPayload;
}

export default function MeetingDetailClient({ initialData, session }: MeetingDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get('groupId');
  const [data, setData] = useState<MeetingData>(initialData as unknown as MeetingData);
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'story' | 'photos' | 'expenses' | 'audio'>('story');
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingMeeting, setEditingMeeting] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', meetingDate: '', location: '', description: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [groupMembers, setGroupMembers] = useState<{ id: number; display_name: string }[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const showToast = useCallback((msg: string) => {
    setUploadError(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setUploadError(''), 10000);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const meeting = data;
  const photos = data.photos || [];
  const expenses = data.expenses || [];
  const receipts = data.receipts || [];
  const audioFiles = data.audioFiles || [];
  const comments = data.comments || [];
  const members = data.members || [];
  const topics: string[] = data.topics || [];

  const formattedDate = (() => {
    try {
      return format(new Date(meeting.meeting_date as string), 'yyyy년 M월 d일 (E)', { locale: ko });
    } catch {
      return meeting.meeting_date as string;
    }
  })();

  async function refreshData() {
    const res = await fetch(`/api/meetings/${meeting.id}`);
    const d = await res.json();
    if (d.data) setData(d.data as unknown as MeetingData);
  }

  async function handlePhotoUpload(files: FileList) {
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('photos', f));

    try {
      const res = await fetch(`/api/meetings/${meeting.id}/photos`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '업로드 실패');
        return;
      }
      await refreshData();
    } finally {
      setUploading(false);
    }
  }

  async function handleReceiptUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const res = await fetch(`/api/meetings/${meeting.id}/receipts`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '업로드 실패');
        return;
      }
      await refreshData();
    } finally {
      setUploading(false);
    }
  }

  async function handleAudioUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append('audio', file);

    try {
      const res = await fetch(`/api/meetings/${meeting.id}/audio`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '업로드 실패');
        return;
      }
      await refreshData();
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerateStory() {
    setAiLoading('story');
    try {
      const res = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id }),
      });
      if (res.ok) {
        await refreshData();
      } else {
        let detail = `서버 오류 (${res.status})`;
        try {
          const d = await res.json();
          detail = d.detail || d.error || detail;
        } catch { /* HTML 응답 등 파싱 실패 시 무시 */ }
        showToast(`AI 오류: ${detail}`);
      }
    } catch (e) {
      showToast(`AI 오류: ${e instanceof Error ? e.message : '네트워크 오류'}`);
    } finally {
      setAiLoading('');
    }
  }

  async function handleExtractExpenses(receiptId: number) {
    setAiLoading(`receipt-${receiptId}`);
    try {
      const res = await fetch('/api/ai/extract-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId }),
      });
      if (res.ok) await refreshData();
    } finally {
      setAiLoading('');
    }
  }

  async function handleTranscribeAudio(audioId: number) {
    setAiLoading(`audio-${audioId}`);
    try {
      const res = await fetch('/api/ai/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioId }),
      });
      if (res.ok) await refreshData();
    } finally {
      setAiLoading('');
    }
  }

  async function openEditMeeting() {
    const dateStr = meeting.meeting_date
      ? new Date(meeting.meeting_date as string).toISOString().slice(0, 10)
      : '';
    setEditForm({
      title: (meeting.title as string) ?? '',
      meetingDate: dateStr,
      location: (meeting.location as string) ?? '',
      description: (meeting.description as string) ?? '',
    });
    setSelectedMembers(members.map(m => m.id));
    // 모임방 멤버 불러오기
    if (groupId) {
      const res = await fetch(`/api/groups/${groupId}`);
      const d = await res.json();
      if (d.data?.members) setGroupMembers(d.data.members);
    }
    setEditingMeeting(true);
  }

  async function handleSaveMeeting(e: React.FormEvent) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          meetingDate: editForm.meetingDate,
          location: editForm.location,
          description: editForm.description,
          topics: topics,
          members: selectedMembers,
        }),
      });
      if (res.ok) {
        setEditingMeeting(false);
        await refreshData();
      }
    } finally {
      setEditSaving(false);
    }
  }

  function toggleMember(userId: number) {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;

    const res = await fetch(`/api/meetings/${meeting.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: commentText }),
    });
    if (res.ok) {
      setCommentText('');
      await refreshData();
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    await fetch(`/api/meetings/${meeting.id}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId }),
    });
    await refreshData();
  }

  const totalCost = expenses.reduce((sum, item) => sum + (item.total_price as number), 0);

  return (
    <>
    <div className="max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => router.push(groupId ? `/groups/${groupId}` : '/groups')} className="text-gray-400 hover:text-gray-600 text-2xl mt-1">
          ←
        </button>
        <div className="flex-1">
          {editingMeeting ? (
            <form onSubmit={handleSaveMeeting} className="space-y-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">날짜</label>
                <input
                  type="date"
                  value={editForm.meetingDate}
                  onChange={e => setEditForm(f => ({ ...f, meetingDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">장소</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="선택사항"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">내용</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  rows={3}
                  placeholder="선택사항"
                />
              </div>
              {groupMembers.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">참석자</label>
                  <div className="flex flex-wrap gap-2">
                    {groupMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMember(m.id)}
                        className={`text-sm px-3 py-1.5 rounded-full border transition ${
                          selectedMembers.includes(m.id)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {m.display_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingMeeting(false)}
                  className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {editSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="text-sm text-indigo-500 font-medium">{formattedDate}</p>
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-2xl font-bold text-gray-800 mt-0.5 flex-1">{meeting.title as string}</h1>
                {(session.userId === (meeting.created_by as number) || session.role === 'admin') && (
                  <button
                    onClick={openEditMeeting}
                    className="text-gray-400 hover:text-indigo-600 transition mt-1 text-sm"
                    title="기록 수정"
                  >
                    ✏️
                  </button>
                )}
              </div>
              {meeting.location && (
                <p className="text-sm text-gray-400 mt-1">📍 {meeting.location as string}</p>
              )}
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {topics.map((t, i) => (
                    <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {members.length > 0 && (
                <p className="text-sm text-gray-400 mt-1.5">
                  👥 {members.map(m => m.display_name as string).join(', ')}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {(['story', 'photos', 'expenses', 'audio'] as const).map(tab => {
          const labels = { story: '이야기', photos: `사진 ${photos.length}`, expenses: '비용', audio: '음성' };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* 이야기 탭 */}
      {activeTab === 'story' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {meeting.description && (
            <div className="mb-4 text-gray-600 text-sm leading-relaxed">
              {meeting.description as string}
            </div>
          )}

          {meeting.ai_story ? (
            <div className="prose prose-sm max-w-none">
              <div className="bg-indigo-50 rounded-xl p-4 text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                {meeting.ai_story as string}
              </div>
              <button
                onClick={handleGenerateStory}
                disabled={aiLoading === 'story'}
                className="mt-3 text-xs text-indigo-500 hover:text-indigo-700 transition"
              >
                {aiLoading === 'story' ? '생성 중...' : '↻ 다시 생성'}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">
                사진과 모임 정보를 바탕으로 AI가 이야기를 만들어줘요
              </p>
              <button
                onClick={handleGenerateStory}
                disabled={aiLoading === 'story'}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
              >
                {aiLoading === 'story' ? '✨ 이야기 생성 중...' : '✨ AI 이야기 만들기'}
              </button>
            </div>
          )}

          {meeting.ai_summary && (
            <div className="mt-6 border-t pt-5">
              <h3 className="font-semibold text-gray-700 mb-2 text-sm">🎙️ 음성 요약</h3>
              <div className="bg-amber-50 rounded-xl p-4 text-gray-700 text-sm leading-relaxed">
                {meeting.ai_summary as string}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 사진 탭 */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">사진 <span className="text-sm font-normal text-gray-400">{photos.length}장</span></h2>
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
                className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {uploading ? '업로드 중...' : '+ 사진 추가'}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => e.target.files && handlePhotoUpload(e.target.files)}
              />
            </div>

            {photos.length === 0 ? (
              <div
                onClick={() => photoInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl h-40 flex items-center justify-center cursor-pointer hover:border-indigo-300 transition"
              >
                <div className="text-center text-gray-400">
                  <div className="text-3xl mb-2">📷</div>
                  <p className="text-sm">클릭하여 사진을 추가하세요</p>
                </div>
              </div>
            ) : (() => {
              // 날짜별 그룹핑
              type PhotoGroup = { dateLabel: string; photos: typeof photos };
              const groups: PhotoGroup[] = [];
              const dateMap = new Map<string, typeof photos>();

              for (const photo of photos) {
                let dateKey = 'no-exif';
                let dateLabel = '촬영일 미상';
                if (photo.exif_taken_at) {
                  try {
                    const d = new Date(photo.exif_taken_at as string);
                    dateKey = format(d, 'yyyy-MM-dd');
                    dateLabel = format(d, 'yyyy년 M월 d일 (E)', { locale: ko });
                  } catch { /* ignore */ }
                }
                if (!dateMap.has(dateKey)) {
                  dateMap.set(dateKey, []);
                  groups.push({ dateLabel, photos: dateMap.get(dateKey)! });
                }
                dateMap.get(dateKey)!.push(photo);
              }

              const multipledays = groups.length > 1;

              return (
                <div className="space-y-5">
                  {groups.map((group, gi) => (
                    <div key={gi}>
                      {multipledays && (
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-px flex-1 bg-gray-100" />
                          <span className="text-xs font-medium text-gray-400 whitespace-nowrap">📅 {group.dateLabel}</span>
                          <div className="h-px flex-1 bg-gray-100" />
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        {group.photos.map(photo => (
                          <div key={photo.id as number} className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group">
                            <img
                              src={photo.file_path as string}
                              alt={photo.original_name as string}
                              className="w-full h-full object-cover hover:scale-105 transition"
                              onClick={() => setLightboxPhoto(photo.file_path as string)}
                            />
                            {/* 삭제 버튼 */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('사진을 삭제하시겠습니까?')) return;
                                await fetch(`/api/meetings/${meeting.id}/photos`, {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ photoId: photo.id }),
                                });
                                await refreshData();
                              }}
                              className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center hover:bg-red-500"
                            >
                              ✕
                            </button>
                            {photo.exif_taken_at && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition text-center">
                                {(() => {
                                  try {
                                    return format(new Date(photo.exif_taken_at as string), multipledays ? 'M/d HH:mm' : 'HH:mm');
                                  } catch { return ''; }
                                })()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 비용 탭 */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">영수증 업로드</h2>
              <button
                onClick={() => receiptInputRef.current?.click()}
                disabled={uploading}
                className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {uploading ? '업로드 중...' : '+ 영수증 추가'}
              </button>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])}
              />
            </div>

            {receipts.map(receipt => (
              <div key={receipt.id as number} className="border border-gray-100 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={receipt.file_path as string}
                      alt="영수증"
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                    <span className="text-sm text-gray-600">{receipt.original_name as string}</span>
                  </div>
                  <button
                    onClick={() => handleExtractExpenses(receipt.id as number)}
                    disabled={aiLoading === `receipt-${receipt.id}`}
                    className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
                  >
                    {aiLoading === `receipt-${receipt.id}` ? '분석 중...' : '🤖 AI 분석'}
                  </button>
                </div>
              </div>
            ))}

            {receipts.length === 0 && (
              <div
                onClick={() => receiptInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl h-28 flex items-center justify-center cursor-pointer hover:border-amber-300 transition text-gray-400 text-sm"
              >
                영수증 이미지를 업로드하면 AI가 자동으로 분석해줘요
              </div>
            )}
          </div>

          {expenses.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">비용 내역</h2>
              <div className="space-y-2">
                {expenses.map(item => (
                  <div key={item.id as number} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="text-sm text-gray-700">{item.item_name as string}</span>
                      {(item.quantity as number) > 1 && (
                        <span className="text-xs text-gray-400 ml-2">× {item.quantity as number}</span>
                      )}
                      {item.category && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-2">{item.category as string}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-800">
                      {(item.total_price as number).toLocaleString('ko-KR')}원
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-3 mt-2 border-t-2 border-gray-200">
                <span className="font-bold text-gray-800">합계</span>
                <span className="font-bold text-indigo-600 text-lg">
                  {totalCost.toLocaleString('ko-KR')}원
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 음성 탭 */}
      {activeTab === 'audio' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">음성 파일</h2>
              <button
                onClick={() => audioInputRef.current?.click()}
                disabled={uploading}
                className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {uploading ? '업로드 중...' : '+ 음성 추가'}
              </button>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleAudioUpload(e.target.files[0])}
              />
            </div>

            {audioFiles.length === 0 ? (
              <div
                onClick={() => audioInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl h-28 flex items-center justify-center cursor-pointer hover:border-purple-300 transition text-gray-400 text-sm"
              >
                음성 파일을 업로드하면 AI가 내용을 요약해줘요
              </div>
            ) : (
              audioFiles.map(audio => (
                <div key={audio.id as number} className="border border-gray-100 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎙️</span>
                      <div>
                        <p className="text-sm font-medium text-gray-700">{audio.original_name as string}</p>
                        <p className="text-xs text-gray-400">
                          {((audio.file_size as number) / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    {!(audio.processed as number) && (
                      <button
                        onClick={() => handleTranscribeAudio(audio.id as number)}
                        disabled={aiLoading === `audio-${audio.id}`}
                        className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                      >
                        {aiLoading === `audio-${audio.id}` ? '분석 중...' : '🤖 AI 요약'}
                      </button>
                    )}
                  </div>

                  {audio.summary && (
                    <div className="bg-purple-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
                      <p className="font-medium text-purple-700 mb-1">요약</p>
                      {audio.summary as string}
                    </div>
                  )}

                  {audio.transcript && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">전체 내용 보기</summary>
                      <div className="mt-2 bg-gray-50 rounded-xl p-3 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {audio.transcript as string}
                      </div>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 댓글 */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">💬 댓글 {comments.length > 0 && `(${comments.length})`}</h2>

        <div className="space-y-3 mb-4">
          {comments.map(comment => (
            <div key={comment.id as number} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                {(comment.author_name as string).charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm text-gray-800">{comment.author_name as string}</span>
                  <span className="text-xs text-gray-400">
                    {(() => {
                      try {
                        return format(new Date(comment.created_at as string), 'M/d HH:mm');
                      } catch {
                        return '';
                      }
                    })()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{comment.content as string}</p>
              </div>
              {(session.userId === (comment.author_id as number) || session.role === 'admin') && (
                <button
                  onClick={() => handleDeleteComment(comment.id as number)}
                  className="text-xs text-gray-300 hover:text-red-400 transition self-start"
                >
                  삭제
                </button>
              )}
            </div>
          ))}

          {comments.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">첫 번째 댓글을 남겨보세요!</p>
          )}
        </div>

        <form onSubmit={handleComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            placeholder="댓글을 입력하세요..."
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
          >
            등록
          </button>
        </form>
      </div>

      {/* 라이트박스 */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300">×</button>
          <img
            src={lightboxPhoto}
            alt="사진 크게 보기"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>

    {/* Toast 에러 알림 */}
    {uploadError && (
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-[9999] px-4 pointer-events-none">
        <div className="bg-red-600 text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-start gap-3 max-w-sm w-full pointer-events-auto">
          <span className="flex-1 leading-relaxed">{uploadError}</span>
          <button
            onClick={() => { setUploadError(''); if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }}
            className="text-white/80 hover:text-white text-xl leading-none flex-shrink-0 -mt-0.5"
          >×</button>
        </div>
      </div>
    )}
    </>
  );
}
