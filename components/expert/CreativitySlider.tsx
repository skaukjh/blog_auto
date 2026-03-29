'use client';

interface CreativitySliderProps {
  creativity: number;
  onChangeCreativity: (value: number) => void;
  disabled?: boolean;
}

const CREATIVITY_LEVELS = {
  1: '팩트 위주',
  2: '매우 보수적',
  3: '보수적',
  4: '약간 보수적',
  5: '균형적',
  6: '약간 창의적',
  7: '창의적',
  8: '매우 창의적',
  9: '극도로 창의적',
  10: '초상상',
};

const TEMPERATURE_MAP = {
  1: '0.3',
  2: '0.4',
  3: '0.5',
  4: '0.6',
  5: '0.7',
  6: '0.8',
  7: '0.9',
  8: '1.0',
  9: '1.1',
  10: '1.2',
};

export function CreativitySlider({
  creativity,
  onChangeCreativity,
  disabled = false,
}: CreativitySliderProps) {
  const description = CREATIVITY_LEVELS[creativity as keyof typeof CREATIVITY_LEVELS];
  const temperature = TEMPERATURE_MAP[creativity as keyof typeof TEMPERATURE_MAP];

  return (
    <div className="w-full space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-lg font-semibold">✨ 창의성 조절</label>
          <span className="text-sm text-gray-600">
            {creativity}/10 - {description}
          </span>
        </div>

        {/* 슬라이더 */}
        <input
          type="range"
          min="1"
          max="10"
          value={creativity}
          onChange={(e) => onChangeCreativity(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gradient-to-r from-blue-200 to-purple-300 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          style={{
            background: `linear-gradient(to right, #93c5fd ${((creativity - 1) / 9) * 100}%, #ddd ${((creativity - 1) / 9) * 100}%)`,
          }}
        />
      </div>

      {/* 설명 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 bg-blue-50 rounded">
          <div className="font-medium text-blue-900">온도 (Temperature)</div>
          <div className="text-blue-800 font-mono">{temperature}</div>
        </div>
        <div className="p-2 bg-purple-50 rounded">
          <div className="font-medium text-purple-900">추천 용도</div>
          <div className="text-purple-800 text-xs">
            {creativity <= 3
              ? '정보 전달 위주'
              : creativity <= 6
                ? '균형잡힌 글'
                : '표현력 풍부'}
          </div>
        </div>
      </div>

      {/* 슬라이더 범위 설명 */}
      <div className="border-t pt-3">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-start">
            <span className="font-medium w-12 text-blue-600">1-3:</span>
            <span>팩트 기반, 정보 전달 위주의 정확한 글</span>
          </div>
          <div className="flex items-start">
            <span className="font-medium w-12 text-green-600">4-6:</span>
            <span>균형잡힌 글, 개인적 표현과 팩트의 조화</span>
          </div>
          <div className="flex items-start">
            <span className="font-medium w-12 text-purple-600">7-10:</span>
            <span>창의적인 표현, 감정적 임팩트 강한 글</span>
          </div>
        </div>
      </div>
    </div>
  );
}
