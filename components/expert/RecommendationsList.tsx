'use client';

import React, { useState } from 'react';
import { RecommendationItem, ExpertType } from '@/types';

interface RecommendationsListProps {
  recommendations: RecommendationItem[];
  selectedRecommendations: RecommendationItem[];
  onSelectRecommendations: (items: RecommendationItem[]) => void;
  expertType: ExpertType | null;
}

const TYPE_LABELS: Record<string, string> = {
  restaurant: '음식점',
  product: '제품',
  place: '장소',
  dish: '요리',
};

export const RecommendationsList = React.memo(function RecommendationsList({
  recommendations,
  selectedRecommendations,
  onSelectRecommendations,
  expertType,
}: RecommendationsListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleRecommendation = (rec: RecommendationItem) => {
    const isSelected = selectedRecommendations.some((r) => r.title === rec.title);

    if (isSelected) {
      onSelectRecommendations(selectedRecommendations.filter((r) => r.title !== rec.title));
    } else {
      onSelectRecommendations([...selectedRecommendations, rec]);
    }
  };

  if (recommendations.length === 0) {
    return null;
  }

  const recommendationType = expertType === 'travel' ? '관광지/맛집' : '추천 아이템';

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">⭐ {recommendationType} ({recommendations.length}개)</h4>
        <span className="text-sm text-gray-600">
          선택됨: {selectedRecommendations.length}개
        </span>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {recommendations.map((rec, idx) => {
          const isSelected = selectedRecommendations.some((r) => r.title === rec.title);
          const typeLabel = TYPE_LABELS[rec.type] || rec.type;

          return (
            <div
              key={`${rec.title}-${idx}`}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleRecommendation(rec)}
            >
              <div className="flex items-start gap-3">
                {/* 체크박스 */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleRecommendation(rec)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1"
                />

                {/* 콘텐츠 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="font-medium text-sm line-clamp-1">{rec.title}</h5>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded flex-shrink-0">
                      {typeLabel}
                    </span>
                  </div>

                  {/* 설명 */}
                  <p
                    className={`text-sm text-gray-600 mt-1 ${
                      expandedIndex === idx ? '' : 'line-clamp-2'
                    }`}
                  >
                    {rec.description}
                  </p>

                  {/* 추가 정보 */}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                    {rec.rating && (
                      <span className="bg-yellow-50 px-2 py-1 rounded">
                        ⭐ {rec.rating.toFixed(1)}
                      </span>
                    )}
                    {rec.address && (
                      <span className="bg-blue-50 px-2 py-1 rounded truncate">
                        📍 {rec.address}
                      </span>
                    )}
                  </div>

                  {/* 더보기 버튼 */}
                  {rec.description.length > 100 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedIndex(expandedIndex === idx ? null : idx);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      {expandedIndex === idx ? '접기' : '더보기'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 안내 메시지 */}
      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
        💡 {expertType === 'travel' ? '관광지나 맛집을 선택하면' : '추천 아이템을 선택하면'} 글에 자연스럽게 반영됩니다.
      </div>
    </div>
  );
});
