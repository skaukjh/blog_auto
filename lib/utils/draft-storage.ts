/**
 * 글 생성 작업물 자동 임시 저장소 (브라우저 IndexedDB)
 *
 * 왜 필요한가:
 *   과거에는 입력값과 생성 결과가 React 상태에만 있어서, 실수로 창을 닫거나
 *   다른 페이지로 이동하면 업로드한 사진·제목·소제목·경험글이 전부 날아갔습니다.
 *   심지어 비용을 들여 생성한 글도 복구할 방법이 없었습니다.
 *
 * 왜 localStorage가 아니라 IndexedDB인가:
 *   localStorage는 문자열만 담고 용량이 약 5MB입니다. 사진 여러 장은 들어가지
 *   않습니다. IndexedDB는 File 객체를 구조화 복제로 그대로 저장할 수 있어,
 *   복구 후에도 원본 파일로 다시 생성을 돌릴 수 있습니다.
 *
 * 저장 항목은 두 가지입니다.
 *   - 입력 초안(draft): 입력 중 자동 저장. 생성 성공 후에도 남겨 두어 재생성에 씁니다.
 *   - 생성 결과(result): 생성이 끝나는 즉시 저장. 창을 닫아도 다시 열어 다운로드할 수 있습니다.
 */

import type {
  ExpertType,
  ImageAnalysisResult,
  KeywordItem,
  ExpertCreateContentResponse,
} from '@/types/index';

const DB_NAME = 'blog-gener-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';

const DRAFT_KEY = 'current-draft';
const RESULT_KEY = 'last-result';

/** 자동 저장되는 입력 초안 */
export interface StoredDraft {
  title: string;
  subheadings: string[];
  keywords: KeywordItem[];
  length: 'short' | 'medium' | 'long';
  personalExperience: string;
  /**
   * 업로드한 사진 원본. File은 구조화 복제가 가능해 IndexedDB에 그대로 들어갑니다.
   * 저장이 거부되는 환경에서는 이 필드를 비운 채로 나머지만 저장합니다.
   */
  images: File[];
  expertType: ExpertType | null;
  savedAt: string;
}

/** 자동 저장되는 생성 결과 */
export interface StoredResult {
  content: string;
  imageAnalysis: ImageAnalysisResult;
  wordCount: number;
  keywordCounts: Record<string, number>;
  cost?: ExpertCreateContentResponse['cost'];
  missingSubheadings?: string[];
  /** 다운로드 파일명에 쓸 제목 */
  title: string;
  savedAt: string;
}

/** 브라우저에서 IndexedDB를 쓸 수 있는 환경인지 */
function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB를 열 수 없습니다'));
    // 다른 탭이 오래된 버전을 붙잡고 있으면 blocked가 뜹니다. 대기하지 않고 실패로 처리합니다.
    request.onblocked = () => reject(new Error('다른 탭이 저장소를 사용 중입니다'));
  });
}

function put(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('저장에 실패했습니다'));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('저장이 중단되었습니다'));
        };
      })
  );
}

function get<T>(key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => {
          db.close();
          resolve((request.result as T) ?? null);
        };
        request.onerror = () => {
          db.close();
          reject(request.error ?? new Error('불러오기에 실패했습니다'));
        };
      })
  );
}

function remove(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('삭제에 실패했습니다'));
        };
      })
  );
}

/**
 * 입력 초안을 저장합니다.
 *
 * 자동 저장은 사용자가 인지하지 못한 채 돌아가는 기능이라, 실패해도 작업을
 * 방해하지 않도록 예외를 밖으로 던지지 않습니다. 사진 저장이 거부되는 환경에서는
 * 사진만 빼고 텍스트 입력이라도 지키도록 한 번 더 시도합니다.
 */
export async function saveDraft(draft: Omit<StoredDraft, 'savedAt'>): Promise<boolean> {
  if (!isAvailable()) return false;

  const record: StoredDraft = { ...draft, savedAt: new Date().toISOString() };

  try {
    await put(DRAFT_KEY, record);
    return true;
  } catch (error) {
    console.warn('초안 자동 저장 실패, 사진을 제외하고 재시도합니다:', error);
    try {
      await put(DRAFT_KEY, { ...record, images: [] });
      return true;
    } catch (retryError) {
      console.warn('초안 자동 저장을 포기합니다:', retryError);
      return false;
    }
  }
}

/** 저장된 입력 초안을 불러옵니다. 없거나 실패하면 null입니다. */
export async function loadDraft(): Promise<StoredDraft | null> {
  if (!isAvailable()) return null;

  try {
    const draft = await get<StoredDraft>(DRAFT_KEY);
    if (!draft) return null;

    // 저장 시점의 구조가 지금과 다를 수 있으므로 형태를 보정해 돌려줍니다.
    return {
      title: draft.title ?? '',
      subheadings: Array.isArray(draft.subheadings) ? draft.subheadings : [],
      keywords: Array.isArray(draft.keywords) ? draft.keywords : [],
      length: draft.length ?? 'medium',
      personalExperience: draft.personalExperience ?? '',
      images: Array.isArray(draft.images) ? draft.images.filter((f) => f instanceof File) : [],
      expertType: draft.expertType ?? null,
      savedAt: draft.savedAt ?? '',
    };
  } catch (error) {
    console.warn('초안 불러오기 실패:', error);
    return null;
  }
}

/** 입력 초안을 지웁니다 (사용자가 "새로 시작"을 택했을 때). */
export async function clearDraft(): Promise<void> {
  if (!isAvailable()) return;
  try {
    await remove(DRAFT_KEY);
  } catch (error) {
    console.warn('초안 삭제 실패:', error);
  }
}

/**
 * 생성 결과를 저장합니다.
 *
 * 돈이 들어간 결과물이므로 생성 직후 즉시 저장합니다. 이후 창을 닫아도
 * 다시 들어와 내용을 확인하고 다운로드할 수 있습니다.
 */
export async function saveResult(result: Omit<StoredResult, 'savedAt'>): Promise<boolean> {
  if (!isAvailable()) return false;

  try {
    await put(RESULT_KEY, { ...result, savedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    console.warn('생성 결과 저장 실패:', error);
    return false;
  }
}

/** 마지막 생성 결과를 불러옵니다. */
export async function loadResult(): Promise<StoredResult | null> {
  if (!isAvailable()) return null;

  try {
    const result = await get<StoredResult>(RESULT_KEY);
    if (!result?.content) return null;
    return result;
  } catch (error) {
    console.warn('생성 결과 불러오기 실패:', error);
    return null;
  }
}

/** 마지막 생성 결과를 지웁니다. */
export async function clearResult(): Promise<void> {
  if (!isAvailable()) return;
  try {
    await remove(RESULT_KEY);
  } catch (error) {
    console.warn('생성 결과 삭제 실패:', error);
  }
}
