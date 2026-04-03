'use client';

import { useState } from 'react';

interface GroupDetailClientProps {
  groupId: number;
  groupName: string;
  myDisplayName: string;
  members: { id: number; display_name: string }[];
  isOwner: boolean;
}

export default function GroupDetailClient({ groupId, groupName, myDisplayName, members, isOwner }: GroupDetailClientProps) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(myDisplayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  async function handleSaveNickname(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: nickname }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 space-y-3">
      {/* 내 닉네임 */}
      <div className="bg-indigo-50 rounded-2xl px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-indigo-400 font-medium">이 모임에서 내 이름</p>
          {editing ? (
            <form onSubmit={handleSaveNickname} className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="px-3 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                placeholder="이 모임에서 사용할 이름"
                autoFocus
                maxLength={20}
              />
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? '저장 중' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setNickname(myDisplayName); setError(''); }}
                className="text-sm text-gray-400 hover:text-gray-600 px-2 py-1.5"
              >
                취소
              </button>
            </form>
          ) : (
            <p className="font-semibold text-indigo-700 text-base mt-0.5">{myDisplayName || '(이름 없음)'}</p>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg transition"
          >
            이름 변경
          </button>
        )}
      </div>

      {/* 멤버 + 참여코드 */}
      <button
        onClick={() => setShowInfo(v => !v)}
        className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
      >
        <span className="text-sm text-gray-600">
          👥 멤버 {members.length}명 {isOwner && <span className="text-xs text-indigo-400 ml-1">· 방장</span>}
        </span>
        <span className="text-gray-300">{showInfo ? '∧' : '∨'}</span>
      </button>

      {showInfo && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">참여 코드 (모임 이름)</p>
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 font-mono text-gray-800 font-semibold text-sm select-all">
              {groupName}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">이 이름을 알려주면 누구든 참여할 수 있어요</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">멤버</p>
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <span key={m.id} className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1 rounded-full">
                  {m.display_name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
