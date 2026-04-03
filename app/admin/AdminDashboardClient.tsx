'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Stats {
  user_count: number;
  group_count: number;
  meeting_count: number;
  comment_count: number;
  photo_count: number;
}

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
  is_active: number;
}

interface GroupRow {
  id: number;
  name: string;
  creator_name: string;
  created_at: string;
  member_count: number;
  meeting_count: number;
}

interface MeetingRow {
  id: number;
  title: string;
  meeting_date: string;
  location: string | null;
  group_name: string;
  creator_name: string;
  created_at: string;
  photo_count: number;
  comment_count: number;
}

interface Props {
  stats: Stats;
  initialUsers: Record<string, unknown>[];
  initialGroups: Record<string, unknown>[];
  initialMeetings: Record<string, unknown>[];
}

function fmt(dateStr: string) {
  try { return format(new Date(dateStr), 'yy.MM.dd', { locale: ko }); } catch { return dateStr; }
}

export default function AdminDashboardClient({ stats, initialUsers, initialGroups, initialMeetings }: Props) {
  const [tab, setTab] = useState<'overview' | 'users' | 'groups' | 'meetings'>('overview');
  const users = initialUsers as unknown as UserRow[];
  const groups = initialGroups as unknown as GroupRow[];
  const meetings = initialMeetings as unknown as MeetingRow[];

  async function toggleActive(user: UserRow) {
    await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: user.is_active === 0 }),
    });
    window.location.reload();
  }

  const tabs = [
    { key: 'overview', label: '개요' },
    { key: 'users', label: `회원 (${stats.user_count})` },
    { key: 'groups', label: `모임방 (${stats.group_count})` },
    { key: 'meetings', label: `기록 (${stats.meeting_count})` },
  ] as const;

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              tab === t.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 개요 */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: '전체 회원', value: stats.user_count, icon: '👤' },
              { label: '전체 모임방', value: stats.group_count, icon: '🏠' },
              { label: '전체 기록', value: stats.meeting_count, icon: '📝' },
              { label: '전체 댓글', value: stats.comment_count, icon: '💬' },
              { label: '전체 사진', value: stats.photo_count, icon: '📷' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="text-2xl font-bold text-gray-800">{item.value.toLocaleString()}</div>
                <div className="text-xs text-gray-400 mt-1">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">최근 가입 회원</h2>
            <div className="space-y-2">
              {users.slice(0, 5).map(u => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{u.display_name} <span className="text-gray-400">({u.username})</span></span>
                  <span className="text-gray-400 text-xs">{fmt(u.created_at)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">최근 생성된 모임방</h2>
            <div className="space-y-2">
              {groups.slice(0, 5).map(g => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{g.name} <span className="text-gray-400">by {g.creator_name}</span></span>
                  <div className="text-xs text-gray-400 flex gap-3">
                    <span>멤버 {g.member_count}</span>
                    <span>{fmt(g.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 회원 */}
      {tab === 'users' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500">이름</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">아이디</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">권한</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">가입일</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">상태</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{u.display_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.role === 'admin' ? '관리자' : '일반'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                        u.is_active ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'
                      }`}
                    >
                      {u.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 모임방 */}
      {tab === 'groups' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500">모임 이름</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">개설자</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">멤버</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">기록 수</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">생성일</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{g.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{g.creator_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.member_count}명</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.meeting_count}개</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmt(g.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 기록 */}
      {tab === 'meetings' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500">제목</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">모임방</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">작성자</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">사진</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">댓글</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">날짜</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map(m => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[180px] truncate">{m.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[120px] truncate">{m.group_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{m.creator_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{m.photo_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{m.comment_count}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmt(m.meeting_date || m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
