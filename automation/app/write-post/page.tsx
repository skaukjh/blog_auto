'use client';

import { useMemo, useState } from 'react';
import Navigation from '@/components/layout/Navigation';
import { AlertCircle, PenLine } from 'lucide-react';

interface WritePostResult {
  success: boolean;
  typedChars: number;
  elapsedMs: number;
  published: boolean;
  editorUrl?: string;
  warnings: string[];
  startedAt: string;
  completedAt: string;
  error?: string;
}

/** 속도 프리셋 - 글자당 입력 간격(ms) */
const SPEED_PRESETS = [
  { label: '느리게 (가장 자연스러움)', value: 90 },
  { label: '보통 (권장)', value: 55 },
  { label: '빠르게', value: 30 },
];

export default function WritePostPage() {
  const [blogId, setBlogId] = useState('');
  const [blogPassword, setBlogPassword] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [charDelayMs, setCharDelayMs] = useState(55);
  const [stripImageMarkers, setStripImageMarkers] = useState(false);
  const [autoPublish, setAutoPublish] = useState(false);
  const [result, setResult] = useState<WritePostResult | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const markerCount = useMemo(
    () => (content.match(/\[IMAGE_\d+\]/g) || []).length,
    [content]
  );

  // 예상 소요 시간 - 글자당 간격에 문장·문단 대기를 더한 근사치입니다.
  const estimatedMinutes = useMemo(() => {
    const chars = title.length + content.length;
    if (chars === 0) return 0;
    const typingMs = chars * charDelayMs;
    const sentences = (content.match(/[.!?]/g) || []).length;
    const pauseMs = sentences * 575 + (content.split(/\n\s*\n/).length - 1) * 1550;
    return Math.max(1, Math.round((typingMs + pauseMs) / 60000));
  }, [title, content, charDelayMs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!blogId.trim() || !blogPassword.trim()) {
      setError('블로그 ID와 비밀번호를 입력하세요.');
      return;
    }
    if (!title.trim()) {
      setError('제목을 입력하세요.');
      return;
    }
    if (!content.trim()) {
      setError('본문을 입력하세요.');
      return;
    }
    if (
      autoPublish &&
      !window.confirm(
        '타이핑이 끝나면 자동으로 발행합니다.\n' +
          '검토 없이 바로 올라가는데 계속할까요?'
      )
    ) {
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/post/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId: blogId.trim(),
          blogPassword,
          title: title.trim(),
          content,
          charDelayMs,
          stripImageMarkers,
          autoPublish,
        }),
      });

      const data: WritePostResult = await response.json();
      setResult(data);

      if (!response.ok || !data.success) {
        setError(data.error || '처리 중 오류가 발생했습니다.');
        return;
      }

      setBlogPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold gradient-text mb-2">
              <PenLine className="inline w-9 h-9 mr-2" />
              글쓰기 순차 입력
            </h1>
            <p className="text-gray-600 text-lg">
              완성된 글을 붙여넣지 않고, 네이버 글쓰기 화면에 사람처럼 한 글자씩 입력합니다
            </p>
          </div>

          {/* 정보 배너 */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-300 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">
                크롬 창이 뜬 뒤에는 건드리지 마세요
              </p>
              <p className="text-sm text-blue-700 mt-1">
                타이핑 중에 마우스나 키보드를 쓰면 입력 위치가 어긋납니다. 2차 인증이 뜨면
                그때만 직접 처리하세요 (최대 2분 대기).
              </p>
            </div>
          </div>

          {/* 입력 폼 */}
          <div className="glass-effect rounded-xl p-8 mb-8 shadow-md-soft">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    블로그 ID
                  </label>
                  <input
                    type="text"
                    value={blogId}
                    onChange={(e) => setBlogId(e.target.value)}
                    disabled={isProcessing}
                    placeholder="네이버 아이디"
                    autoComplete="username"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    비밀번호
                  </label>
                  <input
                    type="password"
                    value={blogPassword}
                    onChange={(e) => setBlogPassword(e.target.value)}
                    disabled={isProcessing}
                    placeholder="비밀번호"
                    autoComplete="current-password"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  제목
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isProcessing}
                  placeholder="글 제목"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  본문
                  <span className="ml-2 font-normal text-gray-500">
                    {content.length.toLocaleString()}자
                    {markerCount > 0 && ` · [IMAGE_N] 마커 ${markerCount}개`}
                  </span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={isProcessing}
                  rows={14}
                  placeholder="글 생성 앱에서 받은 본문을 붙여넣으세요. 빈 줄로 문단을 나눕니다."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  입력 속도
                </label>
                <div className="flex flex-wrap gap-2">
                  {SPEED_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setCharDelayMs(preset.value)}
                      disabled={isProcessing}
                      className={`px-4 py-2 rounded-lg font-medium smooth-transition disabled:opacity-50 ${
                        charDelayMs === preset.value
                          ? 'bg-primary text-white shadow-md-soft'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {estimatedMinutes > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    예상 소요 시간: 약 {estimatedMinutes}분. 이 시간 동안 크롬 창을 그대로
                    두어야 합니다.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stripImageMarkers}
                    onChange={(e) => setStripImageMarkers(e.target.checked)}
                    disabled={isProcessing}
                    className="mt-1 w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold">[IMAGE_N] 마커 제거</span> — 체크하면
                    마커를 빼고 입력합니다. 체크하지 않으면 사진 넣을 위치 표시로 그대로
                    남습니다.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPublish}
                    onChange={(e) => setAutoPublish(e.target.checked)}
                    disabled={isProcessing}
                    className="mt-1 w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold text-red-700">자동 발행</span> —
                    체크하지 않으면 타이핑만 하고 에디터를 열어 둡니다. 사진을 넣어야 한다면
                    체크하지 마세요.
                  </span>
                </label>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-red-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-4 rounded-lg bg-primary text-white font-bold text-lg shadow-md-soft hover:opacity-90 disabled:opacity-50 smooth-transition"
              >
                {isProcessing ? '입력 중... (크롬 창을 건드리지 마세요)' : '순차 입력 시작'}
              </button>
            </form>
          </div>

          {/* 결과 */}
          {result && (
            <div className="glass-effect rounded-xl p-8 shadow-md-soft">
              <h2 className="text-2xl font-bold mb-4">
                {result.success ? '입력 완료' : '입력 실패'}
              </h2>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-primary">
                    {result.typedChars.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">입력한 글자</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-primary">
                    {Math.round(result.elapsedMs / 1000)}초
                  </p>
                  <p className="text-sm text-gray-600 mt-1">소요 시간</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-primary">
                    {result.published ? '발행됨' : '미발행'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">발행 상태</p>
                </div>
              </div>

              {result.warnings.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                  <p className="font-semibold text-amber-900 mb-2">확인이 필요합니다</p>
                  <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                    {result.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-lg text-red-800">
                  {result.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
