'use client';

import { ExpertType } from '@/types';
import { EXPERT_LIST } from '@/lib/experts/definitions';

interface ExpertSelectorProps {
  selectedExpert: ExpertType | null;
  onSelectExpert: (expert: ExpertType) => void;
  disabled?: boolean;
}

export function ExpertSelector({
  selectedExpert,
  onSelectExpert,
  disabled = false,
}: ExpertSelectorProps) {
  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">📝 전문가 선택 (필수)</h3>
      <p className="text-sm text-gray-600 mb-4">
        당신의 블로그 스타일에 맞는 전문가를 선택해주세요.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {EXPERT_LIST.map((expert) => (
          <button
            key={expert.type}
            onClick={() => onSelectExpert(expert.type)}
            disabled={disabled}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              selectedExpert === expert.type
                ? `border-blue-500 bg-blue-50 ring-2 ring-blue-200`
                : `border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50`
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="text-3xl mb-2">{expert.icon}</div>
            <h4 className="font-semibold text-sm">{expert.name}</h4>
            <p className="text-xs text-gray-600 mt-1">{expert.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
