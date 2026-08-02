/**
 * Faithful BERT WordPiece tokenizer (BasicTokenizer + WordpieceTokenizer).
 *
 * WHY THIS EXISTS:
 *   The v3 ONNX classifier is fine-tuned all-MiniLM-L6-v2, whose tokenizer is a
 *   standard HuggingFace `BertTokenizer` (do_lower_case=true, strip_accents=null
 *   → accents stripped, tokenize_chinese_chars=true, punctuation split into its
 *   own tokens). The previous in-process tokenizer approximated this with a
 *   single regex `replace(/[^\w\s!?'.,;:-]/g, " ")`, which DELETES most
 *   punctuation and mangles non-ASCII text. That produced a DIFFERENT token
 *   sequence in production than the model saw in training, drifting confidence
 *   (measured: an attack scored 0.94 under the real tokenizer but 0.62 under the
 *   regex one) and silently dropping real attacks below the 0.9 escalation floor.
 *
 *   This module reimplements BERT tokenization faithfully so production tokens
 *   match training tokens. Parity is verified against the Python `transformers`
 *   tokenizer by scripts/ml/verify-tokenizer-parity.ts (exact token-id match).
 *
 * Reference: HuggingFace transformers BertTokenizer (BasicTokenizer +
 * WordpieceTokenizer), which this mirrors step for step.
 */

export interface BertTokenizerOptions {
  doLowerCase?: boolean;
  /** null → follow doLowerCase (BERT default); true/false → force. */
  stripAccents?: boolean | null;
  tokenizeChineseChars?: boolean;
  maxLength?: number;
  maxInputCharsPerWord?: number;
}

export interface BertTokenizeResult {
  inputIds: number[];
  attentionMask: number[];
}

// ── Unicode helpers (mirror BERT's _is_* predicates) ──────────────────────────

/** BERT treats the ASCII punctuation ranges as punctuation regardless of the
 *  Unicode category, PLUS anything in Unicode category "P". */
function isPunctuation(cp: number, ch: string): boolean {
  if (
    (cp >= 33 && cp <= 47) ||
    (cp >= 58 && cp <= 64) ||
    (cp >= 91 && cp <= 96) ||
    (cp >= 123 && cp <= 126)
  ) {
    return true;
  }
  return /\p{P}/u.test(ch);
}

/** CJK ideograph ranges used by BERT's _tokenize_chinese_chars. */
function isChineseChar(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x20000 && cp <= 0x2a6df) ||
    (cp >= 0x2a700 && cp <= 0x2b73f) ||
    (cp >= 0x2b740 && cp <= 0x2b81f) ||
    (cp >= 0x2b820 && cp <= 0x2ceaf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x2f800 && cp <= 0x2fa1f)
  );
}

function isControl(cp: number, ch: string): boolean {
  if (ch === "\t" || ch === "\n" || ch === "\r") return false;
  // Unicode categories Cc / Cf / Cs / Co / Cn are treated as control by BERT.
  return /\p{C}/u.test(ch) && cp !== 0x20;
}

function isWhitespace(cp: number, ch: string): boolean {
  if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return true;
  return /\p{Zs}/u.test(ch);
}

export class BertTokenizer {
  private vocab: Map<string, number>;
  private doLowerCase: boolean;
  private stripAccents: boolean | null;
  private tokenizeChineseChars: boolean;
  private maxInputCharsPerWord: number;

  readonly maxLength: number;
  readonly clsTokenId: number;
  readonly sepTokenId: number;
  readonly padTokenId: number;
  readonly unkTokenId: number;

  constructor(vocab: Map<string, number>, options: BertTokenizerOptions = {}) {
    this.vocab = vocab;
    this.doLowerCase = options.doLowerCase ?? true;
    this.stripAccents = options.stripAccents ?? null;
    this.tokenizeChineseChars = options.tokenizeChineseChars ?? true;
    this.maxLength = options.maxLength ?? 128;
    this.maxInputCharsPerWord = options.maxInputCharsPerWord ?? 100;

    this.clsTokenId = vocab.get("[CLS]") ?? 101;
    this.sepTokenId = vocab.get("[SEP]") ?? 102;
    this.padTokenId = vocab.get("[PAD]") ?? 0;
    this.unkTokenId = vocab.get("[UNK]") ?? 100;
  }

  // ── BasicTokenizer ──────────────────────────────────────────────────────────

  private cleanText(text: string): string {
    let out = "";
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp === 0 || cp === 0xfffd || isControl(cp, ch)) continue;
      out += isWhitespace(cp, ch) ? " " : ch;
    }
    return out;
  }

  private tokenizeChinese(text: string): string {
    let out = "";
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (isChineseChar(cp)) out += ` ${ch} `;
      else out += ch;
    }
    return out;
  }

  private stripAccentsFrom(token: string): string {
    // NFD then drop combining marks (Unicode category Mn).
    return token.normalize("NFD").replace(/\p{Mn}/gu, "");
  }

  private splitOnPunctuation(token: string): string[] {
    const chars = Array.from(token);
    const output: string[] = [];
    let startNewWord = true;
    for (const ch of chars) {
      const cp = ch.codePointAt(0)!;
      if (isPunctuation(cp, ch)) {
        output.push(ch);
        startNewWord = true;
      } else {
        if (startNewWord) output.push("");
        startNewWord = false;
        output[output.length - 1] += ch;
      }
    }
    return output.filter((t) => t.length > 0);
  }

  private whitespaceSplit(text: string): string[] {
    return text.trim().split(/\s+/).filter(Boolean);
  }

  private basicTokenize(text: string): string[] {
    let processed = this.cleanText(text);
    if (this.tokenizeChineseChars) processed = this.tokenizeChinese(processed);
    const rawTokens = this.whitespaceSplit(processed);

    const splitTokens: string[] = [];
    for (let token of rawTokens) {
      if (this.doLowerCase) {
        token = token.toLowerCase();
        if (this.stripAccents !== false) token = this.stripAccentsFrom(token);
      } else if (this.stripAccents === true) {
        token = this.stripAccentsFrom(token);
      }
      for (const piece of this.splitOnPunctuation(token)) splitTokens.push(piece);
    }
    return splitTokens;
  }

  // ── WordpieceTokenizer ────────────────────────────────────────────────────────

  private wordpiece(token: string): number[] {
    const chars = Array.from(token);
    if (chars.length > this.maxInputCharsPerWord) return [this.unkTokenId];

    const outputIds: number[] = [];
    let start = 0;
    let isBad = false;
    while (start < chars.length) {
      let end = chars.length;
      let curId: number | undefined;
      while (start < end) {
        let substr = chars.slice(start, end).join("");
        if (start > 0) substr = "##" + substr;
        const id = this.vocab.get(substr);
        if (id !== undefined) {
          curId = id;
          break;
        }
        end--;
      }
      if (curId === undefined) {
        isBad = true;
        break;
      }
      outputIds.push(curId);
      start = end;
    }
    return isBad ? [this.unkTokenId] : outputIds;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Full encode: [CLS] … [SEP] + right padding to maxLength, with mask. */
  tokenize(text: string): BertTokenizeResult {
    const ids: number[] = [this.clsTokenId];
    const budget = this.maxLength - 1; // reserve room for [SEP]
    for (const token of this.basicTokenize(text)) {
      if (ids.length >= budget) break;
      for (const id of this.wordpiece(token)) {
        if (ids.length >= budget) break;
        ids.push(id);
      }
    }
    ids.push(this.sepTokenId);

    const inputIds = [...ids];
    const attentionMask: number[] = [];
    for (let i = 0; i < this.maxLength; i++) {
      if (i < inputIds.length) {
        attentionMask.push(1);
      } else {
        inputIds.push(this.padTokenId);
        attentionMask.push(0);
      }
    }
    return {
      inputIds: inputIds.slice(0, this.maxLength),
      attentionMask: attentionMask.slice(0, this.maxLength),
    };
  }

  /**
   * Content token ids with NO [CLS]/[SEP], NO padding, and NO truncation.
   *
   * tokenize() deliberately truncates to maxLength, which is correct for a single
   * forward pass but means anything past the window is invisible to the model —
   * an injection buried on page 3 of a pasted document scores as whatever the
   * first 256 tokens looked like. Sliding-window inference needs the full stream
   * so it can score every region; this is that stream.
   *
   * Uses the identical basicTokenize -> wordpiece path as tokenize(), so windows
   * are byte-exact with what a truncated pass would have produced for the same
   * span (the HF-parity guarantee in tests/ml is preserved).
   */
  encodeContentIds(text: string): number[] {
    const ids: number[] = [];
    for (const token of this.basicTokenize(text)) {
      for (const id of this.wordpiece(token)) ids.push(id);
    }
    return ids;
  }

  /**
   * Wrap an already-tokenized content slice as a model-ready window:
   * [CLS] slice [SEP], trimmed to the window budget so a caller cannot overflow
   * the tensor shape.
   *
   * `padTo` right-pads to a fixed length (what tokenize() does, for callers that
   * need a static shape). Omitting it returns an exact-length window with an
   * all-ones attention mask — preferred for sliding-window inference, where the
   * sequence axis is dynamic and a shorter tensor is simply cheaper.
   */
  encodeWindow(contentIds: number[], padTo?: number): BertTokenizeResult {
    const body = contentIds.slice(0, Math.max(0, this.windowBudget));
    const inputIds = [this.clsTokenId, ...body, this.sepTokenId];
    const target = padTo ?? inputIds.length;
    const attentionMask: number[] = [];
    for (let i = 0; i < target; i++) {
      if (i < inputIds.length) {
        attentionMask.push(1);
      } else {
        inputIds.push(this.padTokenId);
        attentionMask.push(0);
      }
    }
    return {
      inputIds: inputIds.slice(0, target),
      attentionMask: attentionMask.slice(0, target),
    };
  }

  /** Number of content tokens that fit in one window (excludes [CLS]/[SEP]). */
  get windowBudget(): number {
    return Math.max(1, this.maxLength - 2);
  }
}

/** Parse a HuggingFace vocab.txt (line index = token id). */
export function parseVocabTxt(raw: string): Map<string, number> {
  const vocab = new Map<string, number>();
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    // vocab.txt tokens never contain whitespace; the token is the whole line
    // minus the trailing \r. Do NOT split on whitespace (that corrupts ids).
    const token = lines[i].replace(/\r$/, "");
    if (token.length === 0) continue;
    vocab.set(token, i);
  }
  return vocab;
}
