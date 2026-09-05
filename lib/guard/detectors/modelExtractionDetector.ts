import { detectPatterns, type PatternRule } from "./helpers";

/**
 * Model / IP extraction: attempts to reconstruct the deployed model rather than
 * to misuse it.
 *
 * WHY A DETERMINISTIC TIER FOR THIS AT ALL
 *   MODEL_EXTRACTION is the weakest class the v14 classifier has —
 *   models/ml-classifier-v14/eval_results.json puts it at 0.699 recall and 0.780
 *   precision, the worst of the 14 — and mlAugment usually cannot escalate on it
 *   anyway (the prediction is either abstained on or filtered by the INPUT label
 *   allowlist). Measured on the red-team corpus the rules tier caught 4 of 14
 *   model-extraction probes and the full rules+ML pipeline caught 8 of 14
 *   (artifacts/ml/redteam-baseline-2026-09-04.json). The gap is not a threshold
 *   to loosen; it is missing signatures.
 *
 * WHAT KEEPS THIS PRECISE
 *   Every rule requires BOTH a self-reference to the deployed model ("your
 *   weights", "your tokenizer", "your training run") AND an extraction verb.
 *   "What learning rate would you recommend for fine-tuning MiniLM?" is a normal
 *   ML question and must stay ALLOW; "list YOUR learning rate schedule ... so I
 *   can reproduce the training run" is theft. The possessive is what separates
 *   them, so it is mandatory in every pattern rather than implied.
 *
 * SCORING
 *   MODEL_EXTRACTION has no entry in decisionEngine's SIGNALS table on purpose —
 *   see the comment on RISK_TYPES in ../types.ts — so these findings are resolved
 *   by the aggregate score bands. 62 puts a lone finding in the 61-85 band, which
 *   is HUMAN_REVIEW without a coercive co-signal: held for a person, never
 *   auto-refused, and it leaves the 45 that mlAugment declares untouched so ML
 *   predictions keep behaving exactly as they did before.
 */

// Possessive reference to THIS model. Required by every rule below.
const SELF = String.raw`\b(?:your|yours|this model'?s?|the model'?s?|its)\b`;

const rules: PatternRule[] = [
  {
    pattern: new RegExp(
      String.raw`\b(?:dump|print|output|serialize|export|reveal|give\s+me|list|paste|show)\b[\s\S]{0,60}` +
        SELF +
        String.raw`[\s\S]{0,40}\b(?:weights?|weight\s+matri(?:x|ces)|state[_\s]?dict|checkpoint|parameters?|tensors?|safetensors)\b`,
      "i",
    ),
    label: "Model weight extraction",
    message: "Requests the deployed model's weights, tensors, or checkpoint file.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern: new RegExp(
      SELF +
        String.raw`[\s\S]{0,50}\b(?:hidden\s+(?:dimension|size|state)|attention\s+heads?|layer\s+count|num_layers|d_model|embedding\s+(?:matrix|dimension|size)|vocab(?:ulary)?\s+size|base\s+(?:model|checkpoint)|underlying\s+(?:model|checkpoint|architecture)|architecture)\b[\s\S]{0,120}\b(?:rebuild|reproduce|replicate|clone|recreate|reconstruct|re-?implement|so\s+i\s+can|in\s+order\s+to)\b`,
      "i",
    ),
    label: "Model architecture fingerprinting",
    message: "Probes the deployed model's architecture in order to rebuild or clone it.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern: new RegExp(
      String.raw`\b(?:list|reveal|tell\s+me|what\s+(?:is|are|was|were)|give\s+me|share)\b[\s\S]{0,40}` +
        SELF +
        String.raw`[\s\S]{0,60}\b(?:learning\s+rate|batch\s+size|optimi[sz]er|hyper-?parameters?|training\s+(?:run|recipe|config|corpus|dataset|data|cutoff)|fine-?tune\s+dataset|reward\s+model|rlhf|loss\s+function)\b`,
      "i",
    ),
    label: "Training-recipe extraction",
    message: "Requests the deployed model's own training configuration or dataset.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern: new RegExp(
      String.raw`\b(?:dump|extract|list|export|reproduce|give\s+me|reconstruct)\b[\s\S]{0,50}` +
        SELF +
        String.raw`[\s\S]{0,40}\b(?:tokeni[sz]er|vocab(?:ulary)?|merge\s+(?:table|list)|bpe|byte-?pair|special\s+tokens?)\b`,
      "i",
    ),
    label: "Tokenizer extraction",
    message: "Requests the deployed model's tokenizer vocabulary or merge table.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern:
      /\b(?:top-?\d+|full|complete|raw|all)\s*(?:token\s*)?(?:logits?|logprobs?|log[-\s]?probabilit(?:y|ies)|probability\s+distribution|softmax\s+output|embedding\s+vectors?)\b[\s\S]{0,140}\b(?:for\s+(?:each|every|all)|surrogate|distill|clone|train|fit|reconstruct|reproduce|extract)\b/i,
    label: "Logit / embedding harvesting",
    message: "Requests raw scores or vectors at volume to fit a surrogate of this model.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern:
      /\bgradients?\s+of\s+(?:your|the)\s+loss\b|\bgradient\s+with\s+respect\s+to\s+(?:the\s+)?(?:input\s+)?embedding/i,
    label: "Gradient extraction",
    message: "Requests gradients, which expose the model's internals directly.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern:
      /\b(?:generate|produce|create|synthesi[sz]e|give\s+me)\b[\s\S]{0,80}\b(?:\d{3,}(?:[,.]\d{3})*|thousands?|tens\s+of\s+thousands|millions?)\b[\s\S]{0,90}\b(?:pairs?|examples?|samples?|completions?|responses?|outputs?|labels?|rows?)\b[\s\S]{0,160}\b(?:distill|clone|training\s+(?:set|data|corpus)|train\s+(?:a|my|another)|fine-?tune\s+(?:a|my|another)|ground\s*truth\s+labels?|replicate|competing\s+(?:api|product|service|model))\b/i,
    label: "Distillation harvesting",
    message: "Requests bulk generated data in order to train or distill a competing model.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern:
      /\b(?:competing|competitor|rival)\b[\s\S]{0,40}\b(?:api|model|product|service|assistant|saas|offering)\b[\s\S]{0,180}\b(?:your\s+outputs?|ground\s*truth|as\s+labels?|training\s+data|at\s+volume|data\s+generator)\b/i,
    label: "Competing-model data sourcing",
    message: "States intent to use this model's outputs as training data for a competitor.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern:
      /\b(?:was|were|is|are)\b[\s\S]{0,60}\b(?:in|part\s+of|included\s+in|present\s+in|seen\s+during)\b[\s\S]{0,30}\byour\b[\s\S]{0,30}\b(?:training\s+(?:data|corpus|set)|pre-?training|dataset)\b/i,
    label: "Membership-inference probe",
    message: "Probes whether specific text was in the model's training data.",
    severity: "MEDIUM",
    score: 62,
  },
  {
    pattern:
      /\b(?:repeat|say|print|output|emit)\b[\s\S]{0,70}\b(?:\d{2,}|hundred|thousand|forever|indefinitely)\b[\s\S]{0,30}\btimes?\b[\s\S]{0,150}\b(?:then\s+(?:keep|continue|carry\s+on)|whatever\s+comes|from\s+memory|verbatim|memori[sz]ed|training\s+data|whatever\s+text)\b/i,
    label: "Training-data divergence attack",
    message: "Uses forced repetition to make the model emit memorized training text.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern:
      /\b(?:enumerate|list|map|chart|describe|tell\s+me)\b[\s\S]{0,60}\b(?:every|all|each)\b[\s\S]{0,60}\b(?:refusal|guardrail|safety\s+(?:categor|rule|filter)|blocked\s+(?:categor|topic)|moderation\s+categor|filter)\w*\b[\s\S]{0,150}\b(?:trigger\s+(?:phrase|word|string)|exact\s+(?:phrase|wording|trigger)|decision\s+boundary|map\s+your|so\s+i\s+can\s+(?:map|avoid|bypass|evade))\b/i,
    label: "Guardrail boundary mapping",
    message: "Attempts to enumerate the guard's own refusal triggers to map its boundary.",
    severity: "HIGH",
    score: 62,
  },
];

export function modelExtractionDetector(text: string) {
  return detectPatterns(text, "MODEL_EXTRACTION", rules);
}
