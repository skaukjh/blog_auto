'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Navigation from '@/components/layout/Navigation';
import { RotateCw, Check, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { EXPERT_LIST } from '@/lib/experts/definitions';
import type { ExpertType } from '@/types';

/**
 * 예시글 입력 슬롯 규칙.
 *
 * 개수 상한은 없습니다. "예시글 추가" 버튼으로 원하는 만큼 늘릴 수 있고,
 * 넣은 글은 전부 분석에 들어갑니다.
 */
const MIN_SAMPLES = 2;
/** 처음 화면에 보여줄 빈 슬롯 개수 */
const INITIAL_SLOTS = 5;
// 글 1개당 최소 글자 수 제한은 없습니다. 내용이 있으면 길이와 무관하게 분석에 들어갑니다.

/** 전문가별 문체 현황 (서버에서 받아오는 정보) */
interface StyleSummary {
  analyzedAt: string;
  sampleCount: number;
  preview: string;
  /** 분석 결과 전문 */
  style?: string;
  /** 분석에 사용한 예시글 원문 (마이그레이션 004 이후 저장분만) */
  samples?: string[] | null;
}

/** 분석 직후 화면에 표시할 결과 */
interface AnalysisResult {
  compactStyle: string;
  analyzedAt: string;
  sampleCount: number;
  sentenceEnding?: { pattern: '요' | '다'; confidence: number };
  persisted: boolean;
  /** 예시글이 그대로라 OpenAI 호출 없이 기존 결과를 받았는지 */
  reused: boolean;
  cost: { usd: number; krw: number } | null;
}

/** 빈 슬롯 배열 */
const emptySamples = () => Array<string>(INITIAL_SLOTS).fill('');

export default function FormatPage() {
  const [activeExpert, setActiveExpert] = useState<ExpertType>(EXPERT_LIST[0].type);

  // 전문가별 입력 내용을 따로 보관해, 탭을 옮겨도 작성 중이던 글이 남습니다.
  const [samplesByExpert, setSamplesByExpert] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(EXPERT_LIST.map((e) => [e.type, emptySamples()]))
  );

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [savedStyles, setSavedStyles] = useState<Record<string, StyleSummary>>({});

  const samples = samplesByExpert[activeExpert] ?? emptySamples();
  const expert = EXPERT_LIST.find((e) => e.type === activeExpert)!;

  /**
   * 저장된 전문가별 문체 현황을 불러옵니다.
   *
   * @param restoreSamples 저장된 예시글을 입력창에 되돌릴지 여부.
   *   첫 진입에서만 true입니다. 분석 직후에 되돌리면 사용자가 방금 고친
   *   내용을 덮어쓰게 되므로 그때는 현황만 갱신합니다.
   */
  const loadSavedStyles = useCallback(
    async (restoreSamples = false) => {
      try {
        const response = await fetch('/api/blog/get-current-style?all=true');
        if (!response.ok) return;
        const data = await response.json();
        if (!data.success || !data.styles) return;

        setSavedStyles(data.styles);

        if (!restoreSamples) return;

        // 지난번에 넣었던 예시글을 전문가별로 입력창에 다시 채웁니다.
        setSamplesByExpert((prev) => {
          const next = { ...prev };
          for (const [scope, summary] of Object.entries(
            data.styles as Record<string, StyleSummary>
          )) {
            const stored = summary.samples;
            if (!Array.isArray(stored) || stored.length === 0) continue;
            if (!(scope in next)) continue;

            // 사용자가 이미 뭔가 입력해 둔 탭은 건드리지 않습니다.
            const current = next[scope] ?? [];
            if (current.some((s) => s.trim().length > 0)) continue;

            // 저장된 글 수가 기본 칸보다 적으면 빈 칸으로 채워 둡니다.
            const padded = [...stored];
            while (padded.length < INITIAL_SLOTS) padded.push('');
            next[scope] = padded;
          }
          return next;
        });
      } catch (err) {
        console.warn('저장된 문체 현황 조회 실패:', err);
      }
    },
    []
  );

  useEffect(() => {
    loadSavedStyles(true);
  }, [loadSavedStyles]);

  // 탭을 바꾸면 방금 분석한 결과 표시와 오류만 지웁니다 (입력 내용은 유지)
  useEffect(() => {
    setResult(null);
    setError('');
  }, [activeExpert]);

  /** 현재 탭에서 내용이 있는 예시글만 추립니다 (길이 제한 없음) */
  const validSamples = useMemo(
    () => samples.map((s) => s.trim()).filter((s) => s.length > 0),
    [samples]
  );

  const estimateTokens = useMemo(
    () => Math.ceil(validSamples.join('').length / 4) + 200,
    [validSamples]
  );

  /** 특정 슬롯의 내용 변경 */
  const updateSample = useCallback(
    (index: number, value: string) => {
      setSamplesByExpert((prev) => {
        const next = [...(prev[activeExpert] ?? emptySamples())];
        next[index] = value;
        return { ...prev, [activeExpert]: next };
      });
    },
    [activeExpert]
  );

  /** 현재 탭에 빈 슬롯을 하나 추가합니다 (개수 상한 없음) */
  const addSample = useCallback(() => {
    setSamplesByExpert((prev) => ({
      ...prev,
      [activeExpert]: [...(prev[activeExpert] ?? emptySamples()), ''],
    }));
  }, [activeExpert]);

  /** 슬롯 하나를 삭제합니다. 최소 개수 아래로는 줄이지 않습니다 */
  const removeSample = useCallback(
    (index: number) => {
      setSamplesByExpert((prev) => {
        const current = prev[activeExpert] ?? emptySamples();
        if (current.length <= MIN_SAMPLES) return prev;
        return {
          ...prev,
          [activeExpert]: current.filter((_, i) => i !== index),
        };
      });
    },
    [activeExpert]
  );

  /**
   * 문체를 분석합니다.
   *
   * 서버가 예시글 지문을 비교해, 지난번과 같으면 OpenAI를 부르지 않고
   * 저장된 결과를 그대로 돌려줍니다(`reused: true`).
   *
   * @param force 예시글이 그대로여도 강제로 다시 분석
   */
  const handleAnalyze = useCallback(
    async (force = false) => {
      if (validSamples.length < MIN_SAMPLES) {
        setError(`${MIN_SAMPLES}개 이상의 글이 필요합니다`);
        return;
      }

      setAnalyzing(true);
      setError('');
      setResult(null);

      try {
        const response = await fetch('/api/blog/analyze-style', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expertType: activeExpert,
            force,
            posts: validSamples.map((excerpt, i) => ({
              title: `${expert.name} 예시글 ${i + 1}`,
              excerpt,
            })),
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || '문체 분석에 실패했습니다');
        }

        setResult({
          compactStyle: data.compactStyle,
          analyzedAt: data.analyzedAt,
          sampleCount: data.sampleCount,
          sentenceEnding: data.sentenceEnding,
          persisted: Boolean(data.persisted),
          reused: Boolean(data.reused),
          cost: data.cost ?? null,
        });

        await loadSavedStyles();
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setAnalyzing(false);
      }
    },
    [activeExpert, expert.name, validSamples, loadSavedStyles]
  );

  const handleClearAll = useCallback(() => {
    setSamplesByExpert((prev) => ({ ...prev, [activeExpert]: emptySamples() }));
    setResult(null);
    setError('');
  }, [activeExpert]);

  const analyzedCount = EXPERT_LIST.filter((e) => savedStyles[e.type]).length;

  return (
    <div className="min-h-screen">
      <Navigation />

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-5xl">🎨</span>
            <h1 className="text-5xl font-bold gradient-text">전문가별 문체 학습</h1>
          </div>
          <p className="text-lg text-gray-600 font-light">
            전문가마다 예시글을 {MIN_SAMPLES}개 이상 넣으면, 각자의 문체를 따로 학습해
            해당 전문가로 글을 쓸 때 그 문체를 그대로 씁니다 (개수 상한 없음)
          </p>
          <p className="text-sm text-gray-500 mt-2">
            학습 완료: {analyzedCount} / {EXPERT_LIST.length} 전문가
          </p>
        </div>

        {/* 전문가 탭 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {EXPERT_LIST.map((e) => {
            const saved = savedStyles[e.type];
            const isActive = e.type === activeExpert;
            return (
              <button
                key={e.type}
                onClick={() => setActiveExpert(e.type)}
                className={`text-left p-4 rounded-xl border-2 smooth-transition ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-soft'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl">{e.icon}</span>
                  {saved ? (
                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      {saved.sampleCount}개
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      미학습
                    </span>
                  )}
                </div>
                <p className={`font-semibold text-sm ${isActive ? 'text-primary' : 'text-gray-800'}`}>
                  {e.name}
                </p>
                {saved && (
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(saved.analyzedAt).toLocaleDateString('ko-KR')}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* 현재 전문가 안내 */}
        <div className="glass-effect rounded-xl p-6 shadow-soft mb-6">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{expert.icon}</span>
            <div>
              <h2 className="text-xl font-bold gradient-text">{expert.name}</h2>
              <p className="text-sm text-gray-600 mt-1">{expert.description}</p>
              <p className="text-xs text-gray-500 mt-2">
                이 전문가로 쓴 글을 {MIN_SAMPLES}개 이상 넣으세요. 글의 소재가 아니라
                <strong> 문장을 쓰는 방식</strong>(종결어미, 문단 길이, 연결어)만 학습합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 예시글 입력 슬롯 */}
        <div className="space-y-4 mb-8">
          {samples.map((value, index) => {
            const length = value.trim().length;
            const isRequired = index < MIN_SAMPLES;
            const hasContent = length > 0;

            return (
              <div key={index} className="glass-effect rounded-xl p-6 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-800">
                    예시글 {index + 1}
                    {isRequired ? (
                      <span className="ml-2 text-xs text-red-600">필수</span>
                    ) : (
                      <span className="ml-2 text-xs text-gray-400">선택</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-mono ${
                        hasContent ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {length}자
                    </span>
                    {samples.length > MIN_SAMPLES && (
                      <button
                        onClick={() => removeSample(index)}
                        disabled={analyzing}
                        title="이 슬롯 삭제"
                        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-40 smooth-transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={value}
                  onChange={(ev) => updateSample(index, ev.target.value)}
                  placeholder={`${expert.name}로 쓴 블로그 글을 붙여넣으세요 (길이 제한 없음)`}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white text-gray-800 placeholder-gray-400 font-mono text-sm resize-vertical"
                />
              </div>
            );
          })}

          {/* 슬롯 추가 - 개수 상한 없음 */}
          <button
            onClick={addSample}
            disabled={analyzing}
            className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-primary hover:text-primary disabled:opacity-40 smooth-transition flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            예시글 추가 (현재 {samples.length}칸, 개수 제한 없음)
          </button>
        </div>

        {/* 오류 */}
        {error && (
          <div className="glass-effect rounded-xl p-6 shadow-soft mb-8 bg-red-50 border border-red-200">
            <p className="text-red-700 font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => handleAnalyze(false)}
            disabled={analyzing || validSamples.length < MIN_SAMPLES}
            className="flex-1 px-6 py-4 gradient-primary text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold smooth-transition flex items-center justify-center gap-2"
          >
            <RotateCw className={`w-5 h-5 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing
              ? '분석 중...'
              : `${expert.name} 문체 분석 (유효 ${validSamples.length}개)`}
          </button>

          {/* 예시글이 그대로여도 다시 돌리고 싶을 때 */}
          {savedStyles[activeExpert] && (
            <button
              onClick={() => handleAnalyze(true)}
              disabled={analyzing || validSamples.length < MIN_SAMPLES}
              title="예시글이 그대로여도 OpenAI에 다시 분석을 요청합니다 (비용 발생)"
              className="px-6 py-4 bg-amber-100 text-amber-900 rounded-lg hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold smooth-transition"
            >
              강제 재분석
            </button>
          )}

          {samples.some((s) => s.trim()) && (
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
        {result && (
          <div className="space-y-6">
            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <h2 className="text-2xl font-bold gradient-text mb-6">
                📊 {expert.name} 분석 결과
              </h2>

              {result.reused && (
                <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
                  <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold">
                      예시글이 지난번과 같아 기존 분석 결과를 그대로 씁니다
                    </p>
                    <p className="text-blue-700 mt-1">
                      OpenAI를 호출하지 않아 비용이 들지 않았습니다. 예시글을 하나라도
                      고치고 다시 누르면 새로 분석합니다.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2 font-medium">분석 완료</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {new Date(result.analyzedAt).toLocaleString('ko-KR')}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2 font-medium">사용한 예시글</p>
                  <p className="text-2xl font-bold gradient-text">{result.sampleCount}</p>
                </div>

                {result.sentenceEnding && (
                  <div className="bg-gradient-to-br from-green-100 to-green-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-2 font-medium">감지된 종결어미</p>
                    <p className="text-2xl font-bold text-green-700">
                      ~~{result.sentenceEnding.pattern}
                    </p>
                    <p className="text-xs text-gray-500">
                      일관도 {Math.round(result.sentenceEnding.confidence * 100)}%
                    </p>
                  </div>
                )}

                <div className="bg-gradient-to-br from-secondary/20 to-secondary/10 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2 font-medium">토큰 사용량</p>
                  <p className="text-sm font-semibold text-gray-800">약 {estimateTokens} 토큰</p>
                  {result.cost && (
                    <p className="text-xs text-gray-500">{result.cost.krw.toLocaleString()}₩</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  분석된 문체 가이드 (영문)
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
                  {result.compactStyle}
                </p>
              </div>

              <div
                className={`rounded-lg p-4 border ${
                  result.persisted ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-300'
                }`}
              >
                {result.persisted ? (
                  <p className="text-sm text-blue-800">
                    <strong>☁️ 저장 완료:</strong> {expert.name}의 문체가 Supabase에 저장되어,
                    이 전문가로 글을 쓸 때마다 자동 적용됩니다.
                  </p>
                ) : (
                  <p className="text-sm text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      <strong>DB 저장 실패:</strong> Supabase 연결을 확인하세요. 서버가 재시작되면
                      학습한 문체가 사라집니다.
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="glass-effect rounded-xl p-8 shadow-soft bg-yellow-50 border border-yellow-100">
              <h3 className="text-lg font-bold text-yellow-900 mb-4">💡 참고</h3>
              <ul className="space-y-2 text-sm text-yellow-800">
                <li>• 예시글이 많을수록 문체 패턴이 더 정확해집니다 (개수 제한 없음)</li>
                <li>
                  • 다만 예시글 전체가 한 번에 모델로 들어갑니다. 지나치게 많이 넣으면
                  컨텍스트 한도에 걸려 분석이 실패할 수 있습니다
                </li>
                <li>• 종결어미는 예시글에서 직접 세어 판정하므로, ~~다체 블로그도 그대로 유지됩니다</li>
                <li>• 아직 학습하지 않은 전문가로 글을 쓰면 페르소나 기본 톤으로 생성됩니다</li>
                <li>• 같은 전문가를 다시 분석하면 기존 문체를 덮어씁니다</li>
              </ul>
            </div>
          </div>
        )}

        {/* 저장된 문체 현황 */}
        {!result && savedStyles[activeExpert] && (
          <div className="glass-effect rounded-xl p-8 shadow-soft bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="text-4xl">✅</div>
              <div>
                <h3 className="text-2xl font-bold text-blue-900 mb-1">
                  {expert.name} 문체가 학습돼 있습니다
                </h3>
                <p className="text-sm text-blue-700">
                  예시글 {savedStyles[activeExpert].sampleCount}개 기준 ·{' '}
                  {new Date(savedStyles[activeExpert].analyzedAt).toLocaleString('ko-KR')}
                </p>
              </div>
            </div>

            <div className="bg-white border border-blue-200 rounded-lg p-6">
              <h4 className="font-bold text-gray-800 mb-3">📖 저장된 문체</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
                {savedStyles[activeExpert].style ?? `${savedStyles[activeExpert].preview}…`}
              </p>
            </div>

            {Array.isArray(savedStyles[activeExpert].samples) &&
            savedStyles[activeExpert].samples!.length > 0 ? (
              <p className="text-sm text-blue-900 mt-4">
                <strong>💡</strong> 지난번에 넣은 예시글{' '}
                {savedStyles[activeExpert].samples!.length}개를 위 입력창에 그대로 되살렸습니다.
                고치고 분석 버튼을 누르면 다시 학습합니다. 그대로 두고 누르면 재분석하지 않습니다.
              </p>
            ) : (
              <p className="text-sm text-blue-900 mt-4">
                <strong>💡</strong> 이 문체는 예시글 원문이 저장되기 전에 학습된 것이라 입력창을
                되살리지 못했습니다. 다시 분석하면 다음부터는 복원됩니다.
              </p>
            )}
          </div>
        )}

        {!result && !savedStyles[activeExpert] && (
          <div className="glass-effect rounded-xl p-8 shadow-soft text-center">
            <p className="text-gray-600 text-lg mb-2">
              {expert.name} 문체가 아직 학습되지 않았습니다
            </p>
            <p className="text-gray-500 text-sm">
              예시글을 {MIN_SAMPLES}개 이상 넣고 분석하면, 이 전문가로 쓰는 글에 문체가 적용됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
