import { NextResponse } from "next/server";
import { fetchLatestBlogPostsFromRss } from "@/lib/blog/rss-scraper";
import type { FetchLatestBlogResponse } from "@/types/index";

export async function GET(): Promise<NextResponse<FetchLatestBlogResponse>> {
  try {
    const blogUrl = process.env.BLOG_URL;

    if (!blogUrl) {
      return NextResponse.json(
        {
          success: false,
          blogs: [],
          error: "블로그 URL이 설정되지 않았습니다",
        },
        { status: 400 }
      );
    }

    const blogs = await fetchLatestBlogPostsFromRss(blogUrl, 2);

    return NextResponse.json(
      {
        success: true,
        blogs,
        message: `최신 글 ${blogs.length}개를 가져왔습니다`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("블로그 크롤링 오류:", error);
    return NextResponse.json(
      {
        success: false,
        blogs: [],
        error: error instanceof Error ? error.message : "블로그에서 글을 가져올 수 없습니다",
      },
      { status: 500 }
    );
  }
}
