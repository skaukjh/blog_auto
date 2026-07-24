/**
 * docs/ 의 PDF에서 텍스트를 뽑아 파일로 저장합니다.
 *
 * 글쓰기 가이드 분석(analyze-writing-guide.mjs)의 전처리 단계입니다.
 * PDF 원본은 저작물이라 저장소 밖으로 내보내지 않습니다.
 *
 * 사용: node scripts/extract-pdf.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PDFParse } from 'pdf-parse';

const DOCS_DIR = 'docs';
const OUT_DIR = join('docs', '.extracted');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const pdfs = readdirSync(DOCS_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
if (pdfs.length === 0) {
  console.log('docs/ 에 PDF가 없습니다.');
  process.exit(0);
}

for (const name of pdfs) {
  const path = join(DOCS_DIR, name);
  console.log(`추출 중: ${name}`);

  const parser = new PDFParse({ data: new Uint8Array(readFileSync(path)) });
  const result = await parser.getText();
  await parser.destroy();

  const text = result.text ?? '';
  const outPath = join(OUT_DIR, name.replace(/\.pdf$/i, '.txt'));
  writeFileSync(outPath, text, 'utf8');

  console.log(`  페이지 ${result.total ?? '?'}개, ${text.length.toLocaleString()}자`);
  console.log(`  저장: ${outPath}`);
}
