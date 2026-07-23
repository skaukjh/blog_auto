'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';
import { LogOut } from 'lucide-react';

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      document.cookie = 'blog_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const isGeneratePage = pathname === '/generate';
  const isFormatPage = pathname === '/format';

  return (
    <nav className="glass-effect border-b border-white/50 sticky top-0 z-50 shadow-md-soft">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* 로고 및 탭 */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <h1 className="text-xl font-bold gradient-text">AI Blog Generator</h1>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => router.push('/generate')}
                className={`px-4 py-2 rounded-md font-medium smooth-transition flex items-center gap-2 ${
                  isGeneratePage
                    ? 'bg-white shadow-md-soft text-primary'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>📝</span>
                글 생성
              </button>
              <button
                onClick={() => router.push('/format')}
                className={`px-4 py-2 rounded-md font-medium smooth-transition flex items-center gap-2 ${
                  isFormatPage
                    ? 'bg-white shadow-md-soft text-primary'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>⚙️</span>
                포맷 관리
              </button>
            </div>
          </div>

          {/* 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 smooth-transition font-medium"
          >
            <LogOut className="w-4 h-4" />
            {isLoading ? '로그아웃 중...' : '로그아웃'}
          </button>
        </div>
      </div>
    </nav>
  );
}
