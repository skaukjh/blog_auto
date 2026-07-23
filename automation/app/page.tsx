'use client';

import { useState } from 'react';
import Navigation from '@/components/layout/Navigation';
import { AlertCircle, X } from 'lucide-react';

interface HomePostLikeResult {
  success: boolean;
  totalPages: number;
  totalProcessed: number;
  totalLiked: number;
  totalFailed: number;
  startedAt: string;
  completedAt: string;
  details: Array<{
    page: number;
    title: string;
    liked: boolean;
    reason?: string;
  }>;
  error?: string;
}

export default function NeighborPage() {
  // 이웃새글 홈 탭
  const [homeBlogId, setHomeBlogId] = useState('');
  const [homeBlogPassword, setHomeBlogPassword] = useState('');
  const [homeResult, setHomeResult] = useState<HomePostLikeResult | null>(null);
  const [homeError, setHomeError] = useState('');
  const [isHomeProcessing, setIsHomeProcessing] = useState(false);

  const handleHomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHomeError('');
    setHomeResult(null);

    if (!homeBlogId.trim() || !homeBlogPassword.trim()) {
      setHomeError('블로그 ID와 비밀번호를 입력하세요.');
      return;
    }

    setIsHomeProcessing(true);

    try {
      const response = await fetch('/api/neighbor/like-home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId: homeBlogId.trim(),
          blogPassword: homeBlogPassword,
        }),
      });

      const data: HomePostLikeResult = await response.json();

      if (!response.ok) {
        setHomeError(data.error || '처리 중 오류가 발생했습니다.');
        setHomeResult(data);
        return;
      }

      setHomeResult(data);

      if (data.success) {
        // 성공 시 입력값 초기화
        setHomeBlogId('');
        setHomeBlogPassword('');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setHomeError(errorMsg);
    } finally {
      setIsHomeProcessing(false);
    }
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold gradient-text mb-2">📰 이웃새글 일괄 좋아요</h1>
            <p className="text-gray-600 text-lg">
              이웃새글 홈의 모든 글에서 페이지를 순회하며 일괄 좋아요를 누릅니다
            </p>
          </div>

          {/* 정보 배너 */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-300 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">ℹ️ 로컬 환경에서만 작동합니다</p>
              <p className="text-sm text-blue-700 mt-1">
                <code className="bg-blue-100 px-2 py-1 rounded text-xs">npm run dev</code>로 로컬 서버를 실행하세요.
              </p>
            </div>
          </div>

          {/* 이웃새글 홈 폼 */}
          <div className="glass-effect rounded-xl p-8 mb-8 shadow-md-soft">
              <form onSubmit={handleHomeSubmit} className="space-y-6">
                {/* 안내 메시지 */}
                <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
                  <p className="text-green-900 font-semibold">📌 사용 방법</p>
                  <p className="text-sm text-green-700 mt-2">
                    로그인된 계정의 이웃새글 홈 페이지에서 모든 이웃새글에 일괄 좋아요를 누립니다.
                    <br />
                    페이지가 여러 개인 경우 자동으로 페이지를 넘어가며 처리합니다.
                  </p>
                </div>

                {/* 블로그 ID */}
                <div>
                  <label className="block font-semibold text-gray-900 mb-2">네이버 블로그 ID</label>
                  <input
                    type="text"
                    value={homeBlogId}
                    onChange={(e) => setHomeBlogId(e.target.value)}
                    placeholder="예: my_blog_id"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                    disabled={isHomeProcessing}
                  />
                </div>

                {/* 비밀번호 */}
                <div>
                  <label className="block font-semibold text-gray-900 mb-2">네이버 계정 비밀번호</label>
                  <input
                    type="password"
                    value={homeBlogPassword}
                    onChange={(e) => setHomeBlogPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                    disabled={isHomeProcessing}
                  />
                  <p className="text-gray-500 text-sm mt-2">
                    ⚠️ 계정 정보는 메모리에만 임시 저장되며, 작업 완료 후 자동으로 삭제됩니다.
                  </p>
                </div>

                {/* 에러 메시지 */}
                {homeError && (
                  <div className="p-4 bg-red-50 border border-red-300 rounded-lg flex items-start gap-3">
                    <X className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900">오류</p>
                      <p className="text-sm text-red-700 mt-1">{homeError}</p>
                    </div>
                  </div>
                )}

                {/* 제출 버튼 */}
                <button
                  type="submit"
                  disabled={isHomeProcessing || !homeBlogId.trim() || !homeBlogPassword.trim()}
                  className={`w-full py-3 rounded-lg font-semibold transition-all smooth-transition ${
                    isHomeProcessing || !homeBlogId.trim() || !homeBlogPassword.trim()
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-primary text-white hover:shadow-md-soft active:scale-95'
                  }`}
                >
                  {isHomeProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span> 처리 중... (페이지 순회)
                    </span>
                  ) : (
                    '🚀 이웃새글 일괄 좋아요'
                  )}
                </button>
              </form>
          </div>

          {/* 이웃새글 홈 결과 표시 */}
          {homeResult && (
            <div className={`rounded-xl p-8 shadow-md-soft border-l-4 ${
              homeResult.success
                ? 'glass-effect border-l-green-500 bg-green-50'
                : 'glass-effect border-l-red-500 bg-red-50'
            }`}>
              <h2 className={`text-2xl font-bold mb-6 ${homeResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {homeResult.success ? '✅ 처리 완료' : '❌ 처리 실패'}
              </h2>

              {/* 통계 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">처리 페이지</p>
                  <p className="text-3xl font-bold text-primary">{homeResult.totalPages}</p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">처리된 글</p>
                  <p className="text-3xl font-bold text-primary">{homeResult.totalProcessed}</p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">좋아요 완료</p>
                  <p className="text-3xl font-bold text-accent">{homeResult.totalLiked}</p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">소요 시간</p>
                  <p className="text-3xl font-bold text-green-600">
                    {Math.round(
                      (new Date(homeResult.completedAt).getTime() -
                        new Date(homeResult.startedAt).getTime()) /
                        1000
                    )}
                    s
                  </p>
                </div>
              </div>

              {/* 좋아요 누른 글 목록 */}
              {homeResult.details.filter((d) => d.liked).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-green-900 mb-3">✅ 좋아요 누른 글 ({homeResult.totalLiked}개)</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {homeResult.details
                      .filter((d) => d.liked)
                      .map((detail, idx) => (
                        <div key={idx} className="glass-effect rounded p-3 bg-green-50 border-l-4 border-l-green-500 shadow-sm">
                          <p className="text-sm text-gray-900 font-medium">{detail.title}</p>
                          <p className="text-xs text-gray-600 mt-1">[페이지 {detail.page}]</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 좋아요 못 누른 글 목록 */}
              {homeResult.details.filter((d) => !d.liked).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">⚠️ 좋아요 못 누른 글 ({homeResult.totalFailed}개)</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {homeResult.details
                      .filter((d) => !d.liked)
                      .map((detail, idx) => (
                        <div key={idx} className="glass-effect rounded p-3 bg-yellow-50 border-l-4 border-l-yellow-500 shadow-sm">
                          <p className="text-sm text-gray-900 font-medium">{detail.title}</p>
                          {detail.reason && <p className="text-xs text-gray-700 mt-1">이유: {detail.reason}</p>}
                          <p className="text-xs text-gray-600 mt-1">[페이지 {detail.page}]</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 닫기 버튼 */}
              <button
                onClick={() => setHomeResult(null)}
                className="w-full py-2 glass-effect hover:shadow-md-soft text-gray-900 rounded-lg transition-all smooth-transition"
              >
                결과 닫기
              </button>
            </div>
          )}

          {/* 정보 섹션 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="glass-effect rounded-xl p-6 shadow-md-soft">
              <h3 className="font-bold text-lg gradient-text mb-4">🔍 작동 원리</h3>
              <ul className="text-gray-700 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>실제 크롬 브라우저를 띄워서 자동화</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>계정 정보는 메모리에만 임시 저장</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>이웃새글 홈의 모든 페이지 순회</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>currentPage 파라미터로 페이지 이동</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>각 글의 좋아요 상태 확인 후 누르기</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>작업 완료 후 모든 정보 삭제</span>
                </li>
              </ul>
            </div>

            <div className="glass-effect rounded-xl p-6 shadow-md-soft border-l-4 border-l-orange-400">
              <h3 className="font-bold text-lg text-gray-900 mb-4">⚠️ 주의사항</h3>
              <ul className="text-gray-700 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>로컬 환경에서만 작동</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>Vercel 배포 후에는 사용 불가</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>올바른 ID/PW 입력 필요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>처리 시간이 길 수 있음 (이웃이 많을 경우)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>브라우저를 닫지 말 것</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>과도한 빈도로 사용 금지 (네이버 차단)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
