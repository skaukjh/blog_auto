'use client';

import { ModelConfig } from '@/types';
import { useState } from 'react';

interface ModelSelectorProps {
  modelConfig: ModelConfig;
  onUpdateModelConfig: (config: ModelConfig) => void;
  disabled?: boolean;
}

// ⚠️ 실존하는 모델 ID만 사용합니다. lib/openai/client.ts 의 OPENAI_MODELS 와 일치해야 합니다.
const PRESET_CONFIGS = {
  quality: {
    label: '🏆 최고 품질 (추천)',
    description: 'GPT-5.6 Sol - 이미지 분석과 글쓰기 모두 최고 성능',
    config: {
      imageAnalysisModel: 'gpt-5.6-sol',
      webSearchModel: 'gpt-5.6-terra',
      contentGenerationModel: 'gpt-5.6-sol',
      creativity: 7,
    },
  },
  balanced: {
    label: '⚖️ 균형형',
    description: 'GPT-5.6 Terra - 성능과 비용의 균형',
    config: {
      imageAnalysisModel: 'gpt-5.6-terra',
      webSearchModel: 'gpt-5.6-luna',
      contentGenerationModel: 'gpt-5.6-terra',
      creativity: 7,
    },
  },
  economical: {
    label: '💰 절약형',
    description: 'GPT-5.6 Luna - 비용 우선',
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

  return (
    <div className="w-full space-y-4">
      <h3 className="text-lg font-semibold">🤖 AI 모델 설정</h3>

      {/* 프리셋 선택 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(PRESET_CONFIGS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => handlePresetClick(preset.config as ModelConfig)}
            disabled={disabled}
            className="p-3 rounded-lg border-2 text-left transition-all hover:bg-gray-50 border-gray-200 disabled:opacity-50"
          >
            <div className="font-semibold text-sm">{preset.label}</div>
            <div className="text-xs text-gray-600 mt-1">{preset.description}</div>
          </button>
        ))}
      </div>

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
