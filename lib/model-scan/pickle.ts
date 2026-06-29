/**
 * Pickle opcode scanner — detects code-execution risk in Python pickle streams
 * (the format behind PyTorch `.pt/.bin/.pth`, joblib, numpy `.npy` object arrays,
 * and HuggingFace `pytorch_model.bin`).
 *
 * A pickle is a small stack VM. The dangerous primitives are:
 *   GLOBAL / STACK_GLOBAL  → import an arbitrary `module.name`
 *   REDUCE / NEWOBJ / INST → call it
 *   BUILD                  → run __setstate__
 * The classic RCE is `GLOBAL os system` + `REDUCE`. We walk the opcode stream,
 * capture every imported `module.name`, and flag dangerous ones. Pure-TS, no deps.
 */

export interface PickleImport {
  module: string;
  name: string;
}

export interface PickleScanResult {
  isPickle: boolean;
  protocol: number | null;
  parsedFully: boolean;
  imports: PickleImport[];
  ops: {
    reduce: boolean;
    build: boolean;
    inst: boolean;
    obj: boolean;
    newobj: boolean;
    persid: boolean;
    ext: boolean;
    global: boolean;
    stackGlobal: boolean;
  };
}

const NL = 0x0a;

function readLine(buf: Buffer, start: number, end: number): { value: string; next: number } {
  let i = start;
  while (i < end && buf[i] !== NL) i++;
  return { value: buf.toString("latin1", start, i), next: Math.min(i + 1, end) };
}

/**
 * Walk a pickle stream from [start, end). Best-effort: if an unknown opcode is
 * hit we stop walking but keep what we found and mark parsedFully=false.
 */
export function scanPickle(buf: Buffer, start = 0, end = buf.length): PickleScanResult {
  const imports: PickleImport[] = [];
  const ops = {
    reduce: false, build: false, inst: false, obj: false,
    newobj: false, persid: false, ext: false, global: false, stackGlobal: false,
  };
  const strstack: string[] = [];
  let protocol: number | null = null;
  let parsedFully = false;
  let isPickle = false;

  let i = start;
  let guard = 0;
  const MAX_OPS = 20_000_000;

  try {
    while (i < end) {
      if (++guard > MAX_OPS) break;
      const op = buf[i];
      i += 1;

      switch (op) {
        // ── framing / no-arg ──
        case 0x80: { protocol = buf[i]; i += 1; isPickle = true; break; } // PROTO
        case 0x95: i += 8; break; // FRAME
        case 0x94: break; // MEMOIZE
        case 0x2e: parsedFully = true; i = end; break; // STOP '.'
        case 0x28: break; // MARK '('
        case 0x30: break; // POP '0'
        case 0x31: break; // POP_MARK '1'
        case 0x32: break; // DUP '2'
        case 0x4e: break; // NONE 'N'
        case 0x88: break; // NEWTRUE
        case 0x89: break; // NEWFALSE
        case 0x29: break; // EMPTY_TUPLE ')'
        case 0x5d: break; // EMPTY_LIST ']'
        case 0x7d: break; // EMPTY_DICT '}'
        case 0x8f: break; // EMPTY_SET
        case 0x61: break; // APPEND 'a'
        case 0x65: break; // APPENDS 'e'
        case 0x73: break; // SETITEM 's'
        case 0x75: break; // SETITEMS 'u'
        case 0x74: break; // TUPLE 't'
        case 0x6c: break; // LIST 'l'
        case 0x64: break; // DICT 'd'
        case 0x90: break; // ADDITEMS
        case 0x91: break; // FROZENSET
        case 0x85: break; // TUPLE1
        case 0x86: break; // TUPLE2
        case 0x87: break; // TUPLE3

        // ── dangerous: imports & calls ──
        case 0x63: { // GLOBAL 'c' module\n name\n
          const m = readLine(buf, i, end); const n = readLine(buf, m.next, end);
          imports.push({ module: m.value, name: n.value });
          ops.global = true; isPickle = true; i = n.next; break;
        }
        case 0x93: { // STACK_GLOBAL — module & name are the two prior strings
          const name = strstack.pop() ?? ""; const module = strstack.pop() ?? "";
          imports.push({ module, name }); ops.stackGlobal = true; break;
        }
        case 0x69: { // INST 'i' module\n class\n
          const m = readLine(buf, i, end); const n = readLine(buf, m.next, end);
          imports.push({ module: m.value, name: n.value });
          ops.inst = true; i = n.next; break;
        }
        case 0x6f: ops.obj = true; break; // OBJ 'o'
        case 0x52: ops.reduce = true; break; // REDUCE 'R'
        case 0x62: ops.build = true; break; // BUILD 'b'
        case 0x81: ops.newobj = true; break; // NEWOBJ
        case 0x92: ops.newobj = true; break; // NEWOBJ_EX
        case 0x50: { const r = readLine(buf, i, end); ops.persid = true; i = r.next; break; } // PERSID 'P'
        case 0x51: ops.persid = true; break; // BINPERSID 'Q'
        case 0x82: ops.ext = true; i += 1; break; // EXT1
        case 0x83: ops.ext = true; i += 2; break; // EXT2
        case 0x84: ops.ext = true; i += 4; break; // EXT4

        // ── strings (track for STACK_GLOBAL) ──
        case 0x8c: { const len = buf[i]; i += 1; strstack.push(buf.toString("latin1", i, i + len)); i += len; break; } // SHORT_BINUNICODE
        case 0x58: { const len = buf.readUInt32LE(i); i += 4; strstack.push(buf.toString("utf8", i, i + len)); i += len; break; } // BINUNICODE 'X'
        case 0x8d: { const len = Number(buf.readBigUInt64LE(i)); i += 8; strstack.push(buf.toString("utf8", i, i + len)); i += len; break; } // BINUNICODE8
        case 0x55: { const len = buf[i]; i += 1; strstack.push(buf.toString("latin1", i, i + len)); i += len; break; } // SHORT_BINSTRING 'U'
        case 0x54: { const len = buf.readUInt32LE(i); i += 4; strstack.push(buf.toString("latin1", i, i + len)); i += len; break; } // BINSTRING 'T'
        case 0x53: { const r = readLine(buf, i, end); strstack.push(r.value); i = r.next; break; } // STRING 'S'
        case 0x56: { const r = readLine(buf, i, end); strstack.push(r.value); i = r.next; break; } // UNICODE 'V'

        // ── bytes ──
        case 0x43: { const len = buf[i]; i += 1 + len; break; } // SHORT_BINBYTES 'C'
        case 0x42: { const len = buf.readUInt32LE(i); i += 4 + len; break; } // BINBYTES 'B'
        case 0x8e: { const len = Number(buf.readBigUInt64LE(i)); i += 8 + len; break; } // BINBYTES8

        // ── numbers ──
        case 0x4b: i += 1; break; // BININT1 'K'
        case 0x4d: i += 2; break; // BININT2 'M'
        case 0x4a: i += 4; break; // BININT 'J'
        case 0x47: i += 8; break; // BINFLOAT 'G'
        case 0x46: { const r = readLine(buf, i, end); i = r.next; break; } // FLOAT 'F'
        case 0x49: { const r = readLine(buf, i, end); i = r.next; break; } // INT 'I'
        case 0x4c: { const r = readLine(buf, i, end); i = r.next; break; } // LONG 'L'
        case 0x8a: { const len = buf[i]; i += 1 + len; break; } // LONG1
        case 0x8b: { const len = buf.readUInt32LE(i); i += 4 + len; break; } // LONG4

        // ── memo ──
        case 0x71: i += 1; break; // BINPUT 'q'
        case 0x72: i += 4; break; // LONG_BINPUT 'r'
        case 0x70: { const r = readLine(buf, i, end); i = r.next; break; } // PUT 'p'
        case 0x68: i += 1; break; // BINGET 'h'
        case 0x6a: i += 4; break; // LONG_BINGET 'j'
        case 0x67: { const r = readLine(buf, i, end); i = r.next; break; } // GET 'g'

        default:
          // Unknown opcode: stop walking, keep findings.
          i = end;
          break;
      }
    }
  } catch {
    // Truncated/garbage tail — keep whatever we captured.
    parsedFully = false;
  }

  return { isPickle, protocol, parsedFully, imports, ops };
}

/** Heuristic detection of whether a buffer region begins like a pickle. */
export function looksLikePickle(buf: Buffer, start = 0): boolean {
  if (buf.length - start < 2) return false;
  // proto 2+ marker
  if (buf[start] === 0x80 && buf[start + 1] >= 0x01 && buf[start + 1] <= 0x05) return true;
  // proto 0/1 commonly begins with GLOBAL 'c', '(' MARK, ']' EMPTY_LIST, '}' EMPTY_DICT
  const c = buf[start];
  return c === 0x63 || c === 0x28 || c === 0x5d || c === 0x7d || c === 0x29;
}
