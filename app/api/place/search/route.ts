import { NextRequest, NextResponse } from 'next/server';
import { searchPlace } from '@/lib/place/google-places';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeName = searchParams.get('name');

    if (!placeName) {
      return NextResponse.json(
        { success: false, error: '가게 이름을 입력해주세요' },
        { status: 400 }
      );
    }

    const placeInfo = await searchPlace(placeName);

    if (!placeInfo) {
      return NextResponse.json(
        { success: false, error: '가게 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, placeInfo },
      { status: 200 }
    );
  } catch (error) {
    console.error('가게 검색 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '가게 정보를 가져올 수 없습니다',
      },
      { status: 500 }
    );
  }
}
