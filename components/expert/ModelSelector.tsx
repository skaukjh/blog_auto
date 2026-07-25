'use client';

import { ModelConfig } from '@/types';
import { useState } from 'react';

interface ModelSelectorProps {
  modelConfig: ModelConfig;
  onUpdateModelConfig: (config: ModelConfig) => void;
  disabled?: boolean;
}

// ⚠️ 실존하는 모델 ID만 사용합니다. lib/openai/client.ts 의 OPENAI_MODELS 와 일치해야 합니다.
//
// 2026-07-25 사용자 결정:
//   - '최고 품질(sol)' 프리셋 제거. 비용이 커서 쓰지 않기로 했습니다.
//   - 균형형의 이미지 분석을 terra → luna로 내려 글당 비용을 100원 수준으로 맞춥니다.
//     글의 질을 좌우하는 본문 생성만 terra로 유지합니다.
const PRESET_CONFIGS = {
  balanced: {
    label: '⚖️ 균형형 (추천)',
    description: '본문은 Terra, 이미지 분석·검색은 Luna - 글당 약 100원 (기본값)',
    config: {
      imageAnalysisModel: 'gpt-5.6-luna',
      webSearchModel: 'gpt-5.6-luna',
      contentGenerationModel: 'gpt-5.6-terra',
      creativity: 7,
    },
  },
  economical: {
    label: '💰 절약형',
    description: '전부 Luna - 가장 저렴하지만 글맛이 조금 떨어질 수 있어요',
    config: {
      imageAnalysisModel: 'gpt-5.6-luna',
      webSearchModel: 'gpt-5.6-luna',
      contentGenerationModel: 'gpt-5.6-luna',
      creativity: 6,
    },
  },
};

/** 고급 설정 입력 도움말에 노출할 실제 모델 목록 */
const AVAILABLE_MODELS = 'gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-4o, gpt-4o-mini';

export function ModelSelector({
  modelConfig,
  onUpdateModelConfig,
  disabled = false,
}: ModelSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customModel, setCustomModel] = useState('');

  const handlePresetClick = (config: ModelConfig) => {
    onUpdateModelConfig(config);
    setCustomModel('');
  };

  /**
   * 현재 설정과 일치하는 프리셋 키. 없으면 null(직접 지정한 조합).
   *
   * 창의성은 슬라이더로 따로 조절하므로 비교에서 제외합니다. 그래야 창의성만
   * 바꿨을 때 선택 표시가 사라지지 않습니다.
   */
  const activePreset =
    Object.entries(PRESET_CONFIGS).find(
      ([, preset]) =>
        preset.config.imageAnalysisModel === modelConfig.imageAnalysisModel &&
        preset.config.webSearchModel === modelConfig.webSearchModel &&
        preset.config.contentGenerationModel === modelConfig.contentGenerationModel
    )?.[0] ?? null;

  return (
    <div className="w-full space-y-4">
      <h3 className="text-lg font-semibold">🤖 AI 모델 설정</h3>

      {/* 프리셋 선택 — 현재 설정과 일치하는 프리셋을 눌린 상태로 보여줍니다 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(PRESET_CONFIGS).map(([key, preset]) => {
          const isSelected = activePreset === key;

          return (
            <button
              key={key}
              onClick={() => handlePresetClick(preset.config as ModelConfig)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`relative p-3 rounded-lg border-2 text-left transition-all disabled:opacity-50 ${
                isSelected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 text-xs font-bold text-primary">
                  ✓ 선택됨
                </span>
              )}
              <div className={`font-semibold text-sm ${isSelected ? 'text-primary' : ''}`}>
                {preset.label}
              </div>
              <div className="text-xs text-gray-600 mt-1">{preset.description}</div>
            </button>
          );
        })}
      </div>

      {!activePreset && (
        <p className="text-xs text-gray-500">
          프리셋과 다른 조합입니다 (고급 설정에서 직접 지정한 상태)
        </p>
      )}

      {/* 고급 설정 */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {showAdvanced ? '▼' : '▶'} 고급 설정
      </button>

      {showAdvanced && (
        <div className="border-t pt-4 space-y-4">
          {/* 이미지 분석 모델 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              📸 이미지 분석 모델
            </label>
            <input
              type="text"
              value={customModel || modelConfig.imageAnalysisModel}
              onChange={(e) => {
                const value = e.target.value;
                setCustomModel(value);
                onUpdateModelConfig({
                  ...modelConfig,
                  imageAnalysisModel: value,
                });
              }}
              placeholder={`예: ${AVAILABLE_MODELS}`}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              {`사용 가능: ${AVAILABLE_MODELS}`}
            </p>
          </div>

          {/* 웹 검색 모델 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              🔍 웹 검색 모델
            </label>
            <input
              type="text"
              value={modelConfig.webSearchModel}
              onChange={(e) =>
                onUpdateModelConfig({
                  ...modelConfig,
                  webSearchModel: e.target.value,
                })
              }
              placeholder={`예: ${AVAILABLE_MODELS}`}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              빠르고 저비용인 모델 추천
            </p>
          </div>

          {/* 콘텐츠 생성 모델 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              ✍️ 콘텐츠 생성 모델
            </label>
            <input
              type="text"
              value={modelConfig.contentGenerationModel}
              onChange={(e) =>
                onUpdateModelConfig({
                  ...modelConfig,
                  contentGenerationModel: e.target.value,
                })
              }
              placeholder={`예: ${AVAILABLE_MODELS}`}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              가장 중요한 단계 - 고성능 모델 추천
            </p>
          </div>
        </div>
      )}

      {/* 현재 설정 표시 */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
        <div className="font-medium text-blue-900 mb-2">현재 설정:</div>
        <div className="text-blue-800 space-y-1 font-mono text-xs">
          <div>📸 분석: {modelConfig.imageAnalysisModel}</div>
          <div>🔍 검색: {modelConfig.webSearchModel}</div>
          <div>✍️ 생성: {modelConfig.contentGenerationModel}</div>
        </div>
      </div>
    </div>
  );
}
