/**
 * 시적·음유적 표현과 AI 말투 검사기
 *
 * 왜 코드로 검사하는가:
 *   사용자가 "절대 시적 표현이나 AI 말투가 들어가면 안 된다"고 못을 박았습니다.
 *   프롬프트로 금지해도 모델은 종종 되돌아갑니다. 종결어미(`detectSentenceEnding`)와
 *   제목·소제목(`enforceOutline`)에서 쓰던 원칙을 그대로 적용합니다.
 *   **반드시 지켜야 하는 규칙은 LLM 판단에 맡기지 않고 코드가 확정합니다.**
 *
 * 동작:
 *   1) 생성된 글을 문장 단위로 훑어 금지 패턴에 걸리는 문장을 찾습니다.
 *   2) 걸린 문장만 모아 한 번의 호출로 고쳐 받고 그 자리에 끼워 넣습니다.
 *      글 전체를 다시 생성하지 않으므로 추가 비용이 작습니다.
 *   3) 그래도 남으면 화면에 경고로 알립니다.
 *
 * 패턴을 추가할 때는 반드시 **구체적인 조합**으로 좁히세요. "따뜻한" 하나만 막으면
 * "국물이 따뜻해서 좋았어요" 같은 정상 문장까지 걸립니다.
 */

import { openai, UTILITY_MODEL, resolveModel, buildChatParams } from "./client";
import { extractUsage } from "./pricing";
import { isHeadingLine } from "@/lib/utils/outline";
import type { TokenUsage } from "@/types/index";

interface BannedPattern {
  /** 검사 정규식 */
  pattern: RegExp;
  /** 왜 걸렸는지 (고쳐 쓸 때 모델에게 알려 줍니다) */
  reason: string;
}

/**
 * 금지 패턴.
 *
 * 앞쪽은 사용자가 실제로 지적한 문장에서 뽑은 것이고(2026-07-25 "너무 추상적이고
 * 음유적이야. 시같아."), 뒤쪽은 그 전에 정리한 광고투·AI투입니다.
 */
export const BANNED_PATTERNS: BannedPattern[] = [
  // ── 시적·음유적 (사용자 지적 사례) ─────────────────────────────
  { pattern: /골목을?\s*걷다가|길을?\s*걷다가|거리를?\s*걷다가/, reason: "산책 장면으로 분위기를 잡는 도입" },
  { pattern: /발걸음이\s*(느려|가벼워|멈춰)/, reason: "발걸음 비유" },
  { pattern: /괜히\s*\S+(?:져요|지더라고요|해요|되더라고요|들어요)/, reason: "'괜히'로 무드를 만드는 표현" },
  { pattern: /왠지\s*모르게|왠지\s*\S+(?:져요|해요)/, reason: "'왠지'로 무드를 만드는 표현" },
  { pattern: /(따뜻한|은은한|포근한|노란|따스한)\s*(불빛|조명|빛)/, reason: "조명을 감성적으로 묘사" },
  { pattern: /(불빛|조명|빛)이\s*\S*\s*(포근|은은|따뜻|따스|아늑)/, reason: "조명을 감성적으로 묘사" },
  { pattern: /빛이\s*(스며들|번져|물들|감돌)/, reason: "빛을 시적으로 묘사" },
  { pattern: /질감(?:의|이|을)\s/, reason: "질감을 묘사하는 문학적 표현" },
  { pattern: /(실루엣|정취|무드|여백|온기|물성)(?:이|가|을|를|의)\s/, reason: "추상명사를 주어·목적어로 쓴 문학적 표현" },
  { pattern: /현장감(?:이|을)\s/, reason: "추상명사('현장감')를 주어·목적어로 씀" },
  { pattern: /(?:함|감|움)이\s*(?:느껴졌어요|느껴져요|묻어나|감돌)/, reason: "추상적 느낌을 서술" },
  { pattern: /어우러(?:져|지)/, reason: "'어우러지다' — 카탈로그·문학투" },
  { pattern: /(?:날|순간)\s*있잖아요/, reason: "'~하는 날 있잖아요' — 무드용 상투구" },
  { pattern: /지켜온|간직한|머금은|머금고/, reason: "세월을 의인화하는 문학적 표현" },
  { pattern: /사이로\s+\S+이\s*보이(?:면|고)/, reason: "장면을 훑는 시적 시선" },

  // ── 광고투·카탈로그투 ─────────────────────────────────────────
  { pattern: /존재감(?:이|을)/, reason: "광고투('존재감')" },
  { pattern: /을?\s*예고(?:해|하)/, reason: "광고투('~을 예고하다')" },
  { pattern: /(?:이|가)\s*살아\s*있어요/, reason: "광고투('~가 살아 있다')" },
  { pattern: /인상을\s*(?:줘요|주었어요|줍니다)/, reason: "광고투('인상을 준다')" },
  { pattern: /(?:을|를)\s*자랑(?:해요|합니다)/, reason: "광고투('~을 자랑하다')" },
  { pattern: /돋보(?:여요|였어요|입니다)/, reason: "광고투('돋보인다')" },
  { pattern: /눈(?:길|을)\s*사로잡/, reason: "광고투('눈길을 사로잡다')" },
  { pattern: /은?\s*충분했어요/, reason: "번역투('~은 충분했어요')" },

  // ── AI투 ──────────────────────────────────────────────────────
  { pattern: /사진(?:만으로|으로만)/, reason: "AI 특유의 유보 표현" },
  { pattern: /확인되지\s*않(?:아요|았어요)|확인하기\s*어(?:려워요|렵습니다)/, reason: "AI 특유의 유보 표현" },
  { pattern: /인\s*만큼/, reason: "AI가 반복하는 교과서적 연결어('~인 만큼')" },
  { pattern: /하는\s*편이\s*좋(?:아요|겠어요)/, reason: "AI가 반복하는 교과서적 표현" },
  { pattern: /라\s*할\s*수\s*있어요/, reason: "AI투('~라 할 수 있어요')" },
];

export interface ToneViolation {
  /** 걸린 문장 원문 */
  sentence: string;
  /** 걸린 이유 */
  reason: string;
}

/** 마커만 있는 줄이나 제목·소제목 줄인지 (검사 대상에서 제외) */
function isSkippableLine(line: string, title: string, subheadings: string[]): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^\[IMAGE_\d+\]$/.test(trimmed)) return true;
  return isHeadingLine(trimmed, title, subheadings);
}

/** 문장 단위로 자릅니다 (한국어 종결부호 기준, 마커는 떼어 냅니다) */
function splitSentences(line: string): string[] {
  return line
    .replace(/\[IMAGE_\d+\]/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 시적 표현·AI 말투가 들어간 문장을 찾습니다.
 *
 * 제목·소제목 줄과 마커는 검사하지 않습니다(사용자가 정한 문구를 건드리면 안 됩니다).
 */
export function detectToneViolations(
  content: string,
  title: string = "",
  subheadings: string[] = []
): ToneViolation[] {
  const violations: ToneViolation[] = [];
  const seen = new Set<string>();

  for (const line of content.split("\n")) {
    if (isSkippableLine(line, title, subheadings)) continue;

    for (const sentence of splitSentences(line)) {
      for (const { pattern, reason } of BANNED_PATTERNS) {
        if (pattern.test(sentence)) {
          if (!seen.has(sentence)) {
            seen.add(sentence);
            violations.push({ sentence, reason });
          }
          break; // 한 문장은 한 번만 보고합니다
        }
      }
    }
  }

  return violations;
}

export interface ToneFixResult {
  content: string;
  /** 고치고도 남은 위반 (비어 있으면 전부 해결) */
  remaining: ToneViolation[];
  /** 실제로 고쳐진 문장 수 */
  fixedCount: number;
  /** 고치기 호출에 든 비용 (호출하지 않았으면 null) */
  usage: TokenUsage | null;
}

/**
 * 걸린 문장만 골라 고쳐 씁니다.
 *
 * 글 전체를 다시 생성하지 않고 문장만 교체하므로 출력 토큰이 적게 듭니다.
 * 고치기 자체가 실패하면 원문을 그대로 두고 남은 위반을 보고합니다
 * (돈이 들어간 글을 날리지 않는 쪽을 택합니다).
 */
export async function fixToneViolations(
  content: string,
  violations: ToneViolation[],
  model: string,
  endingRule: "요" | "다"
): Promise<ToneFixResult> {
  if (violations.length === 0) {
    return { content, remaining: [], fixedCount: 0, usage: null };
  }

  const modelName = resolveModel(model, UTILITY_MODEL);

  const prompt = `아래 문장들은 한국어 블로그 글에서 뽑은 것입니다.
모두 **시적·문학적이거나 AI가 쓴 것처럼 보이는 표현**이라 다시 써야 합니다.

규칙:
- 친한 친구에게 말하듯 편하고 구체적으로 쓰세요. 분위기를 묘사하지 말고 사실을 쓰세요.
- 원래 문장에 담긴 사실(장소·사물·행동)은 유지하세요. 새로운 사실을 만들지 마세요.
- 사실이 없고 분위기만 있는 문장이라면, 그 자리에서 할 수 있는 담백한 관찰로 바꾸세요.
- 모든 문장은 반드시 ~~${endingRule} 어미로 끝내세요.
- 비유, 의인화, 추상명사(정취·무드·온기·현장감·여백), 광고투(존재감·돋보여요·자랑해요),
  유보 표현(사진만으로는·확인되지 않아요)을 쓰지 마세요.
- 이모지를 쓰지 마세요.
- 문장 개수를 유지하세요. 한 문장을 한 문장으로 바꿉니다.

예시:
  나쁨: 회색빛 벽돌 건물 사이로 따뜻한 불빛이 보이면 괜히 발걸음이 느려져요.
  좋음: 벽돌 건물이 이어지는 골목이고, 가게 창으로 안이 환하게 보였어요.
  나쁨: 오랜 시간 이 골목을 지켜온 동네 식당 같은 친근함이 느껴졌어요.
  좋음: 오래된 동네 식당 같은 분위기라 들어가기 편했어요.

고칠 문장:
${violations.map((v, idx) => `${idx + 1}. [${v.reason}] ${v.sentence}`).join("\n")}

출력은 아래 JSON 형식만 쓰세요. 설명을 붙이지 마세요.
{"fixed": ["1번을 고친 문장", "2번을 고친 문장"]}`;

  try {
    const response = await openai.chat.completions.create(
      buildChatParams({
        model: modelName,
        messages: [
          {
            role: "system",
            content:
              "당신은 한국어 블로그 글을 담백하고 친근한 구어체로 다듬는 편집자입니다. 시적·문학적 표현과 AI 말투를 걷어내고, 사실 위주의 평범한 말투로 바꿉니다. 요청된 JSON만 출력합니다.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        maxTokens: 4000,
      })
    );

    const raw = response.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.replace(/```json\n?|```/g, "").match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("⚠️ 톤 교정 응답을 해석할 수 없어 원문을 유지합니다");
      return { content, remaining: violations, fixedCount: 0, usage: extractUsage(modelName, response.usage) };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const fixed: unknown[] = Array.isArray(parsed.fixed) ? parsed.fixed : [];

    let result = content;
    let fixedCount = 0;

    violations.forEach((violation, idx) => {
      const replacement = typeof fixed[idx] === "string" ? (fixed[idx] as string).trim() : "";
      // 고친 문장이 여전히 금지 패턴에 걸리면 적용하지 않습니다.
      if (!replacement) return;
      if (BANNED_PATTERNS.some(({ pattern }) => pattern.test(replacement))) {
        console.warn(`⚠️ 교정문이 또 금지 패턴에 걸려 건너뜁니다: ${replacement}`);
        return;
      }
      if (!result.includes(violation.sentence)) return;

      result = result.replace(violation.sentence, replacement);
      fixedCount++;
    });

    return {
      content: result,
      remaining: detectToneViolations(result),
      fixedCount,
      usage: extractUsage(modelName, response.usage),
    };
  } catch (error) {
    console.error("톤 교정 오류(원문 유지):", error);
    return { content, remaining: violations, fixedCount: 0, usage: null };
  }
}
