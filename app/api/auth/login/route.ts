import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { validatePassword } from "@/lib/utils/validation";
import type { LoginRequest, LoginResponse } from "@/types/index";

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    const body: LoginRequest = await request.json();
    const { password } = body;

    // 비밀번호 검증
    if (!password) {
      return NextResponse.json(
        { success: false, message: "비밀번호를 입력해주세요" },
        { status: 400 }
      );
    }

    // 비밀번호 확인
    if (!validatePassword(password)) {
      return NextResponse.json(
        { success: false, message: "비밀번호가 올바르지 않습니다" },
        { status: 401 }
      );
    }

    // 세션 생성
    const token = await createSession(true);

    // 쿠키 설정
    const response = NextResponse.json(
      { success: true, message: "로그인되었습니다", token },
      { status: 200 }
    );

    // 쿠키 설정
    response.cookies.set({
      name: "blog_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: "로그인 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, message: "POST 요청을 사용해주세요" },
    { status: 405 }
  );
}
