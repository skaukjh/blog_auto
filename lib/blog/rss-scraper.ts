import axios from "axios";
import * as cheerio from "cheerio";
import type { BlogPost } from "@/types/index";
import { sampleBlogPosts } from "./sample-posts";

/**
 * 네이버 블로그의 RSS 피드에서 최신 글을 가져옵니다
 * (Puppeteer 대신 RSS 피드 사용 - 훨씬 더 빠르고 안정적)
 */
export async function fetchLatestBlogPostsFromRss(
  blogUrl: string,
  count: number = 2
): Promise<BlogPost[]> {
  try {
    // URL에서 블로그 ID 추출 (예: https://blog.naver.com/ssyeonee27)
    const blogId = extractBlogId(blogUrl);
    if (!blogId) {
      throw new Error("블로그 URL에서 블로그 ID를 추출할 수 없습니다");
    }

    // RSS 피드 URL 구성
    const rssUrl = `https://blog.naver.com/rss/${blogId}`;

    console.log(`[RSS 크롤러] ${rssUrl}에서 피드 로드 중...`);

    const response = await axios.get(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 15000,
    });

    if (!response.data) {
      throw new Error("RSS 피드를 가져올 수 없습니다");
    }

    // RSS 파싱
    const $ = cheerio.load(response.data, {
      xmlMode: true,
    });

    const posts: BlogPost[] = [];

    // RSS 아이템 추출
    $("item").each((index, element) => {
      if (index >= count) return;

      const titleEl = $(element).find("title");
      const linkEl = $(element).find("link");
      const descriptionEl = $(element).find("description");

      const title = titleEl.text().trim();
      const link = linkEl.text().trim();
      const description = descriptionEl.text().trim();

      if (title && link) {
        posts.push({
          title: cleanText(title),
          url: link,
          excerpt: cleanText(description).substring(0, 500),
        });
      }
    });

    console.log(`[RSS 크롤러] ${posts.length}개의 글을 찾았습니다`);

    if (posts.length === 0) {
      throw new Error(
        "블로그에 발행된 글이 없거나 RSS 피드가 비활성화되어 있습니다"
      );
    }

    return posts;
  } catch (error) {
    console.error("[RSS 크롤러] 오류:", error);
    console.log("[RSS 크롤러] 샘플 데이터로 폴백합니다");

    // RSS 피드 불러오기 실패 시 샘플 데이터 반환
    return sampleBlogPosts.slice(0, count);
  }
}

/**
 * 블로그 URL에서 블로그 ID 추출
 * 예: https://blog.naver.com/ssyeonee27 → ssyeonee27
 */
function extractBlogId(blogUrl: string): string | null {
  try {
    const url = new URL(blogUrl);
    const pathParts = url.pathname.split("/").filter((p) => p);

    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 텍스트를 정리합니다
 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "") // HTML 태그 제거
    .replace(/&nbsp;/g, " ") // nbsp 변환
    .replace(/&amp;/g, "&") // amp 변환
    .replace(/&lt;/g, "<") // lt 변환
    .replace(/&gt;/g, ">") // gt 변환
    .replace(/&quot;/g, '"') // quot 변환
    .replace(/\s+/g, " ") // 연속 공백 제거
    .trim()
    .substring(0, 5000); // 최대 5000자
}

/**
 * 크롤링된 글들에서 공통 패턴을 추출합니다
 */
export function extractCommonPatterns(posts: BlogPost[]): {
  averageLength: number;
  commonWords: string[];
  postCount: number;
} {
  const totalLength = posts.reduce((sum, post) => sum + post.excerpt.length, 0);
  const averageLength = Math.round(totalLength / Math.max(posts.length, 1));

  // 가장 많이 나타나는 단어 추출
  const allText = posts.map((p) => p.title + " " + p.excerpt).join(" ");
  const words = allText.split(/\s+/).filter((word) => word.length > 2);
  const wordCounts = new Map<string, number>();

  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
    if (cleanWord) {
      wordCounts.set(cleanWord, (wordCounts.get(cleanWord) || 0) + 1);
    }
  }

  const commonWords = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return {
    averageLength,
    commonWords,
    postCount: posts.length,
  };
}
