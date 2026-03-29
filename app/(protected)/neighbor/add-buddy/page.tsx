'use client';

import { useState } from 'react';
import Navigation from '@/components/layout/Navigation';
import { AlertCircle, X, UserPlus } from 'lucide-react';

interface BuddyAddDetail {
  index: number;
  blogId?: string;
  added: boolean;
  reason?: string;
}

interface BuddyAddResult {
  success: boolean;
  totalProcessed: number;
  totalAdded: number;
  totalFailed: number;
  totalSkipped: number;
  startedAt: string;
  completedAt: string;
  details: BuddyAddDetail[];
  error?: string;
}

export default function AddBuddyPage() {
  const [blogId, setBlogId] = useState('');
  const [blogPassword, setBlogPassword] = useState('');
  const [maxCount, setMaxCount] = useState(10);
  const [groupName, setGroupName] = useState('보안과 해킹');
  const [greetingMessage, setGreetingMessage] = useState(
    '안녕하세요! 좋은 글 잘 보고 있어요. 서로이웃 신청합니다 :)'
  );
  const [result, setResult] = useState<BuddyAddResult | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!blogId.trim() || !blogPassword.trim()) {
      setError('블로그 ID와 비밀번호를 입력하세요.');
      return;
    }

    if (maxCount < 1 || maxCount > 100) {
      setError('추가 수는 1~100 사이로 입력하세요.');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/neighbor/add-buddy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId: blogId.trim(),
          blogPassword,
          maxCount,
          groupName: groupName.trim(),
          greetingMessage: greetingMessage.trim(),
        }),
      });

      const data: BuddyAddResult = await response.json();

      if (!response.ok) {
        setError(data.error || '처리 중 오류가 발생했습니다.');
        setResult(data);
        return;
      }

      setResult(data);

      if (data.success) {
        setBlogId('');
        setBlogPassword('');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const elapsedSeconds = result
    ? Math.round(
        (new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000
      )
    : 0;

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold gradient-text mb-2">
              <UserPlus className="inline w-9 h-9 mr-2" />
              서로이웃 자동 추가
            </h1>
            <p className="text-gray-600 text-lg">
              지정한 그룹의 블로그에 서로이웃을 자동으로 신청합니다
            </p>
          </div>

          {/* 정보 배너 */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-300 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">ℹ️ 로컬 환경에서만 작동합니다</p>
              <p className="text-sm text-blue-700 mt-1">
                <code className="bg-blue-100 px-2 py-1 rounded text-xs">npm run dev</code>로
                로컬 서버를 실행하세요. 실행 중 브라우저를 닫지 마세요.
              </p>
            </div>
          </div>

          {/* 입력 폼 */}
          <div className="glass-effect rounded-xl p-8 mb-8 shadow-md-soft">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 사용 방법 안내 */}
              <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
                <p className="text-green-900 font-semibold">📌 사용 방법</p>
                <ol className="text-sm text-green-700 mt-2 space-y-1 list-decimal list-inside">
                  <li>네이버 계정 정보와 추가할 이웃 수를 입력합니다</li>
                  <li>그룹명을 입력하면 해당 그룹의 블로그 목록에서 이웃을 추가합니다</li>
                  <li>인사말을 입력하면 서로이웃 신청 시 해당 메시지가 전송됩니다</li>
                  <li>실행 후 브라우저 창이 자동으로 열리며 작업이 진행됩니다</li>
                </ol>
              </div>

              {/* 블로그 ID */}
              <div>
                <label className="block font-semibold text-gray-900 mb-2">
                  네이버 블로그 ID
                </label>
                <input
                  type="text"
                  value={blogId}
                  onChange={(e) => setBlogId(e.target.value)}
                  placeholder="예: my_blog_id"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                  disabled={isProcessing}
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block font-semibold text-gray-900 mb-2">
                  네이버 계정 비밀번호
                </label>
                <input
                  type="password"
                  value={blogPassword}
                  onChange={(e) => setBlogPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                  disabled={isProcessing}
                />
                <p className="text-gray-500 text-sm mt-2">
                  ⚠️ 계정 정보는 메모리에만 임시 저장되며, 작업 완료 후 자동으로 삭제됩니다.
                </p>
              </div>

              {/* 추가할 이웃 수 */}
              <div>
                <label className="block font-semibold text-gray-900 mb-2">
                  추가할 이웃 수 <span className="text-gray-500 font-normal">(1~100명)</span>
                </label>
                <input
                  type="number"
                  value={maxCount}
                  onChange={(e) => setMaxCount(parseInt(e.target.value) || 10)}
                  min={1}
                  max={100}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                  disabled={isProcessing}
                />
              </div>

              {/* 그룹명 */}
              <div>
                <label className="block font-semibold text-gray-900 mb-2">
                  그룹명{' '}
                  <span className="text-gray-500 font-normal">
                    (이웃새글 홈의 그룹 이름, 비워두면 전체 목록 사용)
                  </span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="예: 보안과 해킹"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                  disabled={isProcessing}
                />
              </div>

              {/* 인사말 */}
              <div>
                <label className="block font-semibold text-gray-900 mb-2">인사말</label>
                <textarea
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  rows={3}
                  maxLength={200}
                  placeholder="서로이웃 신청 시 보낼 인사말을 입력하세요"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition resize-none"
                  disabled={isProcessing}
                />
                <p className="text-gray-400 text-xs mt-1 text-right">
                  {greetingMessage.length}/200
                </p>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-lg flex items-start gap-3">
                  <X className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">오류</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={isProcessing || !blogId.trim() || !blogPassword.trim()}
                className={`w-full py-3 rounded-lg font-semibold transition-all smooth-transition ${
                  isProcessing || !blogId.trim() || !blogPassword.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-primary text-white hover:shadow-md-soft active:scale-95'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    서로이웃 추가 중... ({maxCount}명 목표)
                  </span>
                ) : (
                  `🤝 서로이웃 ${maxCount}명 자동 추가`
                )}
              </button>
            </form>
          </div>

          {/* 결과 */}
          {result && (
            <div
              className={`rounded-xl p-8 shadow-md-soft border-l-4 mb-8 ${
                result.success
                  ? 'glass-effect border-l-green-500 bg-green-50'
                  : 'glass-effect border-l-red-500 bg-red-50'
              }`}
            >
              <h2
                className={`text-2xl font-bold mb-6 ${
                  result.success ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {result.success ? '✅ 처리 완료' : '❌ 처리 실패'}
              </h2>

              {/* 통계 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">총 처리</p>
                  <p className="text-3xl font-bold text-primary">{result.totalProcessed}</p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">추가 완료</p>
                  <p className="text-3xl font-bold text-accent">{result.totalAdded}</p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">실패 / 건너뜀</p>
                  <p className="text-3xl font-bold text-orange-500">
                    {result.totalFailed} / {result.totalSkipped}
                  </p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">소요 시간</p>
                  <p className="text-3xl font-bold text-green-600">{elapsedSeconds}s</p>
                </div>
              </div>

              {/* 추가 완료 목록 */}
              {result.details.filter((d) => d.added).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-green-900 mb-3">
                    ✅ 추가 완료 ({result.totalAdded}명)
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.details
                      .filter((d) => d.added)
                      .map((detail, idx) => (
                        <div
                          key={idx}
                          className="glass-effect rounded p-3 bg-green-50 border-l-4 border-l-green-500 shadow-sm"
                        >
                          <p className="text-sm text-gray-900 font-medium">
                            #{detail.index} {detail.blogId ? `(${detail.blogId})` : ''}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 실패/건너뜀 목록 */}
              {result.details.filter((d) => !d.added).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    ⚠️ 실패 / 건너뜀 ({result.totalFailed + result.totalSkipped}건)
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.details
                      .filter((d) => !d.added)
                      .map((detail, idx) => (
                        <div
                          key={idx}
                          className="glass-effect rounded p-3 bg-yellow-50 border-l-4 border-l-yellow-500 shadow-sm"
                        >
                          <p className="text-sm text-gray-900 font-medium">
                            #{detail.index} {detail.blogId ? `(${detail.blogId})` : ''}
                          </p>
                          {detail.reason && (
                            <p className="text-xs text-gray-700 mt-1">이유: {detail.reason}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 에러 메시지 */}
              {result.error && (
                <div className="mb-6 p-4 bg-red-100 rounded-lg">
                  <p className="text-sm text-red-800">{result.error}</p>
                </div>
              )}

              {/* 결과 닫기 */}
              <button
                onClick={() => setResult(null)}
                className="w-full py-2 glass-effect hover:shadow-md-soft text-gray-900 rounded-lg transition-all smooth-transition"
              >
                결과 닫기
              </button>
            </div>
          )}

          {/* 안내 섹션 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-effect rounded-xl p-6 shadow-md-soft">
              <h3 className="font-bold text-lg gradient-text mb-4">🔍 작동 원리</h3>
              <ul className="text-gray-700 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">1.</span>
                  <span>네이버 로그인 후 이웃새글 홈 접속</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">2.</span>
                  <span>그룹 드롭다운에서 지정한 그룹 선택</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">3.</span>
                  <span>각 블로그의 이웃추가 버튼 클릭</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">4.</span>
                  <span>팝업에서 "서로이웃" 라디오 선택</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">5.</span>
                  <span>인사말 입력 후 신청 완료</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">6.</span>
                  <span>페이지 순회하며 목표 수만큼 반복</span>
                </li>
              </ul>
            </div>

            <div className="glass-effect rounded-xl p-6 shadow-md-soft border-l-4 border-l-orange-400">
              <h3 className="font-bold text-lg text-gray-900 mb-4">⚠️ 주의사항</h3>
              <ul className="text-gray-700 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>로컬 환경(npm run dev)에서만 작동</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>실행 중 브라우저 창을 닫지 마세요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>2차 인증이 있으면 직접 완료해야 합니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>한 번에 너무 많이 신청하면 네이버 차단 가능</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>이미 이웃인 블로그는 자동으로 건너뜁니다</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
