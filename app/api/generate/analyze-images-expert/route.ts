import { analyzeImagesExpert } from '@/lib/openai/image-analyzer';
import { ExpertAnalyzeImagesResponse } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/generate/analyze-images-expert
 * 전문가별 이미지 분석
 *
 * Request:
 * {
 *   images: string[],
 *   topic: string,
 *   expertType: 'restaurant' | 'product' | 'travel' | 'fashion' | 'living',
 *   modelConfig: {
 *     imageAnalysisModel: string,
 *     webSearchModel: string,
 *     contentGenerationModel: string,
 *     creativity: number
 *   }
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExpertAnalyzeImagesResponse>> {
  try {
    const body = await request.json();
    const { images, topic, expertType, modelConfig } = body;

    if (!images || images.length === 0 || !expertType || !modelConfig) {
      return NextResponse.json(
        {
          success: false,
          analysis: {
            images: [],
            overall: { theme: '', style: '', suggestions: [] },
            costEstimate: 0,
          },
          expertType: 'restaurant',
          error: '필수 파라미터가 부족합니다',
        } as ExpertAnalyzeImagesResponse,
        { status: 400 }
      );
    }

    // 전문가 이미지 분석
    const analysis = await analyzeImagesExpert(images, topic, expertType, modelConfig);

    return NextResponse.json({
      success: true,
      analysis,
      expertType,
    });
  } catch (error) {
    console.error('Expert image analysis API error:', error);
    const errorMessage = error instanceof Error ? error.message : '이미지 분석 중 오류가 발생했습니다';

    return NextResponse.json(
      {
        success: false,
        analysis: {
          images: [],
          overall: { theme: '', style: '', suggestions: [] },
          costEstimate: 0,
        },
        expertType: 'restaurant',
        error: errorMessage,
      } as ExpertAnalyzeImagesResponse,
      { status: 500 }
    );
  }
}
