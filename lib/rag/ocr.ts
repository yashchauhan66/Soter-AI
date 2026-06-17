import { analyzeText } from "../guard/analyze";
import { createWorker, OEM } from "tesseract.js";

export interface OcrInput { content: Buffer; mimeType: string; pageCount?: number; signal?: AbortSignal }
export interface OcrResult { textRedacted: string; confidence: number; provider: string; pageCount: number; durationMs: number }
export interface OcrProvider { extractText(input: OcrInput): Promise<{ text: string; confidence?: number; pageCount?: number }> }

export class TesseractOcrProvider implements OcrProvider {
  async extractText(input: OcrInput) {
    if (input.signal?.aborted) throw new Error("OCR processing was cancelled.");
    if (!input.mimeType.startsWith("image/")) throw new Error("Local Tesseract OCR accepts PNG and JPEG images. Configure a cloud OCR provider for scanned PDFs.");
    const worker = await createWorker(process.env.OCR_LANGUAGES ?? "eng+hin", OEM.LSTM_ONLY, { logger: () => undefined });
    const cancel = () => void worker.terminate();
    input.signal?.addEventListener("abort", cancel, { once: true });
    try {
      const result = await worker.recognize(input.content);
      if (input.signal?.aborted) throw new Error("OCR processing was cancelled.");
      return { text: result.data.text, confidence: result.data.confidence / 100, pageCount: 1 };
    } finally {
      input.signal?.removeEventListener("abort", cancel);
      await worker.terminate().catch((error) => console.error("[CyberRakshak] OCR worker termination failed", error));
    }
  }
}

export async function extractTextWithOcr(input: OcrInput, provider: OcrProvider = new TesseractOcrProvider()): Promise<OcrResult> {
  const started = Date.now();
  const timeoutMs = Number(process.env.OCR_TIMEOUT_MS ?? 30_000);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("OCR processing timed out.")); }, timeoutMs); });
  const result = await Promise.race([provider.extractText({ ...input, signal: controller.signal }), timeout]).finally(() => { if (timer) clearTimeout(timer); });
  const guard = analyzeText(result.text, "INPUT");
  return {
    textRedacted: guard.redactedText ?? result.text,
    confidence: Math.max(0, Math.min(1, result.confidence ?? 0)),
    provider: provider.constructor.name,
    pageCount: result.pageCount ?? input.pageCount ?? 1,
    durationMs: Date.now() - started,
  };
}
