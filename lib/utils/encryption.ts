import crypto from 'crypto';

/**
 * 강력한 AES-256-GCM 암호화 유틸리티
 * 마스터 키: '07231025'
 */

const MASTER_KEY = '07231025';
const ALGORITHM = 'aes-256-gcm';
const ENCODING = 'utf8' as BufferEncoding;
const OUTPUT_ENCODING = 'hex' as BufferEncoding;

/**
 * 마스터 키와 사용자 패스워드로부터 암호화 키 생성 (PBKDF2)
 */
function deriveKey(userPassword: string): Buffer {
  const combinedInput = MASTER_KEY + userPassword;
  // PBKDF2로 256-bit 키 생성 (100,000회 반복)
  return crypto.pbkdf2Sync(combinedInput, 'naver_blog_salt', 100000, 32, 'sha256');
}

/**
 * 데이터 암호화
 * @param data 암호화할 데이터 (JSON 문자열)
 * @param userPassword 사용자가 입력한 패스워드
 * @returns 암호화된 데이터 (IV:AuthTag:CipherText 형식)
 */
export function encryptData(data: string, userPassword: string): string {
  try {
    const key = deriveKey(userPassword);
    const iv = crypto.randomBytes(16); // 128-bit IV
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(data, ENCODING, OUTPUT_ENCODING);
    encrypted += cipher.final(OUTPUT_ENCODING);

    const authTag = cipher.getAuthTag();

    // IV:AuthTag:CipherText 형식으로 반환
    return `${iv.toString(OUTPUT_ENCODING)}:${authTag.toString(OUTPUT_ENCODING)}:${encrypted}`;
  } catch (error) {
    console.error('암호화 오류:', error);
    throw new Error('데이터 암호화에 실패했습니다');
  }
}

/**
 * 데이터 복호화
 * @param encryptedData IV:AuthTag:CipherText 형식의 암호화된 데이터
 * @param userPassword 사용자가 입력한 패스워드
 * @returns 복호화된 원본 데이터 (JSON 문자열)
 */
export function decryptData(encryptedData: string, userPassword: string): string {
  try {
    const key = deriveKey(userPassword);
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('잘못된 암호화 형식입니다');
    }

    const iv = Buffer.from(parts[0], OUTPUT_ENCODING);
    const authTag = Buffer.from(parts[1], OUTPUT_ENCODING);
    const cipherText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, OUTPUT_ENCODING, ENCODING);
    decrypted += decipher.final(ENCODING);

    return decrypted;
  } catch (error) {
    console.error('복호화 오류:', error);
    throw new Error('데이터 복호화에 실패했습니다. 패스워드를 확인하세요.');
  }
}

/**
 * 블로그 자격증명 암호화
 */
export function encryptCredentials(
  blogId: string,
  blogPassword: string,
  userPassword: string
): string {
  const credentials = JSON.stringify({
    blogId: blogId.trim(),
    blogPassword: blogPassword.trim(),
    encryptedAt: new Date().toISOString(),
  });
  return encryptData(credentials, userPassword);
}

/**
 * 블로그 자격증명 복호화
 */
export function decryptCredentials(
  encryptedData: string,
  userPassword: string
): { blogId: string; blogPassword: string; encryptedAt: string } {
  const decrypted = decryptData(encryptedData, userPassword);
  return JSON.parse(decrypted);
}

/**
 * 암호화 테스트 함수 (개발용)
 */
export function testEncryption(testPassword: string): boolean {
  try {
    const testData = 'test_blog_id:test_password';
    const encrypted = encryptData(testData, testPassword);
    const decrypted = decryptData(encrypted, testPassword);
    return decrypted === testData;
  } catch {
    return false;
  }
}
