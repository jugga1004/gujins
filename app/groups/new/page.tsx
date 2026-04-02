'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '모임 생성에 실패했습니다.');
        return;
      }
      router.push(`/groups/${data.data.id}`);
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-md">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1">
          ← 뒤로
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">모임 만들기</h1>
          <p className="text-sm text-gray-500 mb-6">
            모임 이름이 곧 참여 코드입니다.<br />
            멤버들에게 모임 이름을 알려주면 참여할 수 있어요.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">모임 이름</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                placeholder="예: 화요독서모임, 동창회2024"
                required
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">다른 모임과 겹치지 않는 고유한 이름을 사용하세요</p>
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? '생성 중...' : '모임 만들기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
