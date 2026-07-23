'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/layout/Navigation';
import { AlertCircle, X, Plus, Trash2, RefreshCw } from 'lucide-react';
import type { NeighborCommentResult } from '@/types/index';

export default function NeighborCommentAndLikePage() {
  const [blogId, setBlogId] = useState('');
  const [blogPassword, setBlogPassword] = useState('');
  const [maxPosts, setMaxPosts] = useState(5);
  const [minInterval, setMinInterval] = useState(3);
  const [keepLikingAfter, setKeepLikingAfter] = useState(false);
  const [result, setResult] = useState<NeighborCommentResult | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 닉네임 목록 관련 상태
  const [targetNicknames, setTargetNicknames] = useState<string[]>([]);
  const [newNickname, setNewNickname] = useState('');
  const [loadingTargetList, setLoadingTargetList] = useState(false);
  const [targetListError, setTargetListError] = useState('');
  const [targetListSuccess, setTargetListSuccess] = useState('');

  // 동기화 관련 상태
  const [syncBlogId, setSyncBlogId] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    totalFetched: number;
    totalAdded: number;
    addedNicknames: string[];
  } | null>(null);

  // 초기 로드: 저장된 닉네임 목록 불러오기
  useEffect(() => {
    loadTargetList();
  }, []);

  const loadTargetList = async () => {
    setLoadingTargetList(true);
    try {
      const response = await fetch('/api/neighbor/target-list');
      const data = await response.json();

      if (data.success) {
        setTargetNicknames(data.nicknames || []);
        setTargetListError('');
      } else {
        setTargetListError('목록 불러오기 실패');
      }
    } catch (err) {
      console.error('목록 불러오기 오류:', err);
      setTargetListError('목록을 불러올 수 없습니다');
    } finally {
      setLoadingTargetList(false);
    }
  };

  const handleInitFromFile = async () => {
    setLoadingTargetList(true);
    try {
      const response = await fetch('/api/neighbor/target-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initFromFile: true }),
      });

      const data = await response.json();

      if (data.success) {
        setTargetNicknames(data.nicknames || []);
        setTargetListSuccess(`neighbor_list.txt에서 ${data.nicknames.length}개 로드 완료`);
        setTargetListError('');
        setTimeout(() => setTargetListSuccess(''), 3000);
      } else {
        setTargetListError(data.error || '로드 실패');
      }
    } catch (err) {
      console.error('파일 로드 오류:', err);
      setTargetListError('파일을 로드할 수 없습니다');
    } finally {
      setLoadingTargetList(false);
    }
  };

  const handleAddNickname = async () => {
    if (!newNickname.trim()) {
      setTargetListError('닉네임을 입력하세요');
      return;
    }

    setLoadingTargetList(true);
    try {
      const response = await fetch('/api/neighbor/target-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', nickname: newNickname.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setTargetNicknames(data.nicknames || []);
        setNewNickname('');
        setTargetListSuccess(`"${newNickname}" 추가 완료`);
        setTargetListError('');
        setTimeout(() => setTargetListSuccess(''), 3000);
      } else {
        setTargetListError(data.error || '추가 실패');
      }
    } catch (err) {
      console.error('추가 오류:', err);
      setTargetListError('닉네임을 추가할 수 없습니다');
    } finally {
      setLoadingTargetList(false);
    }
  };

  const handleRemoveNickname = async (nickname: string) => {
    setLoadingTargetList(true);
    try {
      const response = await fetch('/api/neighbor/target-list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });

      const data = await response.json();

      if (data.success) {
        setTargetNicknames(data.nicknames || []);
        setTargetListSuccess(`"${nickname}" 제거 완료`);
        setTargetListError('');
        setTimeout(() => setTargetListSuccess(''), 3000);
      } else {
        setTargetListError(data.error || '제거 실패');
      }
    } catch (err) {
      console.error('제거 오류:', err);
      setTargetListError('닉네임을 제거할 수 없습니다');
    } finally {
      setLoadingTargetList(false);
    }
  };

  const handleSync = async () => {
    if (!syncBlogId.trim() || !syncPassword.trim()) {
      setTargetListError('동기화할 네이버 ID와 비밀번호를 입력하세요.');
      return;
    }
    setIsSyncing(true);
    setSyncResult(null);
    setTargetListError('');
    setTargetListSuccess('');

    try {
      const response = await fetch('/api/neighbor/sync-buddy-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogId: syncBlogId.trim(), blogPassword: syncPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setTargetListError(data.error || '동기화 중 오류가 발생했습니다.');
        return;
      }

      setTargetNicknames(data.allNicknames || []);
      setSyncResult({
        totalFetched: data.totalFetched,
        totalAdded: data.totalAdded,
        addedNicknames: data.addedNicknames,
      });
      setTargetListSuccess(
        `동기화 완료: 네이버 서로이웃 ${data.totalFetched}명 확인, ${data.totalAdded}명 신규 추가`
      );
      setSyncBlogId('');
      setSyncPassword('');
      setTimeout(() => setTargetListSuccess(''), 5000);
    } catch (err) {
      setTargetListError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!blogId.trim() || !blogPassword.trim()) {
      setError('블로그 ID와 비밀번호를 입력하세요.');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/neighbor/comment-and-like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId: blogId.trim(),
          blogPassword,
          maxPosts,
          minInterval,
          keepLikingAfter,
        }),
      });

      const data: NeighborCommentResult = await response.json();

      if (!response.ok) {
        setError(data.error || '처리 중 오류가 발생했습니다.');
        setResult(data);
        return;
      }

      setResult(data);

      if (data.success) {
        // 성공 시 입력값 초기화
        setBlogId('');
        setBlogPassword('');
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMsg);
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
              💬 이웃새글 댓글+좋아요
            </h1>
            <p className="text-gray-600 text-lg">
              블로그 스타일에 맞춘 AI 댓글을 자동으로 작성하고 좋아요를 누릅니다
            </p>
          </div>

          {/* 정보 배너 */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-300 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">
                ℹ️ 로컬 환경에서만 작동합니다
              </p>
              <p className="text-sm text-blue-700 mt-1">
                <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                  npm run dev
                </code>
                로 로컬 서버를 실행하세요.
              </p>
            </div>
          </div>

          {/* 닉네임 목록 관리 섹션 */}
          <div className="glass-effect rounded-xl p-8 mb-8 shadow-md-soft border border-amber-200 bg-amber-50">
            <h2 className="text-2xl font-bold text-amber-900 mb-4">🎯 댓글 대상 닉네임 관리</h2>

            <p className="text-sm text-amber-700 mb-4">
              댓글을 작성할 이웃 블로거의 닉네임을 등록하세요. <span className="font-semibold">등록된 닉네임이 URL에 포함되어 있고, 좋아요가 없는 글에만 댓글을 작성합니다.</span>
            </p>

            {targetListError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
                {targetListError}
              </div>
            )}

            {targetListSuccess && (
              <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded">
                {targetListSuccess}
              </div>
            )}

            {/* 이웃 동기화 섹션 */}
            <div className="mb-6 p-4 bg-white border border-amber-300 rounded-lg">
              <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                네이버 서로이웃 자동 동기화
              </h3>
              <p className="text-xs text-amber-700 mb-3">
                네이버 이웃 관리 페이지에서 서로이웃 목록을 가져와, 목록에 없는 이웃을 자동으로 추가합니다.
              </p>
              <div className="flex flex-col gap-2 mb-3">
                <input
                  type="text"
                  value={syncBlogId}
                  onChange={(e) => setSyncBlogId(e.target.value)}
                  placeholder="네이버 ID"
                  className="px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  disabled={isSyncing}
                />
                <input
                  type="password"
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                  placeholder="비밀번호"
                  className="px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  disabled={isSyncing}
                />
              </div>
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing || !syncBlogId.trim() || !syncPassword.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 smooth-transition flex items-center justify-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    동기화 중... (브라우저 창 확인)
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    🔄 서로이웃 목록 동기화
                  </>
                )}
              </button>

              {/* 동기화 결과 */}
              {syncResult && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <p className="font-semibold text-blue-900 mb-1">동기화 결과</p>
                  <p className="text-blue-700">네이버 서로이웃: {syncResult.totalFetched}명</p>
                  <p className="text-blue-700">신규 추가: {syncResult.totalAdded}명</p>
                  {syncResult.addedNicknames.length > 0 && (
                    <div className="mt-2">
                      <p className="text-blue-600 font-medium">추가된 이웃:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {syncResult.addedNicknames.map((n) => (
                          <span key={n} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 파일에서 로드 버튼 */}
            <div className="mb-6">
              <button
                type="button"
                onClick={handleInitFromFile}
                disabled={loadingTargetList}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:bg-gray-400 smooth-transition"
              >
                {loadingTargetList ? '로딩 중...' : '📄 neighbor_list.txt에서 로드'}
              </button>
              <p className="text-xs text-amber-600 mt-2">
                neighbor_list.txt 파일의 모든 닉네임을 불러와 업데이트합니다.
              </p>
            </div>

            {/* 닉네임 추가 */}
            <div className="mb-6">
              <label className="block font-semibold text-amber-900 mb-2">새 닉네임 추가</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="닉네임 입력 (예: jinhee-yoo)"
                  className="flex-1 px-4 py-3 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  disabled={loadingTargetList}
                />
                <button
                  type="button"
                  onClick={handleAddNickname}
                  disabled={loadingTargetList || !newNickname.trim()}
                  className="px-4 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:bg-gray-400 smooth-transition flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" /> 추가
                </button>
              </div>
            </div>

            {/* 닉네임 목록 표시 */}
            <div>
              <label className="block font-semibold text-amber-900 mb-3">
                등록된 닉네임 ({targetNicknames.length}개)
              </label>
              {targetNicknames.length === 0 ? (
                <p className="text-gray-500 italic py-4">
                  등록된 닉네임이 없습니다. 위의 버튼으로 로드하거나 추가해주세요.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {targetNicknames.map((nickname) => (
                    <div
                      key={nickname}
                      className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-50 smooth-transition"
                    >
                      <span className="font-medium text-gray-700">{nickname}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveNickname(nickname)}
                        disabled={loadingTargetList}
                        className="text-red-500 hover:text-red-700 disabled:text-gray-400 ml-2"
                        title="제거"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 메인 폼 */}
          <div className="glass-effect rounded-xl p-8 mb-8 shadow-md-soft">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 안내 메시지 */}
              <div className="p-4 bg-purple-50 border border-purple-300 rounded-lg">
                <p className="text-purple-900 font-semibold">📌 댓글 작성 조건</p>
                <div className="text-sm text-purple-700 mt-2 space-y-2">
                  <p>
                    📋 <span className="font-semibold">1단계:</span> 글의 URL에 위의 닉네임 목록에 있는 이름이 포함되어 있는가?
                  </p>
                  <p className="ml-6 text-purple-600">
                    ✗ 포함 안됨 → 댓글을 달지 않습니다 (좋아요 여부 무관)
                  </p>
                  <p className="ml-6 text-purple-600">
                    ✓ 포함됨 → 2단계 진행
                  </p>
                  <p>
                    ❤️ <span className="font-semibold">2단계:</span> 포함되었다면, 좋아요가 없는가?
                  </p>
                  <p className="ml-6 text-purple-600">
                    ✗ 좋아요 있음 → 댓글을 달지 않습니다
                  </p>
                  <p className="ml-6 text-green-600 font-semibold">
                    ✓ 좋아요 없음 → 댓글을 작성합니다! 🎉
                  </p>
                  <p className="text-purple-600 font-semibold mt-3">
                    주의: 한 번에 최대 5개 글의 댓글을 작성하며, 각 글마다 3분 이상 간격으로 처리됩니다 (스팸 방지).
                  </p>
                </div>
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
                  ⚠️ 계정 정보는 메모리에만 임시 저장되며, 작업 완료 후 자동으로
                  삭제됩니다.
                </p>
              </div>

              {/* 최대 글 수 */}
              <div>
                <label className="block font-semibold text-gray-900 mb-2">
                  최대 처리 글 수
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxPosts}
                  onChange={(e) => setMaxPosts(Math.min(10, parseInt(e.target.value) || 5))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                  disabled={isProcessing}
                />
                <p className="text-gray-500 text-sm mt-2">
                  💡 신규 댓글 작성 글 수입니다. 최대 10개까지 가능합니다 (스팸 방지)
                </p>
              </div>

              {/* 최소 간격 */}
              <div>
                <label className="block font-semibold text-gray-900 mb-2">
                  글 처리 간격 (분)
                </label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={minInterval}
                  onChange={(e) => setMinInterval(Math.max(3, parseInt(e.target.value) || 3))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                  disabled={isProcessing}
                />
                <p className="text-gray-500 text-sm mt-2">
                  💡 각 글을 처리한 후 다음 글까지의 최소 대기 시간 (3분 이상
                  권장)
                </p>
              </div>

              {/* 좋아요 지속하기 */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepLikingAfter}
                    onChange={(e) => setKeepLikingAfter(e.target.checked)}
                    className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/50 cursor-pointer"
                    disabled={isProcessing}
                  />
                  <span className="font-semibold text-gray-900">👍 좋아요 지속하기</span>
                </label>
                <p className="text-gray-500 text-sm mt-2 ml-8">
                  체크하면, 댓글 작성이 완료된 후에도 프로그램을 종료하지 않고 새로운 글에 계속 좋아요를 누릅니다
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
                disabled={
                  isProcessing ||
                  !blogId.trim() ||
                  !blogPassword.trim()
                }
                className={`w-full py-3 rounded-lg font-semibold transition-all smooth-transition ${
                  isProcessing ||
                  !blogId.trim() ||
                  !blogPassword.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-primary text-white hover:shadow-md-soft active:scale-95'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span> 처리 중...
                  </span>
                ) : (
                  '🚀 댓글+좋아요 시작'
                )}
              </button>
            </form>
          </div>

          {/* 결과 표시 */}
          {result && (
            <div
              className={`rounded-xl p-8 shadow-md-soft border-l-4 ${
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
                  <p className="text-sm text-gray-600 font-light mb-2">처리된 글</p>
                  <p className="text-3xl font-bold text-primary">
                    {result.totalProcessed}
                  </p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">
                    댓글 작성
                  </p>
                  <p className="text-3xl font-bold text-accent">
                    {result.totalCommented}
                  </p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">좋아요</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {result.totalLiked}
                  </p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">소요 시간</p>
                  <p className="text-3xl font-bold text-green-600">
                    {Math.round(
                      (new Date(result.completedAt).getTime() -
                        new Date(result.startedAt).getTime()) /
                        1000
                    )}
                    s
                  </p>
                </div>
              </div>

              {/* 댓글 작성 성공 목록 */}
              {result.details.filter((d) => d.commented).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-green-900 mb-3">
                    ✅ 댓글 작성 성공 ({result.totalCommented}개)
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {result.details
                      .filter((d) => d.commented)
                      .map((detail, idx) => (
                        <div
                          key={idx}
                          className="glass-effect rounded p-4 bg-green-50 border-l-4 border-l-green-500 shadow-sm"
                        >
                          <p className="text-sm text-gray-900 font-semibold">
                            📝 {detail.title}
                          </p>
                          <p className="text-sm text-gray-800 mt-2 italic">
                            "{detail.comment}"
                          </p>
                          {detail.url && (
                            <a
                              href={detail.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-block underline"
                            >
                              글 보기 ↗
                            </a>
                          )}
                          <p
                            className={`text-xs mt-2 font-semibold ${
                              detail.liked
                                ? 'text-blue-600'
                                : 'text-gray-500'
                            }`}
                          >
                            {detail.liked ? '👍 좋아요 완료' : '❌ 좋아요 실패'}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 건너뛴 글 목록 */}
              {result.totalSkipped > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    ⏭️ 건너뛴 글 ({result.totalSkipped}개)
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.details
                      .filter((d) => !d.commented && d.reason)
                      .map((detail, idx) => (
                        <div
                          key={idx}
                          className="glass-effect rounded p-3 bg-yellow-50 border-l-4 border-l-yellow-500 shadow-sm"
                        >
                          <p className="text-sm text-gray-900 font-medium">
                            {detail.title}
                          </p>
                          <p className="text-xs text-gray-700 mt-1">
                            이유: {detail.reason}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 닫기 버튼 */}
              <button
                onClick={() => setResult(null)}
                className="w-full py-2 glass-effect hover:shadow-md-soft text-gray-900 rounded-lg transition-all smooth-transition"
              >
                결과 닫기
              </button>
            </div>
          )}

          {/* 정보 섹션 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="glass-effect rounded-xl p-6 shadow-md-soft">
              <h3 className="font-bold text-lg gradient-text mb-4">
                🔍 작동 원리
              </h3>
              <ul className="text-gray-700 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>
                    블로그 스타일에 맞춘 AI 댓글 자동 생성
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>이미 좋아요를 누른 글은 자동 스킵</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>각 글의 본문을 읽고 댓글 작성</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>댓글 작성 후 자동으로 좋아요 클릭</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>
                    최대 10개 글, 3분 이상 간격 (스팸 방지)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>완료 후 모든 정보 자동 삭제</span>
                </li>
              </ul>
            </div>

            <div className="glass-effect rounded-xl p-6 shadow-md-soft border-l-4 border-l-orange-400">
              <h3 className="font-bold text-lg text-gray-900 mb-4">
                ⚠️ 주의사항
              </h3>
              <ul className="text-gray-700 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>로컬 환경에서만 작동</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>올바른 ID/PW 입력 필수</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>처리 시간이 길 수 있음 (최대 30분+)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>처리 중 브라우저를 닫지 말 것</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>과도한 빈도로 사용 금지 (네이버 차단)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>
                    댓글 내용 자동 검토 후 사용 권장
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
