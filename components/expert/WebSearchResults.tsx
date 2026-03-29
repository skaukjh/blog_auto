'use client';

import React, { useState } from 'react';
import { WebSearchResult } from '@/types';

interface WebSearchResultsProps {
  results: WebSearchResult[];
  selectedResults: WebSearchResult[];
  onSelectResults: (results: WebSearchResult[]) => void;
  isLoading?: boolean;
}

export const WebSearchResults = React.memo(function WebSearchResults({
  results,
  selectedResults,
  onSelectResults,
}: WebSearchResultsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleResult = (result: WebSearchResult) => {
    const isSelected = selectedResults.some(
      (r) => r.url === result.url && r.source === result.source
    );

    if (isSelected) {
      onSelectResults(
        selectedResults.filter((r) => !(r.url === result.url && r.source === result.source))
      );
    } else {
      onSelectResults([...selectedResults, result]);
    }
  };

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">🔍 웹 검색 결과 ({results.length}개)</h4>
        <span className="text-sm text-gray-600">
          선택됨: {selectedResults.length}개
        </span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map((result, idx) => {
          const isSelected = selectedResults.some(
            (r) => r.url === result.url && r.source === result.source
          );

          return (
            <div
              key={`${result.source}-${idx}`}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleResult(result)}
            >
              <div className="flex items-start gap-3">
                {/* 체크박스 */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleResult(result)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1"
                />

                {/* 콘텐츠 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="font-medium text-sm line-clamp-2">{result.title}</h5>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded flex-shrink-0">
                      {result.source === 'naver' ? '네이버' : '구글'}
                    </span>
                  </div>

                  {/* 요약 */}
                  <p
                    className={`text-sm text-gray-600 mt-1 ${
                      expandedIndex === idx ? '' : 'line-clamp-2'
                    }`}
                  >
                    {result.snippet}
                  </p>

                  {/* 더보기 버튼 */}
                  {result.snippet.length > 150 && (
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
        💡 검색 결과를 선택하면 자동으로 글에 자연스럽게 반영됩니다.
      </div>
    </div>
  );
});
