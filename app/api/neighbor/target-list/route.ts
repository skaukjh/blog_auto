export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  getNeighborTargetList,
  saveNeighborTargetList,
  addNeighborTarget,
  removeNeighborTarget,
} from "@/lib/utils/neighbor-target-list";
import fs from "fs";
import path from "path";

interface TargetListResponse {
  success: boolean;
  nicknames?: string[];
  message?: string;
  error?: string;
}

/**
 * GET: 대상 닉네임 목록 조회
 * POST: 대상 닉네임 목록 업데이트
 * DELETE: 특정 닉네임 제거
 */
export async function GET(): Promise<NextResponse<TargetListResponse>> {
  try {
    const nicknames = await getNeighborTargetList();

    return NextResponse.json(
      {
        success: true,
        nicknames: nicknames || [],
        message: "대상 닉네임 목록 조회 완료",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("대상 목록 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

/**
 * POST: 특정 닉네임 추가 또는 neighbor_list.txt에서 초기화
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<TargetListResponse>> {
  try {
    const body = await request.json();
    const { action, nickname, initFromFile } = body;

    // neighbor_list.txt에서 초기화
    if (initFromFile) {
      try {
        const filePath = path.join(process.cwd(), "neighbor_list.txt");

        if (!fs.existsSync(filePath)) {
          return NextResponse.json(
            {
              success: false,
              error: "neighbor_list.txt 파일을 찾을 수 없습니다",
            },
            { status: 400 }
          );
        }

        const fileContent = fs.readFileSync(filePath, "utf-8");
        const nicknames = fileContent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        const saved = await saveNeighborTargetList(nicknames);

        if (saved) {
          return NextResponse.json(
            {
              success: true,
              nicknames,
              message: `neighbor_list.txt에서 ${nicknames.length}개의 닉네임을 로드하여 저장했습니다`,
            },
            { status: 200 }
          );
        } else {
          return NextResponse.json(
            {
              success: false,
              error: "Supabase 저장 실패",
            },
            { status: 500 }
          );
        }
      } catch (fileErr) {
        console.error("파일 읽기 오류:", fileErr);
        return NextResponse.json(
          {
            success: false,
            error: `파일 읽기 오류: ${fileErr instanceof Error ? fileErr.message : "알 수 없는 오류"}`,
          },
          { status: 500 }
        );
      }
    }

    // 특정 닉네임 추가
    if (action === "add" && nickname) {
      const added = await addNeighborTarget(nickname);

      if (added) {
        const updatedList = await getNeighborTargetList();
        return NextResponse.json(
          {
            success: true,
            nicknames: updatedList || [],
            message: `"${nickname}" 추가 완료`,
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "닉네임 추가 실패 (중복이거나 저장 실패)",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "잘못된 요청입니다",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("대상 목록 추가 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 특정 닉네임 제거
 */
export async function DELETE(
  request: NextRequest
): Promise<NextResponse<TargetListResponse>> {
  try {
    const body = await request.json();
    const { nickname } = body;

    if (!nickname) {
      return NextResponse.json(
        {
          success: false,
          error: "제거할 닉네임을 지정하세요",
        },
        { status: 400 }
      );
    }

    const removed = await removeNeighborTarget(nickname);

    if (removed) {
      const updatedList = await getNeighborTargetList();
      return NextResponse.json(
        {
          success: true,
          nicknames: updatedList || [],
          message: `"${nickname}" 제거 완료`,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "닉네임 제거 실패",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("대상 목록 제거 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
