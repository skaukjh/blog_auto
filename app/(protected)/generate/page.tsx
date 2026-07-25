'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Navigation from '@/components/layout/Navigation';
import { Sparkles, Copy, Download, AlertCircle, ChevronDown, Check, X } from 'lucide-react';
import type { KeywordItem, ImageAnalysisResult, ChatMessage, ExpertType, ModelConfig, WebSearchResult, RecommendationItem, PlaceInfo, ProductInfo } from '@/types/index';
import { generateClientImageGuides } from '@/lib/utils/client-image-guide';
import { EXPERT_LIST } from '@/lib/experts/definitions';
import { copyToClipboard, triggerDownload } from '@/lib/utils/download';
import { MIN_SUBHEADINGS } from '@/lib/utils/outline';
import {
  saveDraft,
  loadDraft,
  clearDraft,
  saveResult,
  loadResult,
  type StoredDraft,
  type StoredResult,
} from '@/lib/utils/draft-storage';

// 동적 임포트: ExpertModeTab 및 자식 컴포넌트를 별도 청크로 분리
const ExpertModeTab = dynamic(() => import('@/components/expert/ExpertModeTab').then(mod => ({ default: mod.ExpertModeTab })), {
  loading: () => <div className="p-6 text-center text-gray-500">⭐ 전문가 모드 로딩 중...</div>,
  ssr: true,
});

/** 화면에 띄우는 생성 결과 */
interface GenerationResult {
  content: string;
  imageAnalysis: ImageAnalysisResult;
  wordCount: number;
  keywordCounts: Record<string, number>;
  cost?: {
    usd: number;
    krw: number;
    breakdown?: {
      imageAnalysis: { usd: number; krw: number };
      contentGeneration: { usd: number; krw: number };
    };
  };
  /** 그대로 들어가야 했는데 글에서 찾지 못한 소제목 */
  missingSubheadings?: string[];
}

export default function GeneratePage() {
  // 제목과 소제목은 토씨 하나 바꾸지 않고 글에 그대로 들어갑니다.
  // (기존 '주제' 입력은 2026-07-25 사용자 요청으로 제거하고 제목이 그 역할을 겸합니다)
  const [title, setTitle] = useState('');
  const [subheadings, setSubheadings] = useState<string[]>(
    Array.from({ length: MIN_SUBHEADINGS }, () => '')
  );
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  // 선택한 전문가도 복구 대상이라 여기서 관리합니다 (과거에는 ExpertModeTab 내부 상태였습니다)
  const [selectedExpert, setSelectedExpert] = useState<ExpertType | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [startSentence, setStartSentence] = useState('');
  const [endSentence, setEndSentence] = useState('');
  // 사용자가 직접 경험한 내용 (글자 수 제한 없음, AI가 빠짐없이 반영)
  const [personalExperience, setPersonalExperience] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  /** 복구 가능한 이전 작업 (초안 / 직전 생성 글) */
  const [recoverable, setRecoverable] = useState<{
    draft: StoredDraft | null;
    result: StoredResult | null;
  }>({ draft: null, result: null });
  /** 초안 자동 저장이 마지막으로 성공한 시각 */
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  /** 문체 학습이 끝난 전문가 목록. null이면 조회 실패(잠그지 않음) */
  const [learnedExperts, setLearnedExperts] = useState<Set<string> | null>(null);
  const [styleChecked, setStyleChecked] = useState(false);
  const [showSeoDetails, setShowSeoDetails] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [imageAnalysisResult, setImageAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 초기 로드 시 전문가별 문체 학습 현황을 조회합니다.
  //
  // 전문가마다 문체가 따로 저장되므로 "전부 학습돼야 열린다"가 아니라
  // 학습된 전문가만 개별적으로 열립니다.
  useEffect(() => {
    const loadLearnedExperts = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('/api/blog/get-current-style?all=true', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.styles) {
            // 'common'은 전문가가 아니라 폴백용이므로 목록에서 제외합니다.
            const learned = Object.keys(data.styles).filter((scope) => scope !== 'common');
            setLearnedExperts(new Set(learned));
            return;
          }
        }
        setLearnedExperts(new Set());
      } catch (err) {
        console.warn('전문가별 문체 현황 조회 실패:', err);
        // 조회에 실패했다고 글쓰기를 막지는 않습니다.
        setLearnedExperts(null);
      } finally {
        setStyleChecked(true);
      }
    };

    loadLearnedExperts();
  }, []);

  // 이전에 하던 작업이 남아 있는지 확인합니다.
  //
  // 실수로 창을 닫거나 다른 페이지로 이동하면 사진·제목·소제목·경험글이 전부
  // 사라졌고, 돈을 들여 만든 글도 되살릴 방법이 없었습니다. 이제는 IndexedDB에
  // 자동 저장해 두고 여기서 복구 배너로 알려줍니다.
  useEffect(() => {
    const checkRecoverable = async () => {
      const [draft, saved] = await Promise.all([loadDraft(), loadResult()]);
      if (!draft && !saved) return;

      const draftHasContent =
        !!draft &&
        (draft.title.trim().length > 0 ||
          draft.subheadings.some((s) => s.trim().length > 0) ||
          draft.keywords.length > 0 ||
          draft.personalExperience.trim().length > 0 ||
          draft.images.length > 0);

      setRecoverable({ draft: draftHasContent ? draft : null, result: saved });
    };

    checkRecoverable();
  }, []);

  /** 입력한 것이 하나라도 있는지 (빈 초안을 저장해 배너가 뜨는 것을 막습니다) */
  const hasAnyInput =
    title.trim().length > 0 ||
    subheadings.some((s) => s.trim().length > 0) ||
    keywords.length > 0 ||
    personalExperience.trim().length > 0 ||
    images.length > 0;

  // 입력값을 자동 저장합니다. 타이핑마다 쓰지 않도록 1초 디바운스를 둡니다.
  useEffect(() => {
    if (!hasAnyInput) return;

    const timer = setTimeout(async () => {
      const ok = await saveDraft({
        title,
        subheadings,
        keywords,
        length,
        personalExperience,
        images,
        expertType: selectedExpert,
      });
      if (ok) setDraftSavedAt(new Date().toISOString());
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    hasAnyInput,
    title,
    subheadings,
    keywords,
    length,
    personalExperience,
    images,
    selectedExpert,
  ]);

  /** 저장된 초안을 현재 화면으로 되살립니다 */
  const handleRestoreDraft = useCallback(() => {
    const draft = recoverable.draft;
    if (!draft) return;

    setTitle(draft.title);
    setSubheadings(
      draft.subheadings.length >= MIN_SUBHEADINGS
        ? draft.subheadings
        : [
            ...draft.subheadings,
            ...Array.from({ length: MIN_SUBHEADINGS - draft.subheadings.length }, () => ''),
          ]
    );
    setKeywords(draft.keywords);
    setLength(draft.length);
    setPersonalExperience(draft.personalExperience);
    setImages(draft.images);
    setSelectedExpert(draft.expertType);
    setRecoverable((prev) => ({ ...prev, draft: null }));
    setError('');
  }, [recoverable.draft]);

  /** 저장해 둔 직전 생성 글을 다시 화면에 띄웁니다 (다운로드·복사 가능) */
  const handleRestoreResult = useCallback(() => {
    const saved = recoverable.result;
    if (!saved) return;

    setResult({
      content: saved.content,
      imageAnalysis: saved.imageAnalysis,
      wordCount: saved.wordCount,
      keywordCounts: saved.keywordCounts,
      cost: saved.cost,
      missingSubheadings: saved.missingSubheadings,
    });
    setImageAnalysisResult(saved.imageAnalysis);
    if (saved.title) setTitle(saved.title);
    setChatHistory([]);
  }, [recoverable.result]);

  /**
   * 복구를 포기하고 저장된 초안을 지웁니다.
   *
   * 저장된 생성 결과는 지우지 않습니다. 돈이 들어간 글을 실수로 날리지 않도록,
   * 그건 다음 생성 때 자동으로 덮어써지게만 둡니다.
   */
  const handleDiscardRecovery = useCallback(async () => {
    await clearDraft();
    setRecoverable((prev) => ({ ...prev, draft: null }));
  }, []);

  // 클라이언트 사이드 이미지 압축 함수 (메모리 누수 방지)
  const compressImage = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // 최대 1280px로 리사이징
            const maxSize = 1280;
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas context를 얻을 수 없습니다'));
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // JPEG로 변환하여 압축 (품질 75%)
            const compressedData = canvas.toDataURL('image/jpeg', 0.75);

            // ✅ 메모리 정리
            canvas.width = 0;
            canvas.height = 0;
            img.src = '';

            resolve(compressedData);
          } catch (error) {
            reject(error instanceof Error ? error : new Error('이미지 압축 실패'));
          }
        };
        img.onerror = () => {
          img.src = ''; // 정리
          reject(new Error('이미지 로드 실패'));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('파일 읽기 실패'));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Phase 20: 전문가 모드 글 생성
  const handleGenerateExpert = useCallback(async (params: {
    expertType: ExpertType;
    modelConfig: ModelConfig;
    webSearchResults?: WebSearchResult[];
    recommendations?: RecommendationItem[];
    placeInfo?: PlaceInfo;
    productInfo?: ProductInfo;
  }) => {
    if (!images.length) {
      setError('이미지를 최소 1장 이상 업로드해주세요');
      return;
    }
    if (!title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }

    // 빈 칸은 글에 넣지 않습니다. 채워진 소제목만 골라 개수를 확인합니다.
    const filledSubheadings = subheadings.map((s) => s.trim()).filter(Boolean);
    if (filledSubheadings.length < MIN_SUBHEADINGS) {
      setError(`소제목을 최소 ${MIN_SUBHEADINGS}개 입력해주세요 (현재 ${filledSubheadings.length}개)`);
      return;
    }

    if (!keywords.length) {
      setError('키워드를 최소 1개 이상 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. 이미지 압축
      const compressedImages: string[] = [];
      for (const file of images) {
        const base64 = await compressImage(file);
        compressedImages.push(base64);
      }

      // 2. 전문가별 이미지 분석
      const analyzeResponse = await fetch('/api/generate/analyze-images-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: compressedImages,
          // 이미지 분석에서 "이 사진들이 무슨 글에 쓰이는지"를 알려주는 값입니다.
          topic: title,
          expertType: params.expertType,
          modelConfig: params.modelConfig,
        }),
      });

      const analyzeText = await analyzeResponse.text();
      const imageData = JSON.parse(analyzeText);

      if (!imageData.success) {
        throw new Error(imageData.error || '이미지 분석 실패');
      }

      // 3. 전문가 콘텐츠 생성
      const generateResponse = await fetch('/api/generate/create-content-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subheadings: filledSubheadings,
          length,
          keywords,
          imageAnalysis: imageData.analysis,
          expertType: params.expertType,
          modelConfig: params.modelConfig,
          webSearchResults: params.webSearchResults,
          recommendations: params.recommendations,
          startSentence,
          endSentence,
          placeInfo: params.placeInfo,
          personalExperience,
        }),
      });

      const contentText = await generateResponse.text();
      const contentData = JSON.parse(contentText);

      if (!contentData.success) {
        throw new Error(contentData.error || '콘텐츠 생성 실패');
      }

      const generated: GenerationResult = {
        content: contentData.content.content,
        imageAnalysis: imageData.analysis,
        wordCount: contentData.content.wordCount,
        keywordCounts: contentData.content.keywordCounts,
        cost: contentData.cost,
        missingSubheadings: contentData.content.missingSubheadings,
      };

      setResult(generated);
      setImageAnalysisResult(imageData.analysis);
      setChatHistory([]);
      setRefineInput('');
      setError('');

      // 돈이 들어간 결과물이라 즉시 저장합니다. 이후 창을 닫아도 다시 열어
      // 내용을 확인하고 다운로드할 수 있습니다.
      await saveResult({ ...generated, title });
      setRecoverable((prev) => ({ ...prev, result: null }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [images, title, subheadings, keywords, length, startSentence, endSentence, personalExperience, compressImage]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!result) return;

    setCopyStatus('idle');
    try {
      const success = await copyToClipboard(result.content);
      if (success) {
        setCopyStatus('success');
        setTimeout(() => setCopyStatus('idle'), 2000);
      } else {
        throw new Error('클립보드 복사에 실패했습니다');
      }
    } catch (error) {
      console.error('클립보드 복사 에러:', error);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  }, [result]);

  const handleRefineContent = useCallback(async () => {
    if (!refineInput.trim() || !result || !imageAnalysisResult) return;

    setIsRefining(true);
    const userMessage: ChatMessage = {
      role: 'user',
      content: refineInput,
      timestamp: new Date().toISOString(),
    };

    setChatHistory((prev) => [...prev, userMessage]);
    const requestText = refineInput;
    setRefineInput('');

    try {
      const response = await fetch('/api/generate/refine-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentContent: result.content,
          userRequest: requestText,
          keywords: keywords,
          imageAnalysis: imageAnalysisResult,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '수정에 실패했습니다');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.refinedContent,
        timestamp: new Date().toISOString(),
      };

      setChatHistory((prev) => [...prev, assistantMessage]);

      // 결과 업데이트 (저장본도 함께 갱신해 창을 닫아도 수정된 글이 남게 합니다)
      const updated: GenerationResult = {
        ...result,
        content: data.refinedContent,
      };
      setResult(updated);
      await saveResult({ ...updated, title });

      console.log('✅ 콘텐츠가 수정되었습니다');
      console.log('수정된 콘텐츠 길이:', data.refinedContent.length);
    } catch (error) {
      console.error('수정 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '수정 중 오류가 발생했습니다';

      // 에러 메시지를 대화 히스토리에 추가
      const errorMessage2 = `오류: ${errorMessage}`;
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: errorMessage2,
        timestamp: new Date().toISOString(),
      };
      setChatHistory((prev) => [...prev, assistantMessage]);
    } finally {
      setIsRefining(false);
    }
  }, [refineInput, result, imageAnalysisResult, keywords, title]);

  // 이미지 가이드 메모이제이션 (계산 비용이 높은 연산)
  const imageGuides = useMemo(() =>
    result ? generateClientImageGuides(result.content, result.imageAnalysis) : [],
    [result]
  );

  // TXT 다운로드 ([IMAGE_N] 마커 포함 - 블로그에 붙여넣을 때 이미지 위치 참고용)
  const handleDownload = useCallback(() => {
    if (!result) return;

    triggerDownload(
      {
        content: result.content,
        imageGuides,
        wordCount: result.wordCount,
        keywordCounts: result.keywordCounts,
      },
      'txt',
      title
    );
  }, [result, imageGuides, title]);

  return (
    <div className="min-h-screen">
      <Navigation />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-5xl font-bold gradient-text">블로그 글 생성</h1>
          </div>
          <p className="text-lg text-gray-600 font-light">
            AI를 활용하여 파워 블로거 스타일의 블로그 글을 자동으로 생성합니다
          </p>

          </div>

        {/* 이전 작업 복구 안내 —
            실수로 창을 닫거나 이동해도 입력값과 생성된 글이 여기서 되살아납니다 */}
        {(recoverable.draft || (recoverable.result && !result)) && (
          <div className="mb-8 p-4 rounded-lg border-2 border-blue-300 bg-blue-50">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💾</div>
              <div className="flex-1">
                <p className="font-semibold text-blue-900">이전에 하던 작업이 남아 있습니다</p>

                {recoverable.draft && (
                  <div className="mt-2">
                    <p className="text-sm text-blue-800">
                      입력 내용
                      {recoverable.draft.title && ` · 제목 "${recoverable.draft.title}"`}
                      {recoverable.draft.images.length > 0 &&
                        ` · 사진 ${recoverable.draft.images.length}장`}
                      {recoverable.draft.subheadings.filter((s) => s.trim()).length > 0 &&
                        ` · 소제목 ${recoverable.draft.subheadings.filter((s) => s.trim()).length}개`}
                      {recoverable.draft.savedAt &&
                        ` (${new Date(recoverable.draft.savedAt).toLocaleString('ko-KR')} 저장)`}
                    </p>
                    <button
                      onClick={handleRestoreDraft}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                    >
                      입력 내용 되살리기
                    </button>
                  </div>
                )}

                {recoverable.result && !result && (
                  <div className="mt-3">
                    <p className="text-sm text-blue-800">
                      직전에 생성된 글 ({recoverable.result.wordCount.toLocaleString()}자
                      {recoverable.result.savedAt &&
                        `, ${new Date(recoverable.result.savedAt).toLocaleString('ko-KR')}`}
                      )
                    </p>
                    <button
                      onClick={handleRestoreResult}
                      className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
                    >
                      생성된 글 다시 보기 (다운로드 가능)
                    </button>
                  </div>
                )}

                <button
                  onClick={handleDiscardRecovery}
                  className="mt-3 text-xs text-blue-700 underline hover:text-blue-900"
                >
                  새로 시작하기 (저장된 입력 삭제)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 전문가별 문체 학습 현황 */}
        {styleChecked && learnedExperts !== null && (
          <div
            className={`mb-8 p-4 rounded-lg border-2 ${
              learnedExperts.size > 0
                ? 'bg-green-50 border-green-300'
                : 'bg-yellow-50 border-yellow-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {learnedExperts.size > 0 ? (
                <>
                  <div className="text-2xl">✅</div>
                  <div className="flex-1">
                    <p className="font-semibold text-green-900">
                      문체 학습된 전문가 {learnedExperts.size} / {EXPERT_LIST.length}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      {EXPERT_LIST.filter((e) => learnedExperts.has(e.type))
                        .map((e) => `${e.icon} ${e.name}`)
                        .join(', ')}
                      {' '}로 글을 쓸 수 있습니다. 각 전문가는 자기 문체만 참고합니다.
                    </p>
                    {learnedExperts.size < EXPERT_LIST.length && (
                      <p className="text-xs text-green-700 mt-1">
                        나머지 전문가는{' '}
                        <a href="/format" className="underline font-medium">
                          문체 학습 페이지
                        </a>
                        에서 각각 학습하면 열립니다.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900">
                      아직 문체를 학습한 전문가가 없습니다
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      <a
                        href="/format"
                        className="underline font-medium hover:text-yellow-900"
                      >
                        문체 학습 페이지
                      </a>
                      에서 전문가 하나만 학습해도 그 전문가로는 바로 글을 쓸 수 있습니다.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {result ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center glass-effect rounded-xl p-6 shadow-soft">
              <div>
                <h2 className="text-3xl font-bold gradient-text">✨ 생성 완료!</h2>
                <p className="text-gray-600 mt-1">고품질 블로그 글이 준비되었습니다</p>
              </div>
              <button
                onClick={() => setResult(null)}
                className="px-6 py-3 bg-gradient-primary text-white rounded-lg hover:shadow-lg smooth-transition font-semibold"
              >
                🔄 다시 생성
              </button>
            </div>

            {(() => {
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft">
                      <p className="text-sm text-gray-600 font-light mb-2">글자 수</p>
                      <p className="text-4xl font-bold gradient-text">{result.wordCount.toLocaleString()}</p>
                    </div>
                    <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft">
                      <p className="text-sm text-gray-600 font-light mb-2">이미지 개수</p>
                      <p className="text-4xl font-bold text-accent">{imageGuides.length}</p>
                    </div>
                    <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft">
                      <p className="text-sm text-gray-600 font-light mb-2">키워드 포함</p>
                      <p className="text-4xl font-bold text-primary">
                        {Object.values(result.keywordCounts).reduce((a: number, b: unknown) => a + (b as number), 0)}회
                      </p>
                    </div>
                  </div>

                  {result.cost && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft border-l-4 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50">
                        <p className="text-sm text-orange-700 font-light mb-2">💸 생성 비용 (총)</p>
                        <p className="text-3xl font-bold text-orange-600">{result.cost.krw.toLocaleString()}₩</p>
                        <p className="text-xs text-orange-600 mt-1">${result.cost.usd.toFixed(4)}</p>
                      </div>
                      {result.cost.breakdown && (
                        <>
                          <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft bg-gradient-to-br from-blue-50 to-cyan-50">
                            <p className="text-sm text-blue-700 font-light mb-2">🔍 이미지 분석</p>
                            <p className="text-2xl font-bold text-blue-600">{result.cost.breakdown.imageAnalysis.krw.toLocaleString()}₩</p>
                            <p className="text-xs text-blue-600 mt-1">${result.cost.breakdown.imageAnalysis.usd.toFixed(4)}</p>
                          </div>
                          <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft bg-gradient-to-br from-green-50 to-emerald-50">
                            <p className="text-sm text-green-700 font-light mb-2">✨ 글 생성</p>
                            <p className="text-2xl font-bold text-green-600">{result.cost.breakdown.contentGeneration.krw.toLocaleString()}₩</p>
                            <p className="text-xs text-green-600 mt-1">${result.cost.breakdown.contentGeneration.usd.toFixed(4)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 제목·소제목은 그대로 들어가야 하므로, 못 들어간 것이 있으면 알려줍니다 */}
            {result.missingSubheadings && result.missingSubheadings.length > 0 && (
              <div className="p-4 rounded-lg border-2 border-orange-300 bg-orange-50">
                <p className="font-semibold text-orange-900">
                  ⚠️ 소제목 {result.missingSubheadings.length}개가 그대로 들어가지 않았습니다
                </p>
                <ul className="mt-2 space-y-1 text-sm text-orange-800">
                  {result.missingSubheadings.map((sub, idx) => (
                    <li key={idx}>· {sub}</li>
                  ))}
                </ul>
                <p className="text-xs text-orange-700 mt-2">
                  아래 &ldquo;부분 수정 요청&rdquo;으로 넣어달라고 요청하거나, 다시 생성해 보세요.
                </p>
              </div>
            )}

            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <div className="whitespace-pre-wrap text-gray-800 text-base leading-relaxed font-light">
                {result.content}
              </div>
            </div>

            {/* 부분 수정 기능 */}
            <div className="glass-effect rounded-xl p-8 shadow-soft mb-6">
              <h3 className="text-xl font-bold gradient-text mb-4">💬 부분 수정 요청</h3>
              <p className="text-sm text-gray-600 mb-4">
                수정하고 싶은 부분을 자연스럽게 요청하세요. 예: "두 번째 단락을 더 자세하게 써줘", "가격 정보를 추가해줘"
              </p>

              {/* 채팅 히스토리 */}
              {chatHistory.length > 0 && (
                <div className="mb-4 space-y-2 max-h-60 overflow-y-auto">
                  {chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-green-50 border border-green-200'
                      }`}
                    >
                      <p className="text-xs text-gray-500 mb-1">
                        {msg.role === 'user' ? '사용자' : 'AI'} • {new Date(msg.timestamp).toLocaleTimeString('ko-KR')}
                      </p>
                      <p className="text-sm text-gray-800">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 입력 폼 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  placeholder="수정 요청을 입력하세요..."
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary smooth-transition text-gray-800"
                  disabled={isRefining}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleRefineContent();
                    }
                  }}
                />
                <button
                  onClick={handleRefineContent}
                  disabled={!refineInput.trim() || isRefining}
                  className="px-6 py-3 gradient-primary text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold smooth-transition"
                >
                  {isRefining ? '수정 중...' : '수정'}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopyToClipboard}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl smooth-transition ${
                  copyStatus === 'success'
                    ? 'bg-green-500 text-white'
                    : copyStatus === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white hover:from-orange-500 hover:via-amber-500 hover:to-yellow-500'
                }`}
              >
                {copyStatus === 'success' ? (
                  <>
                    <Check className="w-5 h-5" />
                    복사 완료!
                  </>
                ) : copyStatus === 'error' ? (
                  <>
                    <X className="w-5 h-5" />
                    복사 실패
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    클립보드에 복사
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                title="[IMAGE_N] 마커가 포함된 TXT 파일로 저장합니다"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 rounded-xl hover:from-orange-200 hover:to-amber-200 smooth-transition font-semibold"
              >
                <Download className="w-5 h-5" />
                TXT 다운로드
              </button>
            </div>

            {/* 네이버 블로그 SEO 최적화 설명 */}
            <div className="glass-effect rounded-xl p-6 shadow-soft border border-orange-100">
              <button
                onClick={() => setShowSeoDetails(!showSeoDetails)}
                className="w-full flex items-center justify-between hover:bg-orange-50/50 p-2 rounded-lg transition-colors"
              >
                <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                  🎯 네이버 블로그 노출 최적화 가이드
                </h3>
                <ChevronDown
                  className={`w-5 h-5 text-orange-600 transition-transform ${
                    showSeoDetails ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showSeoDetails && (
                <div className="mt-4 pt-4 border-t border-orange-100 space-y-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-orange-800 flex items-center gap-2">
                      ✅ 이 글에서 적용된 최적화 기법
                    </h4>
                    <ul className="space-y-2 text-sm text-orange-700">
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>첫 문장 키워드 포함</strong>: 포스트 상단에 주요 검색어를 자연스럽게 배치하여 검색 봇 크롤링 최적화
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>키워드 균등 분포</strong>: 포스트 전체에 검색어를 고르게 배치하여 부자연스러움 제거
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>적절한 글 길이</strong>: 2000-3000자의 상세한 콘텐츠로 네이버의 품질 기준 충족
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>명확한 구조</strong>: 도입-본문-결론의 논리적 구조로 가독성과 SEO 점수 향상
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>자연스러운 말투</strong>: AI 특유의 패턴 제거로 사용자 신뢰도와 참여율 증가
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>실용적 정보</strong>: 위치, 가격, 메뉴 등 독자가 찾는 정보 포함으로 검색 의도 충족
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>이미지 최적 배치</strong>: 텍스트와 이미지의 조화로 시각적 매력 향상 및 체류 시간 증가
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-xs text-orange-700">
                      💡 <strong>팁</strong>: 글을 네이버 블로그에 올린 후 수동으로 검색 등록 신청(설정 → 검색 설정)을 하면 더 빠르게 노출될 수 있습니다.
                      또한 댓글과 공감 수가 많을수록 검색 순위가 올라갑니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 자동 저장 표시 — 창이 닫혀도 남는다는 것을 알 수 있게 합니다 */}
            {draftSavedAt && (
              <p className="mb-3 text-xs text-gray-500">
                💾 자동 저장됨 ({new Date(draftSavedAt).toLocaleTimeString('ko-KR')}) · 창을 닫아도
                입력 내용이 남습니다
              </p>
            )}
            <ExpertModeTab
              onGenerateWithExpert={handleGenerateExpert}
              isLoading={loading}
              learnedExperts={learnedExperts}
              selectedExpert={selectedExpert}
              onSelectExpert={setSelectedExpert}
              images={images}
              onImagesChange={setImages}
              title={title}
              onTitleChange={setTitle}
              subheadings={subheadings}
              onSubheadingsChange={setSubheadings}
              keywords={keywords}
              onKeywordsChange={setKeywords}
              length={length}
              onLengthChange={setLength}
              personalExperience={personalExperience}
              onPersonalExperienceChange={setPersonalExperience}
              error={error}
            />
          </>
        )}

      </div>
    </div>
  );
}
