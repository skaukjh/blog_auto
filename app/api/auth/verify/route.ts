import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "super_secret_key_change_in_production"
);

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("blog_session")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "인증되지 않았습니다" },
        { status: 401 }
      );
    }

    await jwtVerify(token, secret);

    return NextResponse.json(
      { success: true, message: "인증 완료" },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "인증이 만료되었습니다" },
      { status: 401 }
    );
  }
}
