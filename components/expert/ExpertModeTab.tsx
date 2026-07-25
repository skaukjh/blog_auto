'use client';

import { useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ExpertType, WebSearchResult, RecommendationItem, ModelConfig, KeywordItem, PlaceInfo, PlaceReview, ProductInfo } from '@/types';
import { ExpertSelector } from './ExpertSelector';
import { ModelSelector } from './ModelSelector';
import { CreativitySlider } from './CreativitySlider';
import { PlaceReviewSelector } from './PlaceReviewSelector';
import { ProductSearchSection } from './ProductSearchSection';
import ImageUpload from '../form/ImageUpload';
import KeywordInput from '../form/KeywordInput';
import { MAX_SUBHEADINGS, MIN_SUBHEADINGS, SECTION_CHAR_RANGE } from '@/lib/utils/outline';

/** 소제목 입력칸에 돌려 쓰는 예시 문구 (실제 값이 아니라 placeholder입니다) */
const SUBHEADING_PLACEHOLDERS = [
  '예: 위치와 주차',
  '예: 매장 분위기',
  '예: 주문한 메뉴',
  '예: 맛 후기',
  '예: 가격과 가성비',
  '예: 재방문 의사',
  '예: 이런 분께 추천',
  '예: 방문 팁',
  '예: 영업시간',
  '예: 총평',
];

// 동적 임포트: 웹 검색 결과와 추천 목록은 필요할 때만 로드
const WebSearchResults = dynamic(() => import('./WebSearchResults').then(mod => ({ default: mod.WebSearchResults })), {
  loading: () => <p className="text-sm text-gray-500">검색 결과 로딩 중...</p>,
});

const RecommendationsList = dynamic(() => import('./RecommendationsList').then(mod => ({ default: mod.RecommendationsList })), {
  loading: () => <p className="text-sm text-gray-500">추천 항목 로딩 중...</p>,
});

interface ExpertModeTabProps {
  onGenerateWithExpert: (params: {
    expertType: ExpertType;
    modelConfig: ModelConfig;
    webSearchResults?: WebSearchResult[];
    recommendations?: RecommendationItem[];
    placeInfo?: PlaceInfo;
    productInfo?: ProductInfo;
  }) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /**
   * 문체 학습이 끝난 전문가 목록. 조회 중이면 null.
   *
   * 전문가별로 문체가 따로 저장되므로, 학습된 전문가만 글을 쓸 수 있습니다.
   * 하나가 학습됐다고 나머지까지 열리지 않습니다.
   */
  learnedExperts?: Set<string> | null;
  /**
   * 선택된 전문가. 자동 저장·복구 대상이라 부모(generate/page.tsx)가 관리합니다.
   */
  selectedExpert: ExpertType | null;
  onSelectExpert: (expert: ExpertType | null) => void;
  // 필수 입력 필드
  images: File[];
  onImagesChange: (images: File[]) => void; // ImageUpload는 onChange를 사용하지만 여기서는 onImagesChange로 래핑
  /** 글 제목 — 토씨 하나 바꾸지 않고 글의 첫 줄에 그대로 들어갑니다 */
  title: string;
  onTitleChange: (title: string) => void;
  /** 소제목 3~10개 — 순서·표기 그대로 들어가고, 각 소제목 밑에 그 내용이 들어갑니다 */
  subheadings: string[];
  onSubheadingsChange: (subheadings: string[]) => void;
  keywords: KeywordItem[];
  onKeywordsChange: (keywords: KeywordItem[]) => void;
  length: 'short' | 'medium' | 'long';
  onLengthChange: (length: 'short' | 'medium' | 'long') => void;
  /** 사용자가 직접 경험한 내용 (글자 수 제한 없음, AI가 빠짐없이 반영) */
  personalExperience: string;
  onPersonalExperienceChange: (value: string) => void;
  error?: string;
}

export function ExpertModeTab({
  onGenerateWithExpert,
  isLoading = false,
  disabled = false,
  learnedExperts = null,
  selectedExpert,
  onSelectExpert,
  images,
  onImagesChange,
  title,
  onTitleChange,
  subheadings,
  onSubheadingsChange,
  keywords,
  onKeywordsChange,
  length,
  onLengthChange,
  personalExperience,
  onPersonalExperienceChange,
  error,
}: ExpertModeTabProps) {
  // 기본값은 ModelSelector의 '균형형' 프리셋과 같아야 합니다.
  // (이미지 분석은 luna, 본문 생성만 terra — 글당 약 100원)
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    imageAnalysisModel: 'gpt-5.6-luna',
    webSearchModel: 'gpt-5.6-luna',
    contentGenerationModel: 'gpt-5.6-terra',
    creativity: 7,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [webSearchResults, setWebSearchResults] = useState<WebSearchResult[]>([]);
  const [selectedWebResults, setSelectedWebResults] = useState<WebSearchResult[]>([]);
  const [searchErrors, setSearchErrors] = useState<{ naver?: string; google?: string }>({});

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [selectedRecommendations, setSelectedRecommendations] = useState<RecommendationItem[]>([]);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);

  // 맛집 정보 (restaurant 전문가 전용)
  const [placeName, setPlaceName] = useState('');
  const [placeInfo, setPlaceInfo] = useState<PlaceInfo | null>(null);
  const [selectedReviews, setSelectedReviews] = useState<PlaceReview[]>([]);
  const [loadingPlace, setLoadingPlace] = useState(false);

  // 제품 정보 (product 전문가 전용)
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);

  // 웹 검색 (Naver + Google 동시)
  const handleWebSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      alert('검색어를 입력해주세요');
      return;
    }

    setLoadingSearch(true);
    setSearchErrors({});
    try {
      const response = await fetch('/api/search/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          searchEngine: 'both', // 네이버 + 구글 동시 검색
          limit: 5,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setWebSearchResults(data.results);
        setSelectedWebResults([]); // 초기화
        if (data.results.length === 0) {
          alert('검색 결과가 없습니다');
        }
      } else {
        alert('검색 실패: ' + (data.error || '알 수 없는 오류'));
        setSearchErrors({ naver: data.error, google: data.error });
      }
    } catch (error) {
      console.error('Web search error:', error);
      const errorMsg = error instanceof Error ? error.message : '검색 중 오류가 발생했습니다';
      alert(errorMsg);
      setSearchErrors({ naver: errorMsg, google: errorMsg });
    } finally {
      setLoadingSearch(false);
    }
  }, [searchQuery]);

  // 추천 검색
  const handleGetRecommendations = useCallback(async () => {
    if (!selectedExpert) {
      alert('먼저 전문가를 선택해주세요');
      return;
    }

    if (!searchQuery.trim()) {
      alert('검색어를 입력해주세요');
      return;
    }

    setLoadingRec(true);
    try {
      const response = await fetch('/api/search/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          expertType: selectedExpert,
          recommendationType: selectedExpert === 'restaurant' ? 'nearby' :
                             selectedExpert === 'travel' ? 'destination' : 'related',
          limit: 5,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setRecommendations(data.recommendations);
        setSelectedRecommendations([]); // 초기화
      } else {
        alert('추천 검색 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Recommendations error:', error);
      alert('추천 검색 중 오류가 발생했습니다');
    } finally {
      setLoadingRec(false);
    }
  }, [selectedExpert, searchQuery]);

  // 창의성 슬라이더 변경 핸들러
  const handleCreativityChange = useCallback((creativity: number) => {
    setModelConfig(prev => ({ ...prev, creativity }));
  }, []);

  // 소제목 편집 핸들러 —
  // 소제목의 순서가 글의 순서이므로 위/아래 이동을 함께 제공합니다.
  const handleSubheadingChange = useCallback(
    (index: number, value: string) => {
      const next = [...subheadings];
      next[index] = value;
      onSubheadingsChange(next);
    },
    [subheadings, onSubheadingsChange]
  );

  const handleAddSubheading = useCallback(() => {
    if (subheadings.length >= MAX_SUBHEADINGS) return;
    onSubheadingsChange([...subheadings, '']);
  }, [subheadings, onSubheadingsChange]);

  const handleRemoveSubheading = useCallback(
    (index: number) => {
      if (subheadings.length <= MIN_SUBHEADINGS) return;
      onSubheadingsChange(subheadings.filter((_, idx) => idx !== index));
    },
    [subheadings, onSubheadingsChange]
  );

  const handleMoveSubheading = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= subheadings.length) return;
      const next = [...subheadings];
      [next[index], next[target]] = [next[target], next[index]];
      onSubheadingsChange(next);
    },
    [subheadings, onSubheadingsChange]
  );

  /** 실제로 값이 채워진 소제목 (빈 칸은 글에 들어가지 않습니다) */
  const filledSubheadings = subheadings.filter((s) => s.trim().length > 0);
  const sectionCharRange = SECTION_CHAR_RANGE[length];

  // 맛집 정보 검색
  const handlePlaceSearch = useCallback(async () => {
    if (!placeName.trim()) {
      alert('가게 이름을 입력해주세요');
      return;
    }

    setLoadingPlace(true);
    try {
      const response = await fetch(`/api/place/search?name=${encodeURIComponent(placeName)}`);
      const data = await response.json();

      if (data.success) {
        setPlaceInfo(data.placeInfo);
        setSelectedReviews([]); // 초기화
        if (!data.placeInfo.reviews || data.placeInfo.reviews.length === 0) {
          alert('리뷰 정보가 없습니다');
        }
      } else {
        alert(data.error || '가게 정보를 찾을 수 없습니다');
        setPlaceInfo(null);
      }
    } catch (error) {
      console.error('가게 검색 오류:', error);
      alert('가게 정보 조회에 실패했습니다');
      setPlaceInfo(null);
    } finally {
      setLoadingPlace(false);
    }
  }, [placeName]);

  // 선택한 전문가의 문체가 학습돼 있어야 글을 쓸 수 있습니다.
  // 다른 전문가가 학습됐는지는 여기에 영향을 주지 않습니다.
  const selectedExpertLearned =
    !selectedExpert || learnedExperts === null || learnedExperts.has(selectedExpert);

  const canGenerate = selectedExpert && selectedExpertLearned && !disabled && !isLoading;

  return (
    <div className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">❌ 오류</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* 전문가 선택 */}
      <ExpertSelector
        selectedExpert={selectedExpert}
        onSelectExpert={onSelectExpert}
        disabled={disabled || isLoading}
        learnedExperts={learnedExperts}
      />

      {/* 학습된 전문가가 하나도 없을 때만 안내 */}
      {learnedExperts !== null && learnedExperts.size === 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
          <p className="font-semibold text-yellow-900">
            아직 문체를 학습한 전문가가 없습니다
          </p>
          <p className="text-sm text-yellow-800 mt-1">
            <a href="/format" className="underline font-medium">
              문체 학습 페이지
            </a>
            에서 전문가를 하나만 학습해도 그 전문가로는 바로 글을 쓸 수 있습니다.
          </p>
        </div>
      )}

      {selectedExpert && (
        <>
          {/* 필수 입력 필드 */}
          <div className="border-t pt-6 space-y-4">
            {/* 이미지 업로드 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📸 이미지 업로드 <span className="text-red-500">*필수</span></h3>
              <ImageUpload
                images={images}
                onChange={onImagesChange}
              />
              {images.length > 0 && (
                <p className="text-sm text-green-600 mt-2">✓ {images.length}장의 이미지가 업로드되었습니다</p>
              )}
            </div>

            {/* 제목 입력 — 글에 그대로 들어갑니다 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📝 제목 <span className="text-red-500">*필수</span></h3>
              <p className="text-sm text-gray-600 mb-2">
                입력한 제목이 <strong>토씨 하나 바뀌지 않고</strong> 글의 첫 줄에 그대로 들어갑니다.
              </p>
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="예: 성수동 민물장어 무한리필 송림복장어 성수직영점 다녀왔어요"
                disabled={disabled || isLoading}
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">{title.length} / 100</p>
              {title.trim().length > 0 && (
                <p className="text-sm text-green-600 mt-1">✓ 제목이 입력되었습니다</p>
              )}
            </div>

            {/* 소제목 입력 — 순서·표기 그대로 들어가고 각 소제목 밑에 그 내용이 채워집니다 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                🧩 소제목 <span className="text-red-500">*필수 {MIN_SUBHEADINGS}~{MAX_SUBHEADINGS}개</span>
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                소제목도 <strong>그대로</strong> 들어갑니다. 각 소제목 밑에는 <strong>그 소제목에 해당하는 내용만</strong> 쓰여요
                (예: 소제목이 &ldquo;위치&rdquo;면 그 아래는 위치 이야기). 소제목 하나당{' '}
                {sectionCharRange.min}~{sectionCharRange.max}자로 채워집니다.
              </p>

              <div className="space-y-2">
                {subheadings.map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 text-sm text-gray-500 text-right">{idx + 1}.</span>
                    <input
                      type="text"
                      value={sub}
                      onChange={(e) => handleSubheadingChange(idx, e.target.value)}
                      placeholder={SUBHEADING_PLACEHOLDERS[idx % SUBHEADING_PLACEHOLDERS.length]}
                      disabled={disabled || isLoading}
                      maxLength={60}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleMoveSubheading(idx, -1)}
                      disabled={disabled || isLoading || idx === 0}
                      title="위로"
                      className="px-2 py-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSubheading(idx, 1)}
                      disabled={disabled || isLoading || idx === subheadings.length - 1}
                      title="아래로"
                      className="px-2 py-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubheading(idx)}
                      disabled={disabled || isLoading || subheadings.length <= MIN_SUBHEADINGS}
                      title={
                        subheadings.length <= MIN_SUBHEADINGS
                          ? `최소 ${MIN_SUBHEADINGS}개는 있어야 합니다`
                          : '삭제'
                      }
                      className="px-2 py-2 text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSubheading}
                disabled={disabled || isLoading || subheadings.length >= MAX_SUBHEADINGS}
                className="mt-3 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + 소제목 추가 ({subheadings.length} / {MAX_SUBHEADINGS})
              </button>

              {filledSubheadings.length < MIN_SUBHEADINGS ? (
                <p className="text-sm text-orange-600 mt-2">
                  소제목을 {MIN_SUBHEADINGS - filledSubheadings.length}개 더 채워주세요 (현재 {filledSubheadings.length}개)
                </p>
              ) : (
                <p className="text-sm text-green-600 mt-2">
                  ✓ 소제목 {filledSubheadings.length}개 · 전체 약{' '}
                  {(filledSubheadings.length * sectionCharRange.min).toLocaleString()}~
                  {(filledSubheadings.length * sectionCharRange.max).toLocaleString()}자로 쓰여요
                </p>
              )}
            </div>

            {/* 키워드 입력 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">🏷️ 키워드 <span className="text-red-500">*필수</span></h3>
              <KeywordInput
                keywords={keywords}
                onChange={onKeywordsChange}
              />
              {keywords.length > 0 && (
                <p className="text-sm text-green-600 mt-2">✓ {keywords.length}개의 키워드가 입력되었습니다</p>
              )}
            </div>

            {/* 직접 경험한 내용 입력 (글자 수 제한 없음, AI가 빠짐없이 반영) */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                ✍️ 내가 직접 경험한 내용 <span className="text-gray-400 text-sm font-normal">(선택)</span>
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                실제로 겪은 일을 자유롭게 적어주세요. AI가 이 내용을 <strong>빠짐없이</strong> 요약·참고해서 글에 반드시 반영합니다. 글자 수 제한은 없습니다.
              </p>
              <textarea
                value={personalExperience}
                onChange={(e) => onPersonalExperienceChange(e.target.value)}
                placeholder="예: 오픈 시간에 맞춰 갔는데 이미 웨이팅이 5팀이나 있었어요. 시그니처 메뉴인 들기름 막국수를 시켰고, 면이 쫄깃해서 놀랐어요. 사장님이 직접 육수를 설명해주셨고..."
                disabled={disabled || isLoading}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:bg-gray-100 resize-y leading-relaxed"
              />
              <p className="text-xs text-gray-500 mt-1">입력한 글자 수: {personalExperience.length.toLocaleString()}자 (제한 없음)</p>
              {personalExperience.trim().length > 0 && (
                <p className="text-sm text-green-600 mt-1">✓ 이 경험이 글에 빠짐없이 반영됩니다</p>
              )}
            </div>

            {/* 글 길이 선택 — 소제목 하나당 분량으로 정합니다 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📏 소제목당 분량</h3>
              <p className="text-sm text-gray-600 mb-3">
                전체 길이는 <strong>소제목 개수 × 소제목당 분량</strong>으로 결정됩니다.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'short', label: '짧게' },
                  { value: 'medium', label: '보통' },
                  { value: 'long', label: '길게' },
                ] as const).map((opt) => ({
                  ...opt,
                  desc: `소제목당 ${SECTION_CHAR_RANGE[opt.value].min}-${SECTION_CHAR_RANGE[opt.value].max}자`,
                })).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onLengthChange(opt.value as 'short' | 'medium' | 'long')}
                    disabled={disabled || isLoading}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      length === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-primary'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
              {/* 전체 글 분량 — 소제목 개수 × 소제목당 분량으로 결정됩니다 */}
              <div className="mt-3 p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                <p className="text-sm text-gray-600">📐 전체 글 분량</p>
                {filledSubheadings.length > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-primary mt-1">
                      약 {(filledSubheadings.length * sectionCharRange.min).toLocaleString()}~
                      {(filledSubheadings.length * sectionCharRange.max).toLocaleString()}자
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      소제목 {filledSubheadings.length}개 × 소제목당 {sectionCharRange.min}~
                      {sectionCharRange.max}자
                      {filledSubheadings.length < MIN_SUBHEADINGS &&
                        ` (소제목 ${MIN_SUBHEADINGS}개 이상 필요)`}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      더 긴 글을 원하시면 소제목을 늘리거나 위에서 &lsquo;길게&rsquo;를 선택하세요.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    소제목을 입력하면 전체 분량이 계산됩니다 (소제목 개수 × {sectionCharRange.min}~
                    {sectionCharRange.max}자)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 모델 설정 */}
          <div className="border-t pt-6">
            <ModelSelector
              modelConfig={modelConfig}
              onUpdateModelConfig={setModelConfig}
              disabled={disabled || isLoading}
            />
          </div>

          {/* 창의성 조절 */}
          <div className="border-t pt-6">
            <CreativitySlider
              creativity={modelConfig.creativity}
              onChangeCreativity={(creativity) =>
                setModelConfig({ ...modelConfig, creativity })
              }
              disabled={disabled || isLoading}
            />
          </div>

          {/* 웹 검색 */}
          <div className="border-t pt-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">🔍 웹 검색 (선택) - 네이버 + 구글 동시 검색</h3>
              <div className="space-y-3">
                {/* 검색어 입력 */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색어를 입력하세요..."
                    disabled={disabled || isLoading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleWebSearch();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded disabled:opacity-50"
                  />

                  {/* 검색 버튼 */}
                  <button
                    onClick={handleWebSearch}
                    disabled={disabled || isLoading || loadingSearch || !searchQuery.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loadingSearch ? '검색중...' : '검색'}
                  </button>
                </div>

                {/* 검색 엔진 안내 */}
                <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                  📌 네이버와 구글에서 동시에 검색합니다. 검색 결과는 중복 제거 후 표시됩니다.
                </div>

                {/* 검색 에러 표시 */}
                {(searchErrors.naver || searchErrors.google) && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm font-semibold text-red-700 mb-1">⚠️ 검색 중 문제 발생:</p>
                    {searchErrors.naver && <p className="text-xs text-red-600">🔹 네이버: {searchErrors.naver}</p>}
                    {searchErrors.google && <p className="text-xs text-red-600">🔹 구글: {searchErrors.google}</p>}
                  </div>
                )}

                {/* 웹 검색 결과 */}
                {webSearchResults.length > 0 && (
                  <WebSearchResults
                    results={webSearchResults}
                    selectedResults={selectedWebResults}
                    onSelectResults={setSelectedWebResults}
                    isLoading={loadingSearch}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 추천 검색 */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-3">⭐ 추천 검색 (선택)</h3>

            <button
              onClick={handleGetRecommendations}
              disabled={disabled || isLoading || loadingRec || !searchQuery.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loadingRec ? '검색중...' : '추천 항목 검색'}
            </button>

            {/* 추천 결과 */}
            {recommendations.length > 0 && (
              <div className="mt-4">
                <RecommendationsList
                  recommendations={recommendations}
                  selectedRecommendations={selectedRecommendations}
                  onSelectRecommendations={setSelectedRecommendations}
                  expertType={selectedExpert}
                />
              </div>
            )}
          </div>

          {/* 맛집 정보 (restaurant 전문가 전용) */}
          {selectedExpert === 'restaurant' && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-3">🍽️ 맛집 정보 조회 (선택)</h3>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={placeName}
                  onChange={(e) => setPlaceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePlaceSearch()}
                  placeholder="상호명을 입력하세요 (예: 원조해장촌 뼈구이한판 감자탕 선릉역점)"
                  disabled={disabled || isLoading || loadingPlace}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
                />
                <button
                  onClick={handlePlaceSearch}
                  disabled={disabled || isLoading || loadingPlace || !placeName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {loadingPlace ? '검색 중...' : '검색'}
                </button>
              </div>

              {placeInfo && (
                <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold text-lg">{placeInfo.name}</h4>
                  {placeInfo.address && <p className="text-sm text-gray-600 mt-2">📍 {placeInfo.address}</p>}
                  {placeInfo.phone && <p className="text-sm text-gray-600">📞 {placeInfo.phone}</p>}
                  {placeInfo.rating && <p className="text-sm text-gray-600">⭐ {placeInfo.rating} / 5.0</p>}
                  {placeInfo.openingHours && placeInfo.openingHours.length > 0 && (
                    <div className="text-sm text-gray-600 mt-2">
                      <p>⏰ {placeInfo.openingHours[0]}</p>
                      {placeInfo.openingHours.slice(1).map((hours, idx) => (
                        <p key={idx}>{hours}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {placeInfo?.reviews && placeInfo.reviews.length > 0 && (
                <div className="mt-4">
                  <Suspense fallback={<p className="text-sm text-gray-500">리뷰 로딩 중...</p>}>
                    <PlaceReviewSelector
                      reviews={placeInfo.reviews}
                      selectedReviews={selectedReviews}
                      onSelectReviews={setSelectedReviews}
                      isLoading={loadingPlace}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {/* 제품 정보 (product 전문가 전용) */}
          {selectedExpert === 'product' && (
            <div className="border-t pt-6">
              <ProductSearchSection
                productInfo={productInfo}
                onProductSelect={setProductInfo}
              />
            </div>
          )}

          {/* 생성 버튼 */}
          <div className="border-t pt-6">
            <button
              onClick={() => {
                onGenerateWithExpert({
                  expertType: selectedExpert!,
                  modelConfig,
                  webSearchResults: selectedWebResults.length > 0 ? selectedWebResults : undefined,
                  recommendations: selectedRecommendations.length > 0 ? selectedRecommendations : undefined,
                  placeInfo: placeInfo ? {
                    ...placeInfo,
                    reviews: selectedReviews.length > 0 ? selectedReviews : undefined
                  } : undefined,
                  productInfo: productInfo ?? undefined,
                });
              }}
              disabled={!canGenerate}
              className="w-full px-4 py-3 bg-purple-600 text-white text-lg font-semibold rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '생성 중...' : '✨ 전문가 모드로 글 생성'}
            </button>

            {selectedRecommendations.length > 0 || selectedWebResults.length > 0 || selectedReviews.length > 0 ? (
              <p className="text-sm text-green-600 mt-2">
                ✓ {selectedWebResults.length}개 검색 결과 + {selectedRecommendations.length}개 추천 항목 + {selectedReviews.length}개 리뷰 적용됨
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                웹 검색 결과, 추천 항목, 맛집 리뷰를 선택하면 글에 자동으로 반영됩니다.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
