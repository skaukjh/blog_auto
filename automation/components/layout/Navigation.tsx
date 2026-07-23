'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';
import { RefreshCw, Power } from 'lucide-react';

const TABS = [
  { path: '/', emoji: '👍', label: '홈 일괄 좋아요' },
  { path: '/comment-and-like', emoji: '💬', label: '댓글+좋아요' },
  { path: '/add-buddy', emoji: '🤝', label: '서로이웃 추가' },
];

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [restarting, setRestarting] = useState(false);
  const [status, setStatus] = useState('');

  // 새로고침 - 화면만 다시 불러옵니다
  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  // 프로그램 재시작 - 서버 프로세스를 종료하면 감시 스크립트가 다시 띄웁니다
  const handleRestart = useCallback(async () => {
    if (restarting) return;
    if (!window.confirm('프로그램을 재시작할까요?\n진행 중인 작업이 있다면 중단됩니다.')) {
      return;
    }

    setRestarting(true);
    setStatus('재시작 요청 중...');

    try {
      await fetch('/api/system/restart', { method: 'POST' });
    } catch {
      // 서버가 즉시 종료되면 요청이 끊길 수 있습니다. 정상입니다.
    }

    setStatus('서버가 다시 켜지길 기다리는 중...');

    // 서버가 살아날 때까지 폴링 (최대 60초)
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch('/api/system/health', { cache: 'no-store' });
        if (res.ok) {
          setStatus('복구되었습니다. 새로고침합니다...');
          await new Promise((r) => setTimeout(r, 800));
          window.location.reload();
          return;
        }
      } catch {
        // 아직 안 켜짐 - 계속 대기
      }
    }

    setRestarting(false);
    setStatus('');
    alert(
      '자동 복구를 확인하지 못했습니다.\n\n' +
        'start-automation.bat 창이 열려 있는지 확인해주세요.\n' +
        '그 창으로 실행하지 않았다면 수동으로 다시 실행해야 합니다.'
    );
  }, [restarting]);

  return (
    <nav className="glass-effect border-b border-white/50 sticky top-0 z-50 shadow-md-soft">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤝</span>
              <h1 className="text-xl font-bold gradient-text">네이버 블로그 자동화</h1>
              <span className="ml-2 px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-800 font-medium">
                로컬 전용
              </span>
            </div>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.path}
                  onClick={() => router.push(tab.path)}
                  disabled={restarting}
                  className={`px-4 py-2 rounded-md font-medium smooth-transition flex items-center gap-2 disabled:opacity-50 ${
                    pathname === tab.path
                      ? 'bg-white shadow-md-soft text-primary'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 문제 해결 버튼 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={restarting}
              title="화면만 다시 불러옵니다"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 smooth-transition font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
            <button
              onClick={handleRestart}
              disabled={restarting}
              title="프로그램이 멈췄을 때 서버를 다시 시작합니다"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 smooth-transition font-medium"
            >
              <Power className={`w-4 h-4 ${restarting ? 'animate-pulse' : ''}`} />
              {restarting ? '재시작 중...' : '프로그램 재시작'}
            </button>
          </div>
        </div>

        {restarting && status && (
          <div className="mt-3 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
            ⏳ {status}
          </div>
        )}
      </div>
    </nav>
  );
}
