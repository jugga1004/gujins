'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface User {
  id: number;
  username: string;
  display_name: string;
}

export default function NewMeetingPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    title: '',
    meetingDate: new Date().toISOString().split('T')[0],
    location: '',
    description: '',
    topics: '',
    members: [] as number[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/groups/${groupId}`)
      .then(r => r.json())
      .then(d => setUsers(d.data?.members || []));
  }, [groupId]);

  function toggleMember(userId: number) {
    setForm(f => ({
      ...f,
      members: f.members.includes(userId)
        ? f.members.filter(id => id !== userId)
        : [...f.members, userId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const topics = form.topics.split(',').map(t => t.trim()).filter(Boolean);
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, topics, groupId: parseInt(groupId) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '모임 기록 생성에 실패했습니다.');
        return;
      }
      router.push(`/meetings/${data.data.id}?groupId=${groupId}`);
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-2xl">←</button>
          <h1 className="text-2xl font-bold text-gray-800">새 모임 기록</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">모임 제목 *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                placeholder="예: 3월 정기 모임"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">모임 날짜 *</label>
                <input
                  type="date"
                  value={form.meetingDate}
                  onChange={e => setForm(f => ({ ...f, meetingDate: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">장소</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  placeholder="예: 강남 OO식당"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">주제 (쉼표로 구분)</label>
              <input
                type="text"
                value={form.topics}
                onChange={e => setForm(f => ({ ...f, topics: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                placeholder="예: 독서, 토론, 식사"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">메모</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition resize-none"
                rows={3}
                placeholder="간단한 메모를 남겨주세요"
              />
            </div>
            {users.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">참석자</label>
                <div className="flex flex-wrap gap-2">
                  {users.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleMember(user.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                        form.members.includes(user.id)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {user.display_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loading ? '생성 중...' : '기록 만들기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
