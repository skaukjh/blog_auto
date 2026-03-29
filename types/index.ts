// 폼 관련 타입
export interface GenerateFormData {
  topic: string;
  length: 'short' | 'medium' | 'long';
  keywords: KeywordItem[];
  images: File[];
  startSentence?: string;
  endSentence?: string;
}

export interface KeywordItem {
  text: string;
  count: number;
}

export interface LengthOption {
  value: 'short' | 'medium' | 'long';
  label: string;
  description: string;
  estimatedWords: number;
}

// 이미지 분석 관련 타입
export interface ImageCategory {
  category: string;
  confidence: number;
  details: string;
}

export interface CompressedImageAnalysis {
  idx: number;
  cats: ImageCategory[];
  desc: string;
  mood: string;
  visualDetails?: string;
}

export interface OverallAnalysis {
  theme: string;
  style: string;
  suggestions: string[];
}

export interface ImageAnalysisResult {
  images: CompressedImageAnalysis[];
  overall: OverallAnalysis;
  costEstimate: number;
}

// 블로그 스타일 관련 타입
export interface BlogAnalysisResult {
  style: BlogStyle;
  analyzedAt: string;
  blogs: BlogPost[];
  cacheKey: string;
}

export interface BlogStyle {
  tone: string;
  structure: string;
  emoticons: string[];
  keywords: string[];
  sentenceLength: 'short' | 'medium' | 'long';
  commonPhrases: string[];
  callToAction: string;
  introduction: string;
}

export interface BlogPost {
  title: string;
  url: string;
  excerpt: string;
}

// 이미지 가이드 관련 타입
export interface ImageGuide {
  index: number;
  marker: string;
  lineNumber: number;
  paragraphNumber: number;
  suggestedCaption: string;
  placement: 'inline' | 'standalone';
}

export interface GeneratedContentWithImages {
  content: string;
  imageGuides: ImageGuide[];
  wordCount: number;
  keywordCounts: Record<string, number>;
}

export interface MarkerInfo {
  index: number;
  marker: string;
  startPos: number;
  endPos: number;
}

export interface ContentSegment {
  type: 'text' | 'image';
  content: string;
  markerInfo?: MarkerInfo;
}

// 뷰 모드 관련 타입
export type ViewMode = 'preview' | 'edit';

export interface ContentDisplayState {
  content: string;
  imageGuides: ImageGuide[];
  viewMode: ViewMode;
  selectedImageIndex?: number;
}

// API 요청/응답 타입
export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
}

export interface AssistantCreateRequest {
  model: string;
  instructions: string;
  tools?: unknown[];
}

export interface AssistantCreateResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  instructions: string;
}

export interface AssistantUpdateRequest {
  id: string;
  instructions: string;
}

export interface AssistantUpdateResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  instructions: string;
}

export interface AssistantGetResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  instructions: string;
}

export interface FetchLatestBlogResponse {
  success: boolean;
  blogs: BlogPost[];
  message?: string;
  error?: string;
}

export interface AnalyzeStyleRequest {
  blogs: BlogPost[];
}

export interface AnalyzeStyleResponse {
  success: boolean;
  style: BlogStyle;
  analyzedAt: string;
  message?: string;
  error?: string;
}

export interface AnalyzeImagesRequest {
  images: string[];
  topic: string;
  context?: string;
}

export interface AnalyzeImagesResponse {
  success: boolean;
  analysis: ImageAnalysisResult;
  message?: string;
  error?: string;
}

export interface CreateContentRequest {
  topic: string;
  length: 'short' | 'medium' | 'long';
  keywords: KeywordItem[];
  imageAnalysis: ImageAnalysisResult;
  startSentence?: string;
  endSentence?: string;
  placeInfo?: PlaceInfo;
}

export interface CreateContentResponse {
  success: boolean;
  content: GeneratedContentWithImages;
  cost?: {
    usd: number;
    krw: number;
    breakdown?: {
      imageAnalysis: { usd: number; krw: number };
      contentGeneration: { usd: number; krw: number };
    };
  };
  message?: string;
  error?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

// 세션 관련 타입
export interface SessionPayload {
  iat: number;
  exp: number;
  authenticated: boolean;
}

// 블로그 스타일 캐시 타입
export interface BlogStyleCache {
  style: BlogStyle;
  blogs: BlogPost[];
  analyzedAt: string;
  cacheKey: string;
}

// 다운로드 관련 타입
export interface DownloadFormat {
  format: 'txt' | 'docx' | 'html';
  includeMarkers: boolean;
}

export interface DownloadOptions {
  filename: string;
  format: DownloadFormat['format'];
  includeMarkers: boolean;
}

// 채팅 수정 관련 타입
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface RefineContentRequest {
  conversationHistory: ChatMessage[];
  userRequest: string;
  currentContent: string;
  imageAnalysis: ImageAnalysisResult;
}

export interface RefineContentResponse {
  success: boolean;
  refinedContent: string;
  message?: string;
  error?: string;
}

// 가게 리뷰 관련 타입
export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  time: string; // ISO timestamp
}

// 메뉴 정보 관련 타입
export interface MenuInfo {
  name: string;
  price?: string;
  description: string;
}

// 가게 정보 관련 타입
export interface PlaceInfo {
  name: string;
  address: string;
  phone?: string;
  openingHours?: string[];
  parking?: string;
  rating?: number;
  website?: string;
  nearbyTransit?: string;
  reviews?: PlaceReview[];
  menus?: MenuInfo[];
}

// 네이버 블로그 이웃 자동 좋아요 관련 타입
export interface NeighborCredentials {
  blogId: string;
  blogPassword: string;
  encryptedAt: string;
}

export interface NeighborLoginRequest {
  blogId: string;
  blogPassword: string;
  decryptPassword: string;
}

export interface NeighborLoginResponse {
  success: boolean;
  message: string;
  sessionId?: string;
  error?: string;
}

export interface NeighborInfo {
  blogName: string;
  blogUrl: string;
  nickname: string;
}

export interface BlogPostWithLike {
  title: string;
  url: string;
  date: string;
  hasLike: boolean;
  blogName?: string;
  blogUrl?: string;
}

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

// 네이버 블로그 이웃 댓글+좋아요 관련 타입
export interface CommentGenerationRequest {
  postContent: string;
  postTitle: string;
}

export interface CommentGenerationResponse {
  success: boolean;
  comment: string;
  error?: string;
}

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

// 제품 검색 관련 타입 (Phase 24: 제품 후기 전문가)
export interface ProductSearchResult {
  title: string;       // 제품명 (HTML 태그 제거됨)
  lprice: number;      // 최저가 (원)
  hprice?: number;     // 최고가 (원)
  mallName: string;    // 판매처 (예: 쿠팡, 11번가)
  brand?: string;      // 브랜드명
  image?: string;      // 제품 이미지 URL
  link: string;        // 제품 링크
  rating?: number;     // 별점 (Naver 쇼핑 API 미제공 → undefined)
  category?: string;   // 카테고리 (category1 ~ category4 조합)
}

export interface ProductInfo {
  selectedProduct: ProductSearchResult;
  searchQuery: string;
}

// Supabase 관련 타입 (추후 추가 예정)
// export interface SupabaseUser { ... }
// export interface SupabaseToken { ... }

// Phase 20: 전문가 기반 블로그 글 생성 시스템 (Expert System)

// 전문가 타입
export type ExpertType = 'restaurant' | 'product' | 'travel' | 'living';

export interface ExpertDefinition {
  type: ExpertType;
  name: string;
  description: string;
  icon: string;
  color: string;
  persona: string; // 전문가 페르소나 설명
  expertise: string[]; // 전문 분야
  recommendationType: 'nearby' | 'related' | 'destination'; // 추천 타입
}

// 모델 설정
export interface ModelConfig {
  imageAnalysisModel: string; // 예: 'gpt-4o', 'claude-opus-4-6', 'gemini-3-pro'
  webSearchModel: string; // 예: 'gpt-4o-mini', 'claude-haiku-4-5'
  contentGenerationModel: string; // 예: 'gpt-5.2', 'claude-opus-4-6'
  creativity: number; // 1-10 (temperature: 0.3 + (creativity - 1) * 0.1)
}

// 웹 검색 관련 타입
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'naver' | 'google';
}

export interface WebSearchRequest {
  query: string;
  searchEngine: 'naver' | 'google'; // 선택 가능
  limit?: number; // 기본 5
}

export interface WebSearchResponse {
  success: boolean;
  results: WebSearchResult[];
  query: string;
  source: 'naver' | 'google' | 'both';
  message?: string;
  error?: string;
}

// 추천 시스템 관련 타입
export interface RecommendationItem {
  title: string;
  url: string;
  type: 'restaurant' | 'product' | 'place' | 'dish'; // 추천 아이템 타입
  description: string;
  rating?: number;
  address?: string;
}

export interface RecommendationRequest {
  query: string;
  expertType: ExpertType;
  recommendationType: 'nearby' | 'related' | 'destination'; // 추천 타입
  limit?: number; // 기본 5
}

export interface RecommendationResponse {
  success: boolean;
  recommendations: RecommendationItem[];
  expertType: ExpertType;
  message?: string;
  error?: string;
}

// 전문가 기반 이미지 분석
export interface ExpertAnalyzeImagesRequest {
  images: string[]; // Base64 encoded images
  topic: string;
  expertType: ExpertType;
  modelConfig: ModelConfig;
  context?: string;
}

export interface ExpertAnalyzeImagesResponse {
  success: boolean;
  analysis: ImageAnalysisResult;
  expertType: ExpertType;
  message?: string;
  error?: string;
}

// 전문가 기반 콘텐츠 생성
export interface ExpertCreateContentRequest {
  topic: string;
  length: 'short' | 'medium' | 'long';
  keywords: KeywordItem[];
  imageAnalysis: ImageAnalysisResult;
  expertType: ExpertType;
  modelConfig: ModelConfig;
  webSearchResults?: WebSearchResult[]; // 웹 검색 결과
  recommendations?: RecommendationItem[]; // 추천 아이템
  startSentence?: string;
  endSentence?: string;
  placeInfo?: PlaceInfo;
}

export interface ExpertCreateContentResponse {
  success: boolean;
  content: GeneratedContentWithImages;
  expertType: ExpertType;
  cost?: {
    usd: number;
    krw: number;
    breakdown?: {
      imageAnalysis: { usd: number; krw: number };
      contentGeneration: { usd: number; krw: number };
      webSearch?: { usd: number; krw: number };
    };
  };
  message?: string;
  error?: string;
}
