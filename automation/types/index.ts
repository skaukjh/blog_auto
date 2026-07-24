// 네이버 블로그 자동화 전용 타입
// 글 생성 앱(A)의 types/index.ts 와는 독립적으로 관리합니다

// 좋아요 상태를 포함한 이웃 글 정보
export interface BlogPostWithLike {
  title: string;
  url: string;
  date: string;
  hasLike: boolean;
  blogName?: string;
  blogUrl?: string;
}

// 이웃 블로그 정보
export interface NeighborInfo {
  blogName: string;
  blogUrl: string;
  nickname: string;
}

// 댓글 생성
export interface CommentGenerationRequest {
  postContent: string;
  postTitle: string;
}

export interface CommentGenerationResponse {
  success: boolean;
  comment: string;
  error?: string;
}

// 댓글 + 좋아요 자동화
export interface NeighborCommentRequest {
  blogId: string;
  blogPassword: string;
  maxPosts?: number;
  minInterval?: number;
  keepLikingAfter?: boolean;
}

export interface NeighborCommentDetail {
  title: string;
  url: string;
  liked: boolean;
  commented: boolean;
  comment?: string;
  reason?: string;
}

export interface NeighborCommentResult {
  success: boolean;
  totalProcessed: number;
  totalCommented: number;
  totalLiked: number;
  totalSkipped: number;
  startedAt: string;
  completedAt: string;
  details: NeighborCommentDetail[];
  error?: string;
}

// 글쓰기 순차 입력
export interface WritePostRequest {
  blogId: string;
  blogPassword: string;
  title: string;
  content: string;
  /** 글자당 입력 간격(ms). 낮을수록 빠릅니다 */
  charDelayMs?: number;
  /** [IMAGE_N] 마커를 지우고 입력할지 여부 */
  stripImageMarkers?: boolean;
  /** 타이핑 후 자동 발행할지 여부. 기본은 사람이 검토 후 직접 발행 */
  autoPublish?: boolean;
}

export interface WritePostResponse {
  success: boolean;
  typedChars: number;
  elapsedMs: number;
  published: boolean;
  editorUrl?: string;
  warnings: string[];
  startedAt: string;
  completedAt: string;
  error?: string;
}

// 이웃 자동 좋아요
export interface NeighborLikeRequest {
  blogId: string;
  blogPassword: string;
  decryptPassword: string;
  daysLimit?: number;
  maxNeighbors?: number;
}

export interface NeighborLikeResponse {
  success: boolean;
  processed: number;
  liked: number;
  errors: string[];
  message?: string;
}
