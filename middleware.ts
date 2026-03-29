import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "super_secret_key_change_in_production"
);

const publicPaths = ["/login", "/api/auth/login"];
const protectedPaths = ["/generate", "/format", "/api/generate", "/api/blog", "/api/assistant", "/api/products"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로는 바로 통과
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 보호된 경로 확인
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  // 보호된 경로에는 세션 필수
  const token = request.cookies.get("blog_session")?.value;

  if (!token) {
    // API 요청이면 401 반환
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 페이지 요청이면 로그인 페이지로 리디렉션
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 토큰 검증
  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // 토큰이 유효하지 않음
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { success: false, error: "인증이 만료되었습니다" },
        { status: 401 }
      );
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
