import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  // ── RAG Poisoning attempts ────────────────────────────────────────────
  { pattern: /(?:add|inject|insert|embed)\s+(?:this|the following|my)\s+[\w\s]{0,40}(?:into the|into your)\s+(?:knowledge base|vector store|embeddings?|retrieval system|document store)/i, label: "RAG store injection", message: "Attempt to inject content into a RAG knowledge base or vector store.", severity: "CRITICAL", score: 50 },
  { pattern: /(?:store|save|remember|memorize)\s+(?:this fact|this information|this rule|these instructions)\s+(?:for future|for later|permanently|always)/i, label: "Persistent fact injection", message: "Attempt to persistently store injected facts or rules for future retrieval.", severity: "CRITICAL", score: 50 },
  { pattern: /(?:update|modify|change|edit)\s+(?:your knowledge|the database|the embeddings?|the index|the documents)\s+(?:to|so that|with|by)/i, label: "Knowledge base modification", message: "Attempt to modify stored knowledge or embeddings.", severity: "HIGH", score: 40 },

  // ── Adversarial embedding manipulation ────────────────────────────────
  { pattern: /(\b\w{3,}\b)(?:\s+\1){4,}/i, label: "Keyword repetition stuffing", message: "Excessive keyword repetition detected — may attempt to dominate embedding similarity scores.", severity: "HIGH", score: 40 },
  { pattern: /(?:this document|this text|this content)\s+(?:should rank|must appear|needs to be|should be)\s+(?:first|highest|top|above all|number one|most relevant)/i, label: "Ranking manipulation", message: "Attempt to manipulate document ranking or retrieval priority.", severity: "HIGH", score: 40 },
  { pattern: /(?:override|replace|supersede)\s+(?:existing|current|stored|previous)\s+(?:knowledge|information|documents?|embeddings?|data|facts)/i, label: "Knowledge override", message: "Attempt to override existing stored knowledge or embeddings.", severity: "HIGH", score: 40 },

  // ── Context window poisoning ──────────────────────────────────────────
  { pattern: /(?:when|if)\s+(?:someone|a user|anyone|they|the user)\s+(?:asks? about|searches? for|quer(?:ies|y)|looks? (?:up|for))\s+["']?[\w\s]{2,40}["']?\s*[,;:—–-]\s*(?:respond|answer|reply|say|return|give|output)/i, label: "Retrieval trigger injection", message: "Attempt to inject conditional responses triggered by specific queries.", severity: "CRITICAL", score: 50 },
  { pattern: /(?:always|whenever|every time|each time)\s+(?:this topic|this question|this query|this subject)\s+(?:comes up|is asked|appears|is mentioned|is raised)\s*[,;:—–-]\s*(?:respond|answer|reply|say|return|give|output)/i, label: "Persistent response injection", message: "Attempt to inject persistent responses for specific topics.", severity: "CRITICAL", score: 50 },
  { pattern: /(?:associate|link|connect|bind|map)\s+(?:this content|this answer|this response|this text|this information)\s+(?:with|to)\s+(?:any |all )?(?:quer(?:ies|y)|search(?:es)?|questions?|prompts?|requests?)\s+(?:about|for|containing|related to|mentioning)/i, label: "Query-content binding", message: "Attempt to associate injected content with specific retrieval queries.", severity: "HIGH", score: 40 },

  // ── Document injection ────────────────────────────────────────────────
  { pattern: /(?:index|store|cache|embed)\s+(?:this|the following)\s+(?:as|into)\s+(?:a |an )?(?:trusted|authoritative|verified|official|reliable)\s+(?:source|document|reference|record)/i, label: "False authority injection", message: "Attempt to inject content as a trusted or authoritative source.", severity: "CRITICAL", score: 50 },
  { pattern: /(?:add to|append to|include in|insert into)\s+(?:the context|the retrieval|the search results|the knowledge|the corpus|the collection)/i, label: "Context append injection", message: "Attempt to append malicious content into retrieval context.", severity: "HIGH", score: 40 },
  { pattern: /(?:this is a|this is an)\s+(?:trusted|authoritative|verified|official|canonical)\s+(?:source|document|reference|fact|record)[\s\S]{0,80}(?:store|embed|index|add|remember|save|include)/i, label: "Trusted source claim + store", message: "Claims authority status while requesting storage into the knowledge base.", severity: "CRITICAL", score: 50 },

  // ── Similarity manipulation ───────────────────────────────────────────
  { pattern: /(?:make this|ensure this|this (?:text|content|document) (?:should|must|needs to))\s+(?:be |become |appear )?(?:similar to|close to|match|align with|semantically close to)\s+["']?[\w\s]{2,60}["']?/i, label: "Similarity score manipulation", message: "Attempt to manipulate embedding similarity to target specific content.", severity: "HIGH", score: 40 },
  { pattern: /(?:increase the|boost the|raise the|maximize the)\s+(?:relevance|similarity|cosine|score|rank(?:ing)?|weight)\s+(?:of this|for this|of the|between)/i, label: "Relevance score boosting", message: "Attempt to artificially boost relevance or similarity scores.", severity: "HIGH", score: 40 },
  { pattern: /(?:embed(?:ding)?|vector)\s+(?:space|distance|proximity|similarity)\s+(?:should|must|needs to)\s+(?:be|show|reflect|indicate)\s+(?:high|close|maximum|strong|near)/i, label: "Embedding space manipulation", message: "Direct attempt to manipulate embedding vector space positioning.", severity: "HIGH", score: 40 },
];

export function embeddingPoisoningDetector(text: string) {
  return detectPatterns(text, "PROMPT_INJECTION", rules);
}
