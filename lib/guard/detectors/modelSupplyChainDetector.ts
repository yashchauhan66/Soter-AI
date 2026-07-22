import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  {
    pattern:
      /(?:model|checkpoint|weights|adapter|lora|gguf|safetensors|onnx|pickle|pkl)[\s\S]{0,200}(?:backdoor|trojan|poisoned|malicious|untrusted|remote code|postinstall|eval|exec)/i,
    label: "Model supply-chain risk",
    message: "Model artifact or dependency text indicates a supply-chain compromise risk.",
    severity: "HIGH",
    score: 50,
  },
  {
    pattern:
      /(?:download|load|install|import)[\s\S]{0,120}(?:unverified|unknown|third-party|random|external)[\s\S]{0,120}(?:model|weights|checkpoint|adapter|pipeline)/i,
    label: "Unverified model artifact",
    message: "The request attempts to load an unverified model artifact into the AI runtime.",
    severity: "MEDIUM",
    score: 40,
  },
];

export function modelSupplyChainDetector(text: string) {
  return detectPatterns(text, "MODEL_SUPPLY_CHAIN", rules);
}
