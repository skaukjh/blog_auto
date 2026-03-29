'use client';

import React, { useState } from 'react';
import { PlaceReview } from '@/types';

interface PlaceReviewSelectorProps {
  reviews: PlaceReview[];
  selectedReviews: PlaceReview[];
  onSelectReviews: (reviews: PlaceReview[]) => void;
  isLoading?: boolean;
}

export const PlaceReviewSelector = React.memo(({
  reviews,
  selectedReviews,
  onSelectReviews,
  isLoading = false,
}: PlaceReviewSelectorProps) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleReview = (review: PlaceReview) => {
    const isSelected = selectedReviews.some(
      r => r.author === review.author && r.time === review.time
    );

    if (isSelected) {
      onSelectReviews(
        selectedReviews.filter(r => !(r.author === review.author && r.time === review.time))
      );
    } else {
      onSelectReviews([...selectedReviews, review]);
    }
  };

  const isSelected = (review: PlaceReview): boolean => {
    return selectedReviews.some(
      r => r.author === review.author && r.time === review.time
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">💬 고객 리뷰 ({reviews.length}개)</h4>
        <span className="text-sm text-green-600 font-medium">선택됨: {selectedReviews.length}개</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {reviews.map((review) => (
          <div
            key={`${review.author}-${review.time}`}
            onClick={() => toggleReview(review)}
            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
              isSelected(review)
                ? 'bg-blue-50 border-blue-300'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isSelected(review)}
                onChange={() => toggleReview(review)}
                disabled={isLoading}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="font-semibold text-sm truncate">{review.author}</h5>
                  <span className="text-sm font-medium text-yellow-600 whitespace-nowrap">
                    ⭐ {review.rating}/5
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-2 line-clamp-2">{review.text}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(review.time).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedReviews.length > 0 && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            💡 선택된 {selectedReviews.length}개 리뷰가 블로그 글에 자연스럽게 포함됩니다.
          </p>
        </div>
      )}
    </div>
  );
});

PlaceReviewSelector.displayName = 'PlaceReviewSelector';
