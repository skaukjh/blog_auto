'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Navigation from '@/components/layout/Navigation';
import { RotateCw } from 'lucide-react';

export default function FormatPage() {
  const [post1, setPost1] = useState('');
  const [post2, setPost2] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [compactStyle, setCompactStyle] = useState<string | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [cost, setCost] = useState<{ usd: number; krw: number } | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedStyle, setSavedStyle] = useState<string | null>(null);
  const [savedDate, setSavedDate] = useState<string | null>(null);

  // 초기 로드 시 저장된 스타일 조회 (sessionStorage 우선)
  useEffect(() => {
    const loadSavedStyle = async () => {
      try {
        // 1. sessionStorage에서 먼저 확인 (클라이언트 측)
        const sessionStyle = sessionStorage.getItem('blog_style');
        const sessionDate = sessionStorage.getItem('blog_style_date');

        if (sessionStyle) {
          setSavedStyle(sessionStyle);
          setSavedDate(sessionDate || new Date().toLocaleString('ko-KR'));
          return;
        }

        // 2. 서버에서 조회 시도 (Vercel에서는 실패할 수 있음)
        try {
          const response = await fetch('/api/blog/get-current-style');
          if (response.ok) {
            const data = await response.json();
            if (data.exists) {
              setSavedStyle(data.style);
              setSavedDate(new Date().toLocaleString('ko-KR'));
              // 서버에서 받은 스타일을 sessionStorage에 저장
              sessionStorage.setItem('blog_style', data.style);
              sessionStorage.setItem('blog_style_date', new Date().toLocaleString('ko-KR'));
            }
          }
        } catch (serverErr) {
          console.warn('서버 스타일 조회 실패 (Vercel 환경일 수 있음):', serverErr);
        }
      } catch (err) {
        console.error('저장된 스타일 조회 실패:', err);
      }
    };

    loadSavedStyle();
  }, []);

  // 토큰 사용량 계산 (대략적)
  const estimateTokens = useMemo(() => {
    const totalLength = post1.length + post2.length;
    return Math.ceil(totalLength / 4) + 200; // 입력 + 출력 예상
  }, [post1.length, post2.length]);

  const handleAnalyze = useCallback(async () => {
    // 입력 검증
    if (!post1.trim() || !post2.trim()) {
      setError('두 개의 글이 모두 필요합니다');
      return;
    }

    if (post1.trim().length < 300 || post2.trim().length < 300) {
      setError('각 글은 최소 300자 이상이어야 합니다');
      return;
    }

    setAnalyzing(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/blog/analyze-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: [
            { title: '분석 글 1', excerpt: post1.trim() },
            { title: '분석 글 2', excerpt: post2.trim() },
          ],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '스타일 분석에 실패했습니다');
      }

      const data = await response.json();
      setCompactStyle(data.compactStyle);
      setAnalyzedAt(data.analyzedAt);
      setCost(data.cost || null);
      setSavedStyle(data.compactStyle);
      const nowDate = new Date().toLocaleString('ko-KR');
      setSavedDate(nowDate);
      setSuccess(true);

      // sessionStorage에 스타일 저장 (클라이언트 측)
      sessionStorage.setItem('blog_style', data.compactStyle);
      sessionStorage.setItem('blog_style_date', nowDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setAnalyzing(false);
    }
  }, [post1, post2]);

  const handleClearAll = useCallback(() => {
    setPost1('');
    setPost2('');
    setCompactStyle(null);
    setAnalyzedAt(null);
    setError('');
    setSuccess(false);
  }, []);

  return (
    <div className="min-h-screen">
      <Navigation />

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* 헤더 */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-5xl">🎨</span>
            <h1 className="text-5xl font-bold gradient-text">블로그 스타일 분석</h1>
          </div>
          <p className="text-lg text-gray-600 font-light">
            당신의 블로그 글 2개를 입력하면 AI가 스타일을 분석하여 글 생성에 적용합니다
          </p>
        </div>

        {/* 입력 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 글 1 */}
          <div className="glass-effect rounded-xl p-8 shadow-soft">
            <h3 className="text-xl font-bold gradient-text mb-4">📝 블로그 글 1</h3>
            <p className="text-sm text-gray-600 mb-3">
              첫 번째 블로그 글을 입력하세요 (최소 300자)
            </p>
            <textarea
              value={post1}
              onChange={(e) => setPost1(e.target.value)}
              placeholder="당신의 블로그 글 1을 여기에 붙여넣으세요..."
              rows={12}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white text-gray-800 placeholder-gray-400 font-mono text-sm resize-vertical"
            />
            <div className="mt-3 text-xs text-gray-500">
              {post1.length} / 300 문자
            </div>
          </div>

          {/* 글 2 */}
          <div className="glass-effect rounded-xl p-8 shadow-soft">
            <h3 className="text-xl font-bold gradient-text mb-4">📝 블로그 글 2</h3>
            <p className="text-sm text-gray-600 mb-3">
              두 번째 블로그 글을 입력하세요 (최소 300자)
            </p>
            <textarea
              value={post2}
              onChange={(e) => setPost2(e.target.value)}
              placeholder="당신의 블로그 글 2를 여기에 붙여넣으세요..."
              rows={12}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white text-gray-800 placeholder-gray-400 font-mono text-sm resize-vertical"
            />
            <div className="mt-3 text-xs text-gray-500">
              {post2.length} / 300 문자
            </div>
          </div>
        </div>

        {/* 오류 메시지 */}
        {error && (
          <div className="glass-effect rounded-xl p-6 shadow-soft mb-8 bg-red-50 border border-red-200">
            <p className="text-red-700 font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* 성공 메시지 & 비용 정보 */}
        {success && compactStyle && (
          <div className="space-y-4 mb-8">
            <div className="glass-effect rounded-xl p-6 shadow-soft bg-green-50 border border-green-200">
              <p className="text-green-700 font-medium">✅ 스타일 분석이 완료되었습니다!</p>
            </div>
            {cost && (
              <div className="glass-effect rounded-xl p-6 shadow-soft bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700 font-light">💸 스타일 분석 비용</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">{cost.krw.toLocaleString()}₩</p>
                    <p className="text-xs text-orange-600 mt-1">${cost.usd.toFixed(4)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-orange-700 mb-1">분석 완료 시간</p>
                    <p className="text-sm font-mono text-orange-800">{savedDate}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 버튼 영역 */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !post1.trim() || !post2.trim()}
            className="flex-1 px-6 py-4 gradient-primary text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold smooth-transition flex items-center justify-center gap-2"
          >
            <RotateCw className={`w-5 h-5 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? '분석 중...' : savedStyle ? '새로운 글 작성 스타일 분석' : '스타일 분석 시작'}
          </button>

          {(compactStyle || post1 || post2) && (
            <button
              onClick={handleClearAll}
              disabled={analyzing}
              className="px-6 py-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold smooth-transition"
            >
              입력창 초기화
            </button>
          )}
        </div>

        {/* 분석 결과 */}
        {compactStyle && (
          <div className="space-y-6">
            {/* 분석 정보 */}
            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <h2 className="text-2xl font-bold gradient-text mb-6">📊 분석 결과</h2>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2 font-medium">분석 완료</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {analyzedAt ? new Date(analyzedAt).toLocaleDateString('ko-KR') : '-'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2 font-medium">입력 글</p>
                  <p className="text-2xl font-bold gradient-text">2</p>
                </div>

                <div className="bg-gradient-to-br from-secondary/20 to-secondary/10 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2 font-medium">토큰 사용량</p>
                  <p className="text-sm font-semibold text-gray-800">약 {estimateTokens} 토큰</p>
                </div>
              </div>

              {/* 스타일 내용 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">분석된 블로그 스타일 (영문)</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
                  {compactStyle}
                </p>
              </div>

              {/* 저장 위치 정보 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm text-blue-800">
                  <strong>☁️ Supabase:</strong> 스타일이 클라우드 데이터베이스에 저장되었습니다 (Vercel 환경 호환)
                </p>
                <p className="text-sm text-blue-800">
                  <strong>📱 로컬:</strong> sessionStorage에도 저장되어 즉시 사용 가능합니다
                </p>
                <p className="text-sm text-blue-800">
                  <strong>🤖 Assistant:</strong> OpenAI Assistant의 instruction에도 반영되었습니다.
                </p>
              </div>
            </div>

            {/* 다음 단계 */}
            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <h3 className="text-xl font-bold gradient-text mb-4">🚀 다음 단계</h3>
              <ol className="space-y-3 text-gray-700">
                <li className="flex gap-3">
                  <span className="font-bold text-primary min-w-fit">1단계</span>
                  <span>이제 <strong>/generate</strong> 페이지에서 글을 생성할 수 있습니다</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-primary min-w-fit">2단계</span>
                  <span>생성된 글에는 분석한 스타일이 자동으로 적용됩니다</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-primary min-w-fit">3단계</span>
                  <span>이모티콘 없이 깔끔한 스타일로 작성됩니다</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-primary min-w-fit">4단계</span>
                  <span>언제든 다시 분석 페이지에서 스타일을 다시 학습시킬 수 있습니다</span>
                </li>
              </ol>
            </div>

            {/* 팁 */}
            <div className="glass-effect rounded-xl p-8 shadow-soft bg-yellow-50 border border-yellow-100">
              <h3 className="text-lg font-bold text-yellow-900 mb-4">💡 팁</h3>
              <ul className="space-y-2 text-sm text-yellow-800">
                <li>• 스타일은 24시간마다 다시 분석할 수 있습니다</li>
                <li>• 분석된 스타일은 OpenAI Assistant에 저장되어 매번 전달할 필요가 없습니다</li>
                <li>• 토큰 비용을 약 70% 절약할 수 있습니다</li>
                <li>• 이모티콘을 제거하여 더 전문적인 글을 생성합니다</li>
              </ul>
            </div>
          </div>
        )}

        {/* 초기 상태 안내 및 저장된 스타일 표시 */}
        {!compactStyle && !analyzing && (
          <div className="space-y-6">
            {savedStyle ? (
              <div className="glass-effect rounded-xl p-8 shadow-soft bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-4 mb-6">
                  <div className="text-4xl">✅</div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-blue-900 mb-2">스타일이 저장되었습니다</h3>
                    <p className="text-sm text-blue-700">현재 저장된 스타일을 사용하여 블로그 글을 생성할 수 있습니다.</p>
                  </div>
                </div>

                <div className="bg-white border border-blue-200 rounded-lg p-6 mb-6">
                  <h4 className="font-bold text-gray-800 mb-3">📖 현재 저장된 스타일</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono mb-4">
                    {savedStyle}
                  </p>
                  {savedDate && (
                    <p className="text-xs text-gray-500">저장 시간: {savedDate}</p>
                  )}
                </div>

                <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>💡 팁:</strong> 새로운 스타일을 배우려면 글 2개를 입력한 후 위의 "새로운 글 작성 스타일 분석" 버튼을 클릭하세요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="glass-effect rounded-xl p-8 shadow-soft text-center">
                <p className="text-gray-600 text-lg mb-4">
                  블로그의 특징을 반영할 2개의 글을 입력하세요
                </p>
                <p className="text-gray-500 text-sm">
                  스타일 분석이 완료되면 AI 글 생성에 자동으로 적용됩니다
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
