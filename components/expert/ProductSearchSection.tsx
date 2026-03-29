'use client';

import { useState, useCallback } from 'react';
import { ProductInfo, ProductSearchResult } from '@/types';

interface ProductSearchSectionProps {
  productInfo: ProductInfo | null;
  onProductSelect: (info: ProductInfo | null) => void;
}

/**
 * Phase 24: 제품 후기 전문가 전용 제품 정보 조회 UI
 * restaurant 섹션과 동일한 레이아웃 패턴 적용
 */
export function ProductSearchSection({ productInfo, onProductSelect }: ProductSearchSectionProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      alert('제품명을 입력해주세요');
      return;
    }

    setLoading(true);
    setSearched(false);
    try {
      const response = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        setSearched(true);
        if (data.results.length === 0) {
          alert('검색 결과가 없습니다');
        }
      } else {
        alert('검색 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch {
      alert('제품 검색 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleSelect = useCallback(
    (product: ProductSearchResult) => {
      onProductSelect({ selectedProduct: product, searchQuery: query.trim() });
    },
    [query, onProductSelect]
  );

  const handleClear = useCallback(() => {
    onProductSelect(null);
  }, [onProductSelect]);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">📦 제품 정보 조회 (선택)</h3>

      {/* 검색 입력 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="제품명을 입력하세요 (예: 삼성 갤럭시 버즈3 프로)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>

      {/* 검색 결과 */}
      {searched && results.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-500">{results.length}개 결과</p>
          {results.map((product, idx) => (
            <div
              key={idx}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                productInfo?.selectedProduct === product
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* 제품 이미지 */}
                {product.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{product.title}</p>
                  <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                    <p>최저가: <span className="font-medium text-blue-600">{product.lprice.toLocaleString()}원</span>
                      {product.hprice && product.hprice > product.lprice && (
                        <span className="ml-1 text-gray-400">~ {product.hprice.toLocaleString()}원</span>
                      )}
                    </p>
                    <p>판매처: {product.mallName}</p>
                    {product.brand && <p>브랜드: {product.brand}</p>}
                    {product.category && <p>카테고리: {product.category}</p>}
                    <p>별점: -</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSelect(product)}
                  disabled={productInfo?.selectedProduct === product}
                  className="shrink-0 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-green-600 disabled:cursor-default"
                >
                  {productInfo?.selectedProduct === product ? '선택됨' : '선택'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 선택된 제품 */}
      {productInfo && (
        <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800">
                ✓ {productInfo.selectedProduct.title}
              </p>
              <p className="text-xs text-green-700 mt-1">
                {productInfo.selectedProduct.lprice.toLocaleString()}원 ·{' '}
                {productInfo.selectedProduct.mallName}
                {productInfo.selectedProduct.brand && ` · ${productInfo.selectedProduct.brand}`}
              </p>
            </div>
            <button
              onClick={handleClear}
              className="text-xs text-gray-500 hover:text-red-500 ml-4"
            >
              해제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
