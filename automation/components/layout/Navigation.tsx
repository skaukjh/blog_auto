'use client';

import { useRouter, usePathname } from 'next/navigation';

const TABS = [
  { path: '/', emoji: '👍', label: '홈 일괄 좋아요' },
  { path: '/comment-and-like', emoji: '💬', label: '댓글+좋아요' },
  { path: '/add-buddy', emoji: '🤝', label: '서로이웃 추가' },
];

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="glass-effect border-b border-white/50 sticky top-0 z-50 shadow-md-soft">
      <div className="max-w-7xl mx-auto px-6 py-4">
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
                className={`px-4 py-2 rounded-md font-medium smooth-transition flex items-center gap-2 ${
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
      </div>
    </nav>
  );
}
