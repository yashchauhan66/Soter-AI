import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  // ── Pickle / Python deserialization ──────────────────────────────────
  {
    pattern: /(?:pickle\.loads?|cPickle\.loads?|shelve\.open|marshal\.loads?)\s*\(/i,
    label: "Python pickle deserialization",
    message: "Reference to Python pickle/marshal deserialization — a known RCE vector in ML pipelines.",
    severity: "CRITICAL",
    score: 50,
  },
  {
    pattern: /(?:torch\.load|joblib\.load|numpy\.load)\s*\(.{0,120}(?:allow_pickle|weights_only\s*=\s*False)/i,
    label: "Unsafe ML model loading",
    message: "ML model loading with unsafe deserialization flags enabled.",
    severity: "CRITICAL",
    score: 50,
  },
  {
    pattern: /(?:__reduce__|__reduce_ex__|__getstate__|__setstate__)\s*(?:\(|=)/i,
    label: "Pickle magic method exploit",
    message: "References pickle magic methods used for arbitrary code execution during deserialization.",
    severity: "CRITICAL",
    score: 50,
  },

  // ── YAML unsafe load ────────────────────────────────────────────────
  {
    pattern: /yaml\.(?:unsafe_load|full_load|load)\s*\(/i,
    label: "Unsafe YAML deserialization",
    message: "Unsafe YAML loading can execute arbitrary Python objects via tags like !!python/object.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /!!python\/(?:object|module|apply|name|import)/i,
    label: "YAML Python object tag",
    message: "YAML tag that instantiates arbitrary Python objects during deserialization.",
    severity: "CRITICAL",
    score: 50,
  },

  // ── JSON prototype pollution / injection ────────────────────────────
  {
    pattern: /"__proto__"\s*:/i,
    label: "JSON prototype pollution",
    message: "Prototype pollution payload in JSON — can modify object behavior at runtime.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /"constructor"\s*:\s*\{\s*"prototype"/i,
    label: "Constructor prototype injection",
    message: "Constructor-based prototype pollution attack in serialized data.",
    severity: "HIGH",
    score: 40,
  },

  // ── Java / JVM deserialization ──────────────────────────────────────
  {
    pattern: /(?:ObjectInputStream|readObject|readResolve|readExternal)\s*\(/i,
    label: "Java deserialization sink",
    message: "Java ObjectInputStream deserialization — a common RCE gadget chain entry point.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /(?:ysoserial|CommonsCollections|InvokerTransformer|ConstantTransformer|ChainedTransformer)/i,
    label: "Java deserialization gadget",
    message: "Reference to known Java deserialization gadget chains (ysoserial).",
    severity: "CRITICAL",
    score: 50,
  },
  {
    pattern: /(?:rO0AB|aced0005)/i,
    label: "Serialized Java object magic bytes",
    message: "Java serialized object magic bytes detected — potential deserialization payload.",
    severity: "HIGH",
    score: 40,
  },

  // ── .NET deserialization ────────────────────────────────────────────
  {
    pattern: /(?:BinaryFormatter|SoapFormatter|NetDataContractSerializer|LosFormatter|ObjectStateFormatter)\.(?:Deserialize|UnsafeDeserialize)\s*\(/i,
    label: ".NET unsafe deserialization",
    message: "Unsafe .NET deserialization via BinaryFormatter or similar — a known RCE vector.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /TypeNameHandling\s*[=:]\s*(?:All|Auto|Objects|Arrays)/i,
    label: "JSON.NET unsafe TypeNameHandling",
    message: "JSON.NET TypeNameHandling set to a mode that allows arbitrary type instantiation.",
    severity: "HIGH",
    score: 40,
  },

  // ── PHP deserialization ─────────────────────────────────────────────
  {
    pattern: /(?:unserialize|maybe_unserialize)\s*\(\s*\$(?:_(?:GET|POST|REQUEST|COOKIE)|input|data|body|payload)/i,
    label: "PHP unserialize from user input",
    message: "PHP unserialize() called on user-controlled input — object injection risk.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /O:\d+:"[^"]+":[\d]+:\{/i,
    label: "PHP serialized object literal",
    message: "PHP serialized object notation detected — potential deserialization injection payload.",
    severity: "HIGH",
    score: 40,
  },

  // ── Node.js / JS deserialization ────────────────────────────────────
  {
    pattern: /(?:node-serialize|serialize-javascript|funcster)\.(?:unserialize|deserialize)\s*\(/i,
    label: "Node.js unsafe deserialize",
    message: "Node.js deserialization library that can execute arbitrary functions.",
    severity: "CRITICAL",
    score: 50,
  },
  {
    pattern: /\{"rce":\s*"_\$\$ND_FUNC\$\$_/i,
    label: "node-serialize RCE payload",
    message: "node-serialize RCE payload marker ($$ND_FUNC$$) detected.",
    severity: "CRITICAL",
    score: 50,
  },

  // ── Generic deserialization intent ──────────────────────────────────
  {
    pattern: /(?:deserializ|unserializ|unmarshal)\w*\s+(?:this|the|user|untrusted|external|arbitrary|raw)\s+(?:input|data|payload|object|content|request|body)/i,
    label: "Deserialize untrusted data",
    message: "Instruction to deserialize untrusted or user-controlled data without validation.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /(?:load|parse|decode|import)\s+(?:the )?(?:serialized|pickled|marshalled|binary)\s+(?:model|object|data|payload|file|weights)\s+(?:from|without)\s+(?:the url|user|external|untrusted|any source|verification|validation)/i,
    label: "Load serialized from untrusted source",
    message: "Loading serialized data from an untrusted source without validation.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /(?:disable|skip|bypass|remove|ignore)\s+(?:the )?(?:deserialization|serialization|type)\s+(?:check|filter|validation|verification|whitelist|allowlist|safeguard)/i,
    label: "Deserialization safety bypass",
    message: "Attempt to disable deserialization safety checks or type validation.",
    severity: "HIGH",
    score: 40,
  },
];

export function insecureDeserializationDetector(text: string) {
  return detectPatterns(text, "PROMPT_INJECTION", rules);
}
