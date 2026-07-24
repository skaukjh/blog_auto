'use client';

import { ExpertType } from '@/types';
import { EXPERT_LIST } from '@/lib/experts/definitions';

interface ExpertSelectorProps {
  selectedExpert: ExpertType | null;
  onSelectExpert: (expert: ExpertType) => void;
  disabled?: boolean;
  /**
   * 문체 학습이 끝난 전문가 목록.
   *
   * 전문가마다 문체가 따로 저장되므로, 학습된 전문가만 글을 쓸 수 있습니다.
   * 하나도 학습되지 않았을 때와 구분하려고 `null`이면 아직 조회 중으로 봅니다.
   */
  learnedExperts?: Set<string> | null;
}

export function ExpertSelector({
  selectedExpert,
  onSelectExpert,
  disabled = false,
  learnedExperts = null,
}: ExpertSelectorProps) {
  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">📝 전문가 선택 (필수)</h3>
      <p className="text-sm text-gray-600 mb-4">
        문체 학습이 끝난 전문가만 선택할 수 있습니다. 각 전문가는 자기 문체만 참고합니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {EXPERT_LIST.map((expert) => {
          // 조회 전(null)에는 잠그지 않고, 조회 후에만 미학습 전문가를 잠급니다.
          const isLearned = learnedExperts === null || learnedExperts.has(expert.type);
          const isDisabled = disabled || !isLearned;
          const isSelected = selectedExpert === expert.type;

          return (
            <button
              key={expert.type}
              onClick={() => onSelectExpert(expert.type)}
              disabled={isDisabled}
              title={isLearned ? undefined : `${expert.name} 문체를 먼저 학습하세요 (/format)`}
              className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="text-3xl mb-2">{expert.icon}</div>
              <h4 className="font-semibold text-sm">{expert.name}</h4>
              <p className="text-xs text-gray-600 mt-1">{expert.description}</p>

              {learnedExperts !== null && (
                <span
                  className={`mt-2 inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                    isLearned ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {isLearned ? '문체 학습됨' : '미학습'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
