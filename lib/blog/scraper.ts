import { chromium, type Browser, type Page } from "playwright";
import type { BlogPost } from "@/types/index";

let browserInstance: Browser | null = null;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * 브라우저 인스턴스를 가져옵니다 (싱글톤)
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }
  return browserInstance;
}

/**
 * 새로운 페이지를 생성합니다 (User-Agent 포함)
 */
async function createNewPage(browser: Browser): Promise<{ context: any; page: Page }> {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);
  return { context, page };
}

/**
 * 네이버 블로그에서 최신 글을 크롤링합니다
 */
export async function fetchLatestBlogPosts(
  blogUrl: string,
  count: number = 2
): Promise<BlogPost[]> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let context: any = null;

  try {
    // URL 유효성 검증
    if (!isValidBlogUrl(blogUrl)) {
      throw new Error("유효하지 않은 블로그 URL입니다");
    }

    browser = await getBrowser();
    const pageInfo = await createNewPage(browser);
    context = pageInfo.context;
    page = pageInfo.page;

    console.log(`[크롤러] ${blogUrl}에 접근 중...`);
    await page.goto(blogUrl, { waitUntil: "networkidle" });

    // 자바스크립트 렌더링 대기 (네이버 블로그 콘텐츠 로드)
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

    // 최신 글 추출
    const posts = await page.evaluate(() => {
      const blogPosts: Array<{
        title: string;
        url: string;
        excerpt: string;
        date?: string;
      }> = [];

      // 방법 1: 새로운 네이버 블로그 구조 (React)
      let postElements = document.querySelectorAll(
        'a[href*="/PostView.naver"], a[href*="?Redirect=Log&logNo="]'
      );

      if (postElements.length === 0) {
        // 방법 2: 구 네이버 블로그 구조
        postElements = document.querySelectorAll(
          'div.post_item a.post_item_title'
        );
      }

      if (postElements.length === 0) {
        // 방법 3: 최신 네이버 블로그 (2024년 버전)
        postElements = document.querySelectorAll(
          'article a, [role="article"] a[href*="naver.com"]'
        );
      }

      // 글 추출
      postElements.forEach((element) => {
        const link = element as HTMLAnchorElement;
        const href = link.getAttribute("href");
        const title = link.getAttribute("title") || link.textContent || "";

        if (href && title && !href.includes("#")) {
          const fullUrl = href.startsWith("http")
            ? href
            : `https://blog.naver.com${href}`;

          // 중복 제거
          const exists = blogPosts.some((p) => p.url === fullUrl);
          if (!exists && blogPosts.length < 10) {
            blogPosts.push({
              title: cleanText(title),
              url: fullUrl,
              excerpt: "",
              date: new Date().toISOString(),
            });
          }
        }
      });

      return blogPosts;
    });

    console.log(`[크롤러] ${posts.length}개의 글을 찾았습니다`);

    if (posts.length === 0) {
      console.warn("[크롤러] 글을 찾지 못했습니다. 다른 선택자를 시도 중...");

      // 최후의 시도: 페이지 전체 링크 분석
      const allLinks = await page.evaluate(() => {
        const links: Array<{
          title: string;
          url: string;
          excerpt: string;
        }> = [];

        document.querySelectorAll("a").forEach((link) => {
          const href = link.getAttribute("href");
          const text = link.textContent || "";

          // 네이버 블로그 포스트 URL 패턴
          if (
            href &&
            (href.includes("PostView") ||
              href.includes("logNo") ||
              href.includes("ssyeonee")) &&
            text.length > 5
          ) {
            const fullUrl = href.startsWith("http")
              ? href
              : `https://blog.naver.com${href}`;

            const exists = links.some((l) => l.url === fullUrl);
            if (!exists && links.length < 10) {
              links.push({
                title: cleanText(text),
                url: fullUrl,
                excerpt: "",
              });
            }
          }
        });

        return links;
      });

      posts.push(...allLinks.slice(0, count));
    }

    // 각 글의 내용 크롤링
    for (let i = 0; i < Math.min(posts.length, count); i++) {
      try {
        console.log(
          `[크롤러] ${posts[i].title} 내용 로딩 중... (${i + 1}/${Math.min(posts.length, count)})`
        );
        const content = await fetchPostContent(
          posts[i].url,
          browser,
          30000 // 30초 타임아웃
        );
        posts[i].excerpt = content.substring(0, 500);
      } catch (error) {
        console.warn(
          `[크롤러] ${posts[i].title} 내용 로드 실패:`,
          error instanceof Error ? error.message : error
        );
        posts[i].excerpt = "내용을 불러올 수 없습니다";
      }
    }

    return posts.slice(0, count);
  } catch (error) {
    console.error("[크롤러] 블로그 크롤링 실패:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "블로그에서 글을 가져올 수 없습니다. 블로그 URL이 올바른지 확인해주세요."
    );
  } finally {
    // context와 page 닫기, 브라우저는 유지 (성능 개선)
    if (page) {
      try {
        await page.close();
      } catch {
        // 페이지 닫기 실패해도 계속 진행
      }
    }
    if (context) {
      try {
        await context.close();
      } catch {
        // context 닫기 실패해도 계속 진행
      }
    }
  }
}

/**
 * 개별 블로그 글의 내용을 크롤링합니다
 */
async function fetchPostContent(
  postUrl: string,
  browser: Browser,
  timeout: number = 30000
): Promise<string> {
  let page: Page | null = null;
  let context: any = null;

  try {
    const pageInfo = await createNewPage(browser);
    context = pageInfo.context;
    page = pageInfo.page;
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);

    // 페이지 접근
    await page.goto(postUrl, { waitUntil: "networkidle" });

    // 자바스크립트 렌더링 대기
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1500)));

    // 본문 추출
    const content = await page.evaluate(() => {
      // 네이버 블로그 본문 선택자들 (우선순위순)
      const selectors = [
        "div.se-main-container", // 최신 에디터
        "div#post_content", // 구 에디터
        "div.post_view_content", // 또 다른 구조
        "article", // HTML5 article
        "div[role='main'] article",
        "div.se-component", // 에디터 컴포넌트
        "div._pcol_0", // 또 다른 구조
      ];

      let text = "";

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          text = element.textContent;
          break;
        }
      }

      // 아무것도 찾지 못한 경우 body 텍스트 사용
      if (!text) {
        text = document.body.innerText;
      }

      return text;
    });

    return cleanText(content);
  } catch (error) {
    console.error("[크롤러] 글 내용 크롤링 실패:", error);
    return "";
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // 페이지 닫기 실패해도 계속 진행
      }
    }
    if (context) {
      try {
        await context.close();
      } catch {
        // context 닫기 실패해도 계속 진행
      }
    }
  }
}

/**
 * URL이 유효한 블로그 URL인지 확인합니다
 */
function isValidBlogUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes("blog.naver.com") ||
      urlObj.hostname.includes("tistory.com")
    );
  } catch {
    return false;
  }
}

/**
 * 텍스트를 정리합니다 (불필요한 공백 제거 등)
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ") // 연속 공백 제거
    .replace(/\r\n/g, "\n") // 개행 정규화
    .replace(/\n\n+/g, "\n") // 연속 개행 정리
    .trim()
    .substring(0, 5000); // 최대 5000자
}

/**
 * 크롤러 종료 (선택사항)
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
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
