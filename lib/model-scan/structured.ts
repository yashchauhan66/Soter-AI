const MAX_METADATA_ENTRIES = 10_000;
const MAX_STRING_BYTES = 1_000_000;
const MAX_ARRAY_ITEMS = 100_000;
const MAX_PROTO_DEPTH = 16;
const MAX_PROTO_FIELDS = 1_000_000;

export interface StructuredIssue {
  severity: "MEDIUM" | "HIGH";
  title: string;
  detail: string;
}

export interface GgufSummary {
  version: number;
  tensorCount: number;
  metadataCount: number;
  keys: string[];
  architecture: string | null;
  issues: StructuredIssue[];
}

class Cursor {
  offset = 0;
  constructor(readonly buf: Buffer) {}
  need(bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || this.offset + bytes > this.buf.length) {
      throw new Error("truncated structure");
    }
  }
  u8(): number { this.need(1); return this.buf[this.offset++]; }
  u16(): number { this.need(2); const v = this.buf.readUInt16LE(this.offset); this.offset += 2; return v; }
  u32(): number { this.need(4); const v = this.buf.readUInt32LE(this.offset); this.offset += 4; return v; }
  u64(): number {
    this.need(8);
    const v = this.buf.readBigUInt64LE(this.offset);
    this.offset += 8;
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("integer exceeds safe range");
    return Number(v);
  }
  skip(bytes: number): void { this.need(bytes); this.offset += bytes; }
  string(): string {
    const length = this.u64();
    if (length > MAX_STRING_BYTES) throw new Error("string exceeds size limit");
    this.need(length);
    const value = this.buf.toString("utf8", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
}

function skipGgufValue(cursor: Cursor, type: number, depth = 0): string | null {
  if (depth > 4) throw new Error("GGUF array nesting exceeds limit");
  const sizes: Record<number, number> = {
    0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8,
  };
  if (type === 8) return cursor.string();
  if (type === 9) {
    const itemType = cursor.u32();
    const count = cursor.u64();
    if (count > MAX_ARRAY_ITEMS) throw new Error("GGUF array item count exceeds limit");
    for (let i = 0; i < count; i += 1) skipGgufValue(cursor, itemType, depth + 1);
    return null;
  }
  const size = sizes[type];
  if (!size) throw new Error(`unsupported GGUF value type ${type}`);
  cursor.skip(size);
  return null;
}

export function parseGguf(buf: Buffer): GgufSummary {
  const issues: StructuredIssue[] = [];
  const keys: string[] = [];
  let version = 0;
  let tensorCount = 0;
  let metadataCount = 0;
  let architecture: string | null = null;
  try {
    const cursor = new Cursor(buf);
    cursor.need(4);
    if (buf.toString("latin1", 0, 4) !== "GGUF") throw new Error("invalid GGUF magic");
    cursor.offset = 4;
    version = cursor.u32();
    tensorCount = cursor.u64();
    metadataCount = cursor.u64();
    if (version < 2 || version > 3) {
      issues.push({ severity: "MEDIUM", title: "Unsupported GGUF version", detail: `GGUF version ${version} is not fully supported.` });
    }
    if (metadataCount > MAX_METADATA_ENTRIES) throw new Error("GGUF metadata count exceeds limit");
    const seen = new Set<string>();
    for (let i = 0; i < metadataCount; i += 1) {
      const key = cursor.string();
      if (seen.has(key)) {
        issues.push({ severity: "MEDIUM", title: "Duplicate GGUF metadata key", detail: `Metadata key ${key.slice(0, 200)} occurs more than once.` });
      }
      seen.add(key);
      keys.push(key.slice(0, 200));
      const type = cursor.u32();
      const stringValue = skipGgufValue(cursor, type);
      if (key === "general.architecture" && stringValue) architecture = stringValue.slice(0, 200);
      if (
        stringValue &&
        /(?:chat_template|prompt|template|url|repository)/i.test(key) &&
        /(?:ignore\s+(?:all\s+)?previous|<script|javascript:|(?:curl|wget)\s+https?:|__import__|subprocess|os\.system)/i.test(stringValue)
      ) {
        issues.push({
          severity: "HIGH",
          title: "Suspicious executable or prompt content in GGUF metadata",
          detail: `Metadata key ${key.slice(0, 200)} contains an instruction or code-execution pattern.`,
        });
      }
    }
  } catch (error) {
    issues.push({
      severity: "HIGH",
      title: "Malformed or resource-excessive GGUF metadata",
      detail: error instanceof Error ? error.message : "GGUF parsing failed",
    });
  }
  return { version, tensorCount, metadataCount, keys, architecture, issues };
}

export interface OnnxSummary {
  irVersion: number | null;
  producerName: string | null;
  opsets: Array<{ domain: string; version: number }>;
  operators: string[];
  nodeCount: number;
  issues: StructuredIssue[];
}

export interface SafetensorsSummary {
  tensorCount: number;
  metadataKeys: string[];
  dataBytes: number;
  issues: StructuredIssue[];
}

const SAFETENSORS_DTYPES: Record<string, number> = {
  BOOL: 1, U8: 1, I8: 1, F8_E4M3: 1, F8_E5M2: 1,
  I16: 2, U16: 2, F16: 2, BF16: 2,
  I32: 4, U32: 4, F32: 4,
  I64: 8, U64: 8, F64: 8,
};

export function parseSafetensors(buf: Buffer): SafetensorsSummary {
  const issues: StructuredIssue[] = [];
  const metadataKeys: string[] = [];
  let tensorCount = 0;
  let dataBytes = 0;
  try {
    if (buf.length < 9) throw new Error("safetensors file is shorter than its fixed header");
    const rawHeaderLength = buf.readBigUInt64LE(0);
    if (rawHeaderLength > BigInt(MAX_STRING_BYTES)) throw new Error("safetensors JSON header exceeds the 1 MiB limit");
    const headerLength = Number(rawHeaderLength);
    if (headerLength <= 0 || 8 + headerLength > buf.length) throw new Error("safetensors header length exceeds the file");
    const header = JSON.parse(buf.toString("utf8", 8, 8 + headerLength)) as Record<string, unknown>;
    if (!header || Array.isArray(header) || typeof header !== "object") throw new Error("safetensors header must be an object");
    const payloadBytes = buf.length - 8 - headerLength;
    dataBytes = payloadBytes;
    const ranges: Array<{ start: number; end: number; name: string }> = [];
    for (const [name, raw] of Object.entries(header)) {
      if (name === "__metadata__") {
        if (!raw || Array.isArray(raw) || typeof raw !== "object") throw new Error("__metadata__ must be an object");
        for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
          metadataKeys.push(key.slice(0, 200));
          if (typeof value !== "string") throw new Error("safetensors metadata values must be strings");
          if (
            /(?:prompt|template|url|repository|loader)/i.test(key) &&
            /(?:ignore\s+(?:all\s+)?previous|<script|javascript:|__import__|subprocess|os\.system)/i.test(value)
          ) {
            issues.push({
              severity: "HIGH",
              title: "Suspicious safetensors metadata",
              detail: `Metadata key ${key.slice(0, 200)} contains an instruction or code-execution pattern.`,
            });
          }
        }
        continue;
      }
      tensorCount += 1;
      if (tensorCount > 100_000) throw new Error("safetensors tensor count exceeds limit");
      if (!raw || Array.isArray(raw) || typeof raw !== "object") throw new Error(`tensor ${name.slice(0, 100)} has an invalid descriptor`);
      const tensor = raw as Record<string, unknown>;
      const dtype = String(tensor.dtype ?? "");
      const width = SAFETENSORS_DTYPES[dtype];
      const shape = tensor.shape;
      const offsets = tensor.data_offsets;
      if (!width || !Array.isArray(shape) || !Array.isArray(offsets) || offsets.length !== 2) {
        throw new Error(`tensor ${name.slice(0, 100)} has an invalid dtype, shape, or data_offsets`);
      }
      let elements = 1;
      for (const dimension of shape) {
        if (!Number.isSafeInteger(dimension) || (dimension as number) < 0) throw new Error(`tensor ${name.slice(0, 100)} has an invalid shape`);
        elements *= dimension as number;
        if (!Number.isSafeInteger(elements)) throw new Error(`tensor ${name.slice(0, 100)} shape exceeds safe range`);
      }
      const [start, end] = offsets as number[];
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > payloadBytes) {
        throw new Error(`tensor ${name.slice(0, 100)} has out-of-bounds data offsets`);
      }
      if (end - start !== elements * width) throw new Error(`tensor ${name.slice(0, 100)} byte range does not match its dtype and shape`);
      ranges.push({ start, end, name });
    }
    ranges.sort((a, b) => a.start - b.start);
    for (let i = 1; i < ranges.length; i += 1) {
      if (ranges[i].start < ranges[i - 1].end) throw new Error(`tensor ${ranges[i].name.slice(0, 100)} overlaps another tensor`);
    }
  } catch (error) {
    issues.push({
      severity: "HIGH",
      title: "Malformed or resource-excessive safetensors structure",
      detail: error instanceof Error ? error.message : "Safetensors parsing failed",
    });
  }
  return { tensorCount, metadataKeys, dataBytes, issues };
}

function readVarint(buf: Buffer, state: { offset: number }, end: number): number {
  let value = 0;
  let shift = 0;
  for (let i = 0; i < 10; i += 1) {
    if (state.offset >= end) throw new Error("truncated protobuf varint");
    const byte = buf[state.offset++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) {
      if (!Number.isSafeInteger(value)) throw new Error("protobuf integer exceeds safe range");
      return value;
    }
    shift += 7;
  }
  throw new Error("protobuf varint exceeds 10 bytes");
}

function walkMessage(
  buf: Buffer,
  start: number,
  end: number,
  depth: number,
  visit: (field: number, wire: number, valueStart: number, valueEnd: number, numeric: number | null) => void,
): void {
  if (depth > MAX_PROTO_DEPTH) throw new Error("protobuf nesting exceeds limit");
  const state = { offset: start };
  let fields = 0;
  while (state.offset < end) {
    if (++fields > MAX_PROTO_FIELDS) throw new Error("protobuf field count exceeds limit");
    const tag = readVarint(buf, state, end);
    const field = Math.floor(tag / 8);
    const wire = tag & 7;
    if (field === 0) throw new Error("invalid protobuf field zero");
    if (wire === 0) {
      const valueStart = state.offset;
      const numeric = readVarint(buf, state, end);
      visit(field, wire, valueStart, state.offset, numeric);
    } else if (wire === 1) {
      const valueStart = state.offset; state.offset += 8;
      if (state.offset > end) throw new Error("truncated fixed64");
      visit(field, wire, valueStart, state.offset, null);
    } else if (wire === 2) {
      const length = readVarint(buf, state, end);
      const valueStart = state.offset;
      const valueEnd = valueStart + length;
      if (length > buf.length || valueEnd > end) throw new Error("invalid protobuf length");
      state.offset = valueEnd;
      visit(field, wire, valueStart, valueEnd, null);
    } else if (wire === 5) {
      const valueStart = state.offset; state.offset += 4;
      if (state.offset > end) throw new Error("truncated fixed32");
      visit(field, wire, valueStart, state.offset, null);
    } else {
      throw new Error(`unsupported protobuf wire type ${wire}`);
    }
  }
}

function utf8(buf: Buffer, start: number, end: number): string {
  if (end - start > MAX_STRING_BYTES) throw new Error("protobuf string exceeds limit");
  return buf.toString("utf8", start, end);
}

export function parseOnnx(buf: Buffer): OnnxSummary {
  const issues: StructuredIssue[] = [];
  const operators: string[] = [];
  const opsets: Array<{ domain: string; version: number }> = [];
  let irVersion: number | null = null;
  let producerName: string | null = null;
  let nodeCount = 0;
  try {
    walkMessage(buf, 0, buf.length, 0, (field, wire, start, end, numeric) => {
      if (field === 1 && wire === 0) irVersion = numeric;
      if (field === 2 && wire === 2) producerName = utf8(buf, start, end).slice(0, 200);
      // ModelProto.graph = field 7.
      if (field === 7 && wire === 2) {
        walkMessage(buf, start, end, 1, (graphField, graphWire, ns, ne) => {
          // GraphProto.node = field 1.
          if (graphField !== 1 || graphWire !== 2) return;
          nodeCount += 1;
          if (nodeCount > 1_000_000) throw new Error("ONNX node count exceeds limit");
          let op = "";
          let domain = "";
          walkMessage(buf, ns, ne, 2, (nodeField, nodeWire, vs, ve) => {
            if (nodeWire !== 2) return;
            if (nodeField === 4) op = utf8(buf, vs, ve);
            if (nodeField === 7) domain = utf8(buf, vs, ve);
          });
          const qualified = domain ? `${domain}:${op}` : op;
          if (qualified) operators.push(qualified.slice(0, 300));
        });
      }
      // ModelProto.opset_import = field 8.
      if (field === 8 && wire === 2) {
        let domain = "";
        let version = 0;
        walkMessage(buf, start, end, 1, (opField, opWire, vs, ve, opNumeric) => {
          if (opField === 1 && opWire === 2) domain = utf8(buf, vs, ve);
          if (opField === 2 && opWire === 0) version = opNumeric ?? 0;
        });
        opsets.push({ domain: domain.slice(0, 200), version });
      }
    });
    const suspicious = operators.filter((op) =>
      /(?:^|:)(?:PyOp|PythonOp|Shell|Exec|System|Eval)$/i.test(op) ||
      /(?:^|\.)(?:pytorch|python|experimental)(?:\.|:)/i.test(op),
    );
    if (suspicious.length) {
      issues.push({
        severity: "HIGH",
        title: "Suspicious custom ONNX operators",
        detail: `Potential code-bearing custom operators: ${suspicious.slice(0, 10).join(", ")}.`,
      });
    }
    if (nodeCount === 0) {
      issues.push({ severity: "MEDIUM", title: "ONNX graph has no nodes", detail: "No GraphProto nodes could be parsed." });
    }
  } catch (error) {
    issues.push({
      severity: "HIGH",
      title: "Malformed or resource-excessive ONNX protobuf",
      detail: error instanceof Error ? error.message : "ONNX parsing failed",
    });
  }
  return {
    irVersion,
    producerName,
    opsets: opsets.slice(0, 1000),
    operators: operators.slice(0, 10_000),
    nodeCount,
    issues,
  };
}
