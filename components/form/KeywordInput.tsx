'use client';

import { useState, useCallback } from 'react';
import type { KeywordItem } from '@/types/index';
import { Check, X } from 'lucide-react';

interface KeywordInputProps {
  keywords: KeywordItem[];
  onChange: (keywords: KeywordItem[]) => void;
  maxKeywords?: number;
}

export default function KeywordInput({
  keywords,
  onChange,
  maxKeywords = 10,
}: KeywordInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [countValue, setCountValue] = useState('1');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingCount, setEditingCount] = useState<string>('1');

  const addKeyword = useCallback(() => {
    if (!inputValue.trim()) {
      alert('키워드를 입력해주세요');
      return;
    }

    if (keywords.some((k) => k.text.toLowerCase() === inputValue.toLowerCase())) {
      alert('이미 추가된 키워드입니다');
      return;
    }

    if (keywords.length >= maxKeywords) {
      alert(`최대 ${maxKeywords}개의 키워드를 추가할 수 있습니다`);
      return;
    }

    const count = Math.max(1, Math.min(10, parseInt(countValue) || 1));
    onChange([...keywords, { text: inputValue, count }]);
    setInputValue('');
    setCountValue('1');
  }, [inputValue, countValue, keywords, maxKeywords, onChange]);

  const removeKeyword = useCallback((index: number) => {
    onChange(keywords.filter((_, i) => i !== index));
  }, [keywords, onChange]);

  const startEditing = useCallback((index: number) => {
    setEditingIndex(index);
    setEditingCount(keywords[index].count.toString());
  }, [keywords]);

  const saveEdit = useCallback((index: number) => {
    const count = Math.max(1, Math.min(10, parseInt(editingCount) || 1));
    const updated = [...keywords];
    updated[index] = { ...updated[index], count };
    onChange(updated);
    setEditingIndex(null);
  }, [keywords, editingCount, onChange]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditingCount('1');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingIndex !== null) {
        saveEdit(editingIndex);
      } else {
        e.preventDefault();
        addKeyword();
      }
    } else if (e.key === 'Escape' && editingIndex !== null) {
      cancelEdit();
    }
  }, [editingIndex, saveEdit, addKeyword, cancelEdit]);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-dark">
        검색 키워드 ({keywords.length}/{maxKeywords})
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="추가할 키워드"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="number"
          value={countValue}
          onChange={(e) => setCountValue(e.target.value)}
          min="1"
          max="10"
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={addKeyword}
          disabled={keywords.length >= maxKeywords}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-300 transition-colors"
        >
          추가
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary rounded-full text-sm"
          >
            <span>{keyword.text}</span>

            {editingIndex === index ? (
              <>
                <input
                  type="number"
                  value={editingCount}
                  onChange={(e) => setEditingCount(e.target.value)}
                  min="1"
                  max="10"
                  className="w-12 px-1 py-0.5 border border-primary rounded text-center text-xs"
                  autoFocus
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={() => saveEdit(index)}
                  className="text-green-600 hover:text-green-700 transition-colors"
                  title="저장"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-red-600 hover:text-red-700 transition-colors"
                  title="취소"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEditing(index)}
                  className="text-xs text-primary/80 hover:text-primary transition-colors cursor-pointer"
                  title="클릭하여 횟수 수정"
                >
                  ×{keyword.count}
                </button>
                <button
                  onClick={() => removeKeyword(index)}
                  className="ml-1 text-primary/60 hover:text-primary transition-colors"
                  title="키워드 삭제"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
