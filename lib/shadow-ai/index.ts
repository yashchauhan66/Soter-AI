// SECURITY: Shadow AI Scanner — discovers AI providers, models, SDKs, tools, and
// plugins being used across the organization. All scan results are stored with
// redacted evidence. Raw API keys and secrets are never persisted.
//
// The scanner detects:
//   - Known AI/LLM providers (OpenAI, Anthropic, Google, etc.)
//   - Open-source model usage (Llama, Mistral, etc.)
//   - AI SDKs and client libraries
//   - MCP servers, plugins, and tool integrations
//   - Unauthorized or shadow AI usage patterns

import { randomUUID } from "crypto";
import { db } from "../db";

// ── Known provider signatures ─────────────────────────────────────────────────

export interface ProviderSignature {
  name: string;
  providerType: string;
  domain: string;
  riskLevel: string;
  dataRegion: string;
  apiKeyPattern?: RegExp;
  sdkPatterns: Array<{ pattern: string; label: string }>;
  modelPatterns?: Array<{ name: string; modality: string }>;
}

export const KNOWN_AI_PROVIDERS: ProviderSignature[] = [
  {
    name: "OpenAI",
    providerType: "CLOUD",
    domain: "api.openai.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    apiKeyPattern: /sk-[A-Za-z0-9]{32,}/,
    sdkPatterns: [
      { pattern: "openai", label: "OpenAI SDK" },
      { pattern: "@openai", label: "OpenAI Node SDK" },
    ],
    modelPatterns: [
      { name: "gpt-4", modality: "TEXT" },
      { name: "gpt-4o", modality: "TEXT" },
      { name: "gpt-4o-mini", modality: "TEXT" },
      { name: "gpt-3.5-turbo", modality: "TEXT" },
      { name: "o1", modality: "TEXT" },
      { name: "o1-mini", modality: "TEXT" },
      { name: "o3-mini", modality: "TEXT" },
      { name: "dall-e-3", modality: "IMAGE" },
      { name: "text-embedding-3", modality: "EMBEDDING" },
      { name: "whisper-1", modality: "AUDIO" },
      { name: "tts-1", modality: "AUDIO" },
    ],
  },
  {
    name: "Anthropic",
    providerType: "CLOUD",
    domain: "api.anthropic.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    apiKeyPattern: /sk-ant-[A-Za-z0-9]{32,}/,
    sdkPatterns: [
      { pattern: "@anthropic-ai", label: "Anthropic SDK" },
      { pattern: "anthropic", label: "Anthropic SDK" },
    ],
    modelPatterns: [
      { name: "claude-3", modality: "TEXT" },
      { name: "claude-3.5", modality: "TEXT" },
      { name: "claude-4", modality: "TEXT" },
      { name: "claude-opus", modality: "TEXT" },
      { name: "claude-sonnet", modality: "TEXT" },
      { name: "claude-haiku", modality: "TEXT" },
    ],
  },
  {
    name: "Google AI",
    providerType: "CLOUD",
    domain: "generativelanguage.googleapis.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "@google/generative-ai", label: "Google Generative AI SDK" },
      { pattern: "googleapis", label: "Google Cloud AI SDK" },
      { pattern: "@google-ai", label: "Google AI SDK" },
    ],
    modelPatterns: [
      { name: "gemini-2.0", modality: "TEXT" },
      { name: "gemini-1.5", modality: "TEXT" },
      { name: "gemini-1.0", modality: "TEXT" },
      { name: "gemini-pro", modality: "TEXT" },
      { name: "gemini-flash", modality: "TEXT" },
      { name: "imagen", modality: "IMAGE" },
    ],
  },
  {
    name: "Amazon Bedrock",
    providerType: "CLOUD",
    domain: "bedrock-runtime.amazonaws.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "@aws-sdk/client-bedrock-runtime", label: "AWS Bedrock SDK" },
      { pattern: "aws-sdk", label: "AWS SDK" },
    ],
    modelPatterns: [
      { name: "claude-v3", modality: "TEXT" },
      { name: "titan-text", modality: "TEXT" },
      { name: "titan-embedding", modality: "EMBEDDING" },
      { name: "amazon-nova", modality: "TEXT" },
      { name: "stability-stable-diffusion", modality: "IMAGE" },
      { name: "llama2", modality: "TEXT" },
    ],
  },
  {
    name: "Azure OpenAI",
    providerType: "CLOUD",
    domain: "openai.azure.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "@azure/openai", label: "Azure OpenAI SDK" },
      { pattern: "azure-ai", label: "Azure AI SDK" },
    ],
    modelPatterns: [
      { name: "gpt-4", modality: "TEXT" },
      { name: "gpt-35-turbo", modality: "TEXT" },
      { name: "dall-e", modality: "IMAGE" },
      { name: "whisper", modality: "AUDIO" },
    ],
  },
  {
    name: "Meta Llama",
    providerType: "OPEN_SOURCE",
    domain: "llama.meta.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "llama-cpp", label: "llama.cpp" },
      { pattern: "@meta-llama", label: "Meta Llama SDK" },
    ],
    modelPatterns: [
      { name: "llama-3", modality: "TEXT" },
      { name: "llama-2", modality: "TEXT" },
      { name: "codellama", modality: "CODE" },
      { name: "llama-guard", modality: "TEXT" },
    ],
  },
  {
    name: "Mistral AI",
    providerType: "CLOUD",
    domain: "api.mistral.ai",
    riskLevel: "MEDIUM",
    dataRegion: "EU",
    sdkPatterns: [
      { pattern: "@mistralai", label: "Mistral SDK" },
      { pattern: "mistralai", label: "Mistral Python SDK" },
    ],
    modelPatterns: [
      { name: "mistral-large", modality: "TEXT" },
      { name: "mistral-small", modality: "TEXT" },
      { name: "mixtral", modality: "TEXT" },
      { name: "codestral", modality: "CODE" },
    ],
  },
  {
    name: "Cohere",
    providerType: "CLOUD",
    domain: "api.cohere.ai",
    riskLevel: "MEDIUM",
    dataRegion: "CA",
    sdkPatterns: [
      { pattern: "cohere-ai", label: "Cohere SDK" },
    ],
    modelPatterns: [
      { name: "command-r", modality: "TEXT" },
      { name: "command", modality: "TEXT" },
      { name: "embed-english", modality: "EMBEDDING" },
    ],
  },
  {
    name: "Hugging Face",
    providerType: "PLATFORM",
    domain: "huggingface.co",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "@huggingface", label: "Hugging Face JS SDK" },
      { pattern: "huggingface-hub", label: "Hugging Face Hub" },
      { pattern: "transformers", label: "Hugging Face Transformers" },
    ],
  },
  {
    name: "Groq",
    providerType: "CLOUD",
    domain: "api.groq.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "groq-sdk", label: "Groq SDK" },
      { pattern: "groq", label: "Groq Client" },
    ],
    modelPatterns: [
      { name: "mixtral-8x7b", modality: "TEXT" },
      { name: "llama3", modality: "TEXT" },
    ],
  },
  {
    name: "Together AI",
    providerType: "CLOUD",
    domain: "api.together.xyz",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "@together", label: "Together AI SDK" },
    ],
  },
  {
    name: "Vercel AI SDK",
    providerType: "SDK",
    domain: "sdk.vercel.ai",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "ai", label: "Vercel AI SDK" },
      { pattern: "@ai-sdk", label: "AI SDK Providers" },
    ],
  },
  {
    name: "LangChain",
    providerType: "FRAMEWORK",
    domain: "langchain.com",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "langchain", label: "LangChain" },
      { pattern: "@langchain", label: "LangChain JS" },
      { pattern: "langchain-core", label: "LangChain Core" },
    ],
  },
  {
    name: "LlamaIndex",
    providerType: "FRAMEWORK",
    domain: "llamaindex.ai",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "llamaindex", label: "LlamaIndex" },
      { pattern: "@llamaindex", label: "LlamaIndex TS" },
    ],
  },
  {
    name: "DeepSeek",
    providerType: "CLOUD",
    domain: "api.deepseek.com",
    riskLevel: "MEDIUM",
    dataRegion: "CN",
    sdkPatterns: [
      { pattern: "deepseek", label: "DeepSeek SDK" },
    ],
    modelPatterns: [
      { name: "deepseek-chat", modality: "TEXT" },
      { name: "deepseek-reasoner", modality: "TEXT" },
      { name: "deepseek-coder", modality: "CODE" },
    ],
  },
  {
    name: "xAI Grok",
    providerType: "CLOUD",
    domain: "api.x.ai",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    apiKeyPattern: /xai-[A-Za-z0-9]{32,}/,
    sdkPatterns: [
      { pattern: "@xai", label: "xAI SDK" },
      { pattern: "grok", label: "Grok SDK" },
    ],
    modelPatterns: [
      { name: "grok-2", modality: "TEXT" },
      { name: "grok-3", modality: "TEXT" },
      { name: "grok-vision", modality: "MULTIMODAL" },
    ],
  },
  {
    name: "Perplexity",
    providerType: "CLOUD",
    domain: "api.perplexity.ai",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "perplexity", label: "Perplexity SDK" },
    ],
    modelPatterns: [
      { name: "sonar-pro", modality: "TEXT" },
      { name: "sonar-small", modality: "TEXT" },
    ],
  },
  {
    name: "Replicate",
    providerType: "CLOUD",
    domain: "api.replicate.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "replicate", label: "Replicate SDK" },
    ],
  },
  {
    name: "ElevenLabs",
    providerType: "CLOUD",
    domain: "api.elevenlabs.io",
    riskLevel: "MEDIUM",
    dataRegion: "EU",
    sdkPatterns: [
      { pattern: "elevenlabs", label: "ElevenLabs SDK" },
    ],
    modelPatterns: [
      { name: "eleven_multilingual_v2", modality: "AUDIO" },
      { name: "eleven_turbo_v2", modality: "AUDIO" },
    ],
  },
  {
    name: "Stability AI",
    providerType: "CLOUD",
    domain: "api.stability.ai",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "stability", label: "Stability AI SDK" },
    ],
    modelPatterns: [
      { name: "stable-diffusion-3", modality: "IMAGE" },
      { name: "stable-diffusion-xl", modality: "IMAGE" },
      { name: "stable-video", modality: "VIDEO" },
    ],
  },
  {
    name: "Midjourney",
    providerType: "CLOUD",
    domain: "api.midjourney.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "midjourney", label: "Midjourney SDK" },
    ],
    modelPatterns: [
      { name: "midjourney-v6", modality: "IMAGE" },
    ],
  },
  {
    name: "Runway",
    providerType: "CLOUD",
    domain: "api.runwayml.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "runway", label: "Runway SDK" },
    ],
    modelPatterns: [
      { name: "gen-3", modality: "VIDEO" },
      { name: "gen-2", modality: "VIDEO" },
    ],
  },
  {
    name: "Synthesia",
    providerType: "CLOUD",
    domain: "api.synthesia.io",
    riskLevel: "MEDIUM",
    dataRegion: "EU",
    sdkPatterns: [
      { pattern: "synthesia", label: "Synthesia SDK" },
    ],
    modelPatterns: [
      { name: "synthesia-v2", modality: "VIDEO" },
    ],
  },
  {
    name: "AssemblyAI",
    providerType: "CLOUD",
    domain: "api.assemblyai.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "assemblyai", label: "AssemblyAI SDK" },
    ],
    modelPatterns: [
      { name: "assemblyai-v2", modality: "AUDIO" },
    ],
  },
  {
    name: "Deepgram",
    providerType: "CLOUD",
    domain: "api.deepgram.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "deepgram", label: "Deepgram SDK" },
    ],
    modelPatterns: [
      { name: "nova-2", modality: "AUDIO" },
      { name: "whisper", modality: "AUDIO" },
    ],
  },
  {
    name: "Pinecone",
    providerType: "CLOUD",
    domain: "api.pinecone.io",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "pinecone", label: "Pinecone SDK" },
    ],
    modelPatterns: [],
  },
  {
    name: "Weaviate",
    providerType: "CLOUD",
    domain: "api.weaviate.io",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "weaviate", label: "Weaviate SDK" },
      { pattern: "@weaviate", label: "Weaviate TS Client" },
    ],
  },
  {
    name: "Chroma",
    providerType: "OPEN_SOURCE",
    domain: "api.trychroma.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "chromadb", label: "Chroma SDK" },
      { pattern: "chroma", label: "Chroma Client" },
    ],
  },
  {
    name: "Qdrant",
    providerType: "OPEN_SOURCE",
    domain: "api.qdrant.tech",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "qdrant", label: "Qdrant SDK" },
      { pattern: "@qdrant", label: "Qdrant JS Client" },
    ],
  },
  {
    name: "Supabase",
    providerType: "CLOUD",
    domain: "api.supabase.com",
    riskLevel: "MEDIUM",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "supabase", label: "Supabase SDK" },
      { pattern: "@supabase", label: "Supabase JS SDK" },
    ],
  },
  {
    name: "CrewAI",
    providerType: "FRAMEWORK",
    domain: "crewai.com",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "crewai", label: "CrewAI" },
    ],
  },
  {
    name: "AutoGPT",
    providerType: "FRAMEWORK",
    domain: "autogpt.net",
    riskLevel: "HIGH",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "autogpt", label: "AutoGPT" },
    ],
  },
  {
    name: "LiteLLM",
    providerType: "FRAMEWORK",
    domain: "litellm.ai",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "litellm", label: "LiteLLM" },
    ],
  },
  {
    name: "Ollama",
    providerType: "OPEN_SOURCE",
    domain: "ollama.ai",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "ollama", label: "Ollama" },
    ],
    modelPatterns: [
      { name: "llama3", modality: "TEXT" },
      { name: "mistral", modality: "TEXT" },
      { name: "codellama", modality: "CODE" },
    ],
  },
  {
    name: "vLLM",
    providerType: "OPEN_SOURCE",
    domain: "vllm.ai",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "vllm", label: "vLLM" },
    ],
  },
  {
    name: "Text Generation Inference",
    providerType: "OPEN_SOURCE",
    domain: "huggingface.co",
    riskLevel: "LOW",
    dataRegion: "US",
    sdkPatterns: [
      { pattern: "text-generation-inference", label: "Hugging Face TGI" },
      { pattern: "huggingface-tgi", label: "TGI" },
    ],
  },
];

// ── AI SDK tool/plugin detection patterns ─────────────────────────────────────

export const SDK_TOOL_PATTERNS: Array<{
  pattern: string;
  toolName: string;
  category: string;
  riskLevel: string;
}> = [
  { pattern: "createOpenAI", toolName: "OpenAI provider", category: "LLM", riskLevel: "LOW" },
  { pattern: "createAnthropic", toolName: "Anthropic provider", category: "LLM", riskLevel: "LOW" },
  { pattern: "createGoogleGenerativeAI", toolName: "Google provider", category: "LLM", riskLevel: "LOW" },
  { pattern: "createMistral", toolName: "Mistral provider", category: "LLM", riskLevel: "LOW" },
  { pattern: "createGroq", toolName: "Groq provider", category: "LLM", riskLevel: "LOW" },
  { pattern: "createCohere", toolName: "Cohere provider", category: "LLM", riskLevel: "LOW" },
  { pattern: "createTogetherAI", toolName: "Together provider", category: "LLM", riskLevel: "LOW" },
  { pattern: "createReplicate", toolName: "Replicate provider", category: "LLM", riskLevel: "MEDIUM" },
  { pattern: "ChatOpenAI", toolName: "LangChain OpenAI", category: "LLM", riskLevel: "LOW" },
  { pattern: "ChatAnthropic", toolName: "LangChain Anthropic", category: "LLM", riskLevel: "LOW" },
  { pattern: "ChatGoogleGenerativeAI", toolName: "LangChain Google", category: "LLM", riskLevel: "LOW" },
  { pattern: "ChatMistralAI", toolName: "LangChain Mistral", category: "LLM", riskLevel: "LOW" },
  { pattern: "OpenAIEmbeddings", toolName: "LangChain Embeddings", category: "EMBEDDING", riskLevel: "LOW" },
  { pattern: "MemoryVectorStore", toolName: "In-memory vector store", category: "VECTOR_STORE", riskLevel: "LOW" },
  { pattern: "PineconeStore", toolName: "Pinecone vector store", category: "VECTOR_STORE", riskLevel: "MEDIUM" },
  { pattern: "Chroma", toolName: "Chroma vector store", category: "VECTOR_STORE", riskLevel: "MEDIUM" },
  { pattern: "WeaviateStore", toolName: "Weaviate vector store", category: "VECTOR_STORE", riskLevel: "MEDIUM" },
  { pattern: "QdrantVectorStore", toolName: "Qdrant vector store", category: "VECTOR_STORE", riskLevel: "LOW" },
  { pattern: "SerpAPI", toolName: "SerpAPI search tool", category: "WEB_SEARCH", riskLevel: "MEDIUM" },
  { pattern: "TavilySearchResults", toolName: "Tavily search tool", category: "WEB_SEARCH", riskLevel: "MEDIUM" },
  { pattern: "DuckDuckGoSearch", toolName: "DuckDuckGo search", category: "WEB_SEARCH", riskLevel: "LOW" },
  { pattern: "WebBrowser", toolName: "Web browser tool", category: "WEB_BROWSER", riskLevel: "HIGH" },
  { pattern: "Calculator", toolName: "Calculator tool", category: "UTILITY", riskLevel: "LOW" },
  { pattern: "RequestsWrapper", toolName: "HTTP requests tool", category: "EXTERNAL_API", riskLevel: "MEDIUM" },
  { pattern: "SqlDatabase", toolName: "SQL database tool", category: "DATABASE", riskLevel: "HIGH" },
  { pattern: "GmailSender", toolName: "Gmail send tool", category: "EMAIL", riskLevel: "HIGH" },
  { pattern: "mcp-client", toolName: "MCP client framework", category: "MCP", riskLevel: "MEDIUM" },
  { pattern: "createMcpServer", toolName: "MCP server", category: "MCP", riskLevel: "MEDIUM" },
  { pattern: "useChat", toolName: "Vercel AI useChat", category: "UI_HOOK", riskLevel: "LOW" },
  { pattern: "useCompletion", toolName: "Vercel AI useCompletion", category: "UI_HOOK", riskLevel: "LOW" },
  { pattern: "streamText", toolName: "Vercel AI streamText", category: "STREAMING", riskLevel: "LOW" },
  { pattern: "generateText", toolName: "Vercel AI generateText", category: "LLM", riskLevel: "LOW" },
];

// ── Scan functions ────────────────────────────────────────────────────────────

export type ScanSource = "npm" | "code" | "env" | "config";

export interface ShadowScanInput {
  organizationId: string;
  projectId?: string;
  scanType?: string;
  codeSnippets?: string[];
  packageJson?: Record<string, unknown>;
  envKeys?: string[];
}

export interface ShadowScanResult {
  scanId: string;
  providers: Array<{ name: string; type: string; riskLevel: string; dataRegion: string }>;
  models: Array<{ name: string; provider: string; modality: string }>;
  sdks: Array<{ name: string; provider: string; riskLevel: string }>;
  tools: Array<{ name: string; category: string; riskLevel: string }>;
  findings: Array<{
    findingType: string;
    providerName?: string;
    modelName?: string;
    riskLevel: string;
    evidence: string;
    recommendation: string;
  }>;
}

export async function runShadowScan(input: ShadowScanInput): Promise<ShadowScanResult> {
  const scanId = `shadow_scan_${randomUUID()}`;
  const providers: ShadowScanResult["providers"] = [];
  const models: ShadowScanResult["models"] = [];
  const sdks: ShadowScanResult["sdks"] = [];
  const tools: ShadowScanResult["tools"] = [];
  const findings: ShadowScanResult["findings"] = [];

  // Scan package.json for SDKs
  if (input.packageJson) {
    const allDeps = {
      ...(input.packageJson.dependencies as Record<string, string> || {}),
      ...(input.packageJson.devDependencies as Record<string, string> || {}),
    };
    for (const [depName, _version] of Object.entries(allDeps)) {
      for (const provider of KNOWN_AI_PROVIDERS) {
        for (const sdkPattern of provider.sdkPatterns) {
          if (depName.includes(sdkPattern.pattern) || depName.startsWith(sdkPattern.pattern)) {
            if (!sdks.some((s) => s.name === depName)) {
              sdks.push({ name: depName, provider: provider.name, riskLevel: provider.riskLevel });
              if (!providers.some((p) => p.name === provider.name)) {
                providers.push({
                  name: provider.name,
                  type: provider.providerType,
                  riskLevel: provider.riskLevel,
                  dataRegion: provider.dataRegion,
                });
              }
            }
            break;
          }
        }
      }
      for (const toolPat of SDK_TOOL_PATTERNS) {
        if (depName.includes(toolPat.pattern) || depName === toolPat.pattern) {
          if (!tools.some((t) => t.name === depName)) {
            tools.push({ name: depName, category: toolPat.category, riskLevel: toolPat.riskLevel });
          }
          break;
        }
      }
    }
  }

  // Scan code snippets for SDK usage patterns
  if (input.codeSnippets) {
    for (const snippet of input.codeSnippets) {
      for (const provider of KNOWN_AI_PROVIDERS) {
        for (const sdkPattern of provider.sdkPatterns) {
          if (snippet.toLowerCase().includes(sdkPattern.pattern.toLowerCase())) {
            if (!providers.some((p) => p.name === provider.name)) {
              providers.push({
                name: provider.name,
                type: provider.providerType,
                riskLevel: provider.riskLevel,
                dataRegion: provider.dataRegion,
              });
            }
            if (!sdks.some((s) => s.name === sdkPattern.label)) {
              sdks.push({ name: sdkPattern.label, provider: provider.name, riskLevel: provider.riskLevel });
            }
            break;
          }
        }
      }
      for (const toolPat of SDK_TOOL_PATTERNS) {
        if (snippet.includes(toolPat.pattern)) {
          if (!tools.some((t) => t.name === toolPat.toolName)) {
            tools.push({ name: toolPat.toolName, category: toolPat.category, riskLevel: toolPat.riskLevel });
          }
        }
      }
    }
  }

  // Scan env keys for API keys
  const API_KEY_ENV_PATTERNS: Array<{ pattern: string; providerName: string }> = [
    { pattern: "OPENAI_API_KEY", providerName: "OpenAI" },
    { pattern: "ANTHROPIC_API_KEY", providerName: "Anthropic" },
    { pattern: "GOOGLE_API_KEY", providerName: "Google AI" },
    { pattern: "GEMINI_API_KEY", providerName: "Google AI" },
    { pattern: "MISTRAL_API_KEY", providerName: "Mistral AI" },
    { pattern: "COHERE_API_KEY", providerName: "Cohere" },
    { pattern: "DEEPSEEK_API_KEY", providerName: "DeepSeek" },
    { pattern: "GROQ_API_KEY", providerName: "Groq" },
    { pattern: "XAI_API_KEY", providerName: "xAI Grok" },
    { pattern: "PERPLEXITY_API_KEY", providerName: "Perplexity" },
    { pattern: "REPLICATE_API_TOKEN", providerName: "Replicate" },
    { pattern: "ELEVENLABS_API_KEY", providerName: "ElevenLabs" },
    { pattern: "STABILITY_API_KEY", providerName: "Stability AI" },
    { pattern: "RUNWAY_API_KEY", providerName: "Runway" },
    { pattern: "SYNTHESIA_API_KEY", providerName: "Synthesia" },
    { pattern: "ASSEMBLYAI_API_KEY", providerName: "AssemblyAI" },
    { pattern: "DEEPGRAM_API_KEY", providerName: "Deepgram" },
    { pattern: "PINECONE_API_KEY", providerName: "Pinecone" },
    { pattern: "WEAVIATE_API_KEY", providerName: "Weaviate" },
    { pattern: "SUPABASE_KEY", providerName: "Supabase" },
    { pattern: "SUPABASE_SERVICE_KEY", providerName: "Supabase" },
    { pattern: "AZURE_OPENAI_KEY", providerName: "Azure OpenAI" },
    { pattern: "AWS_ACCESS_KEY", providerName: "Amazon Bedrock" },
    { pattern: "AWS_SECRET_KEY", providerName: "Amazon Bedrock" },
    { pattern: "HUGGINGFACE_API_KEY", providerName: "Hugging Face" },
    { pattern: "HF_API_KEY", providerName: "Hugging Face" },
  ];
  if (input.envKeys) {
    for (const key of input.envKeys) {
      const upperKey = key.toUpperCase();
      for (const apiPattern of API_KEY_ENV_PATTERNS) {
        if (upperKey.includes(apiPattern.pattern)) {
          if (!findings.some((f) => f.findingType === "API_KEY_DETECTED" && f.providerName === apiPattern.providerName)) {
            findings.push({
              findingType: "API_KEY_DETECTED",
              providerName: apiPattern.providerName,
              riskLevel: "MEDIUM",
              evidence: `Environment variable ${key} detected — ${apiPattern.providerName} API key`,
              recommendation: "Ensure this key is stored in a secret manager and rotated regularly.",
            });
          }
        }
      }
    }
  }

  // Generate risk findings for high-risk providers
  for (const provider of providers) {
    if (provider.riskLevel === "HIGH" || provider.riskLevel === "CRITICAL") {
      findings.push({
        findingType: "HIGH_RISK_PROVIDER",
        providerName: provider.name,
        riskLevel: provider.riskLevel,
        evidence: `Provider ${provider.name} with risk level ${provider.riskLevel} was detected.`,
        recommendation: `Review security posture for ${provider.name}. Consider restricting usage to approved providers.`,
      });
    }
  }

  // Generate findings for unapproved tool usage
  for (const tool of tools) {
    if (tool.category === "DATABASE" || tool.category === "EMAIL" || tool.category === "EXTERNAL_API") {
      findings.push({
        findingType: "RISKY_TOOL_DETECTED",
        riskLevel: tool.riskLevel,
        evidence: `Tool "${tool.name}" (${tool.category}) detected with risk level ${tool.riskLevel}.`,
        recommendation: `Review and approve all ${tool.category} tool usage. Ensure proper access controls.`,
      });
    }
  }

  // Generate model findings
  if (input.codeSnippets) {
    for (const snippet of input.codeSnippets) {
      for (const provider of KNOWN_AI_PROVIDERS) {
        for (const modelPat of provider.modelPatterns || []) {
          if (snippet.toLowerCase().includes(modelPat.name.toLowerCase())) {
            if (!models.some((m) => m.name === modelPat.name)) {
              models.push({ name: modelPat.name, provider: provider.name, modality: modelPat.modality });
            }
          }
        }
      }
    }
  }

  // Persist scan results
  await db.shadowAiScan.create({
    data: {
      id: scanId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      scanType: input.scanType ?? "FULL",
      status: "COMPLETED",
      providerCount: providers.length,
      modelCount: models.length,
      riskFindings: findings.length,
      completedAt: new Date(),
      findings: {
        create: findings.map((f) => ({
          findingType: f.findingType,
          providerName: f.providerName,
          modelName: f.modelName,
          riskLevel: f.riskLevel,
          evidence: f.evidence.slice(0, 2000),
          recommendation: f.recommendation?.slice(0, 1000),
        })),
      },
    },
  });

  // Upsert discovered providers into the registry
  for (const provider of providers) {
    await db.aiProvider.upsert({
      where: { organizationId_name: { organizationId: input.organizationId, name: provider.name } },
      update: { status: provider.riskLevel === "LOW" ? "APPROVED" : "REVIEW", riskLevel: provider.riskLevel },
      create: {
        organizationId: input.organizationId,
        name: provider.name,
        providerType: provider.type,
        status: provider.riskLevel === "LOW" ? "APPROVED" : "REVIEW",
        riskLevel: provider.riskLevel,
        dataRegion: provider.dataRegion,
        metadata: { discoveredBy: "shadow-scan", scanId },
      },
    });
  }

  // Upsert discovered models
  for (const model of models) {
    const provider = providers.find((p) => p.name === model.provider);
    if (provider) {
      const dbProvider = await db.aiProvider.findUnique({
        where: { organizationId_name: { organizationId: input.organizationId, name: provider.name } },
      });
      if (dbProvider) {
        await db.aiModel.upsert({
          where: {
            organizationId_providerId_name_version: {
              organizationId: input.organizationId,
              providerId: dbProvider.id,
              name: model.name,
              version: "discovered",
            },
          },
          update: { modality: model.modality },
          create: {
            organizationId: input.organizationId,
            providerId: dbProvider.id,
            name: model.name,
            version: "discovered",
            modality: model.modality,
            riskLevel: provider.riskLevel,
            approved: false,
            metadata: { discoveredBy: "shadow-scan", scanId },
          },
        });
      }
    }
  }

  return { scanId, providers, models, sdks, tools, findings };
}

export async function getShadowAiSummary(organizationId: string) {
  const [scans, providers, models] = await Promise.all([
    db.shadowAiScan.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { _count: { select: { findings: true } } },
    }),
    db.aiProvider.findMany({ where: { organizationId } }),
    db.aiModel.findMany({ where: { organizationId } }),
  ]);
  return { scans, providers, models, providerCount: providers.length, modelCount: models.length };
}

export function assessProviderRisk(providerType: string, dataRegion: string): string {
  if (dataRegion === "US" && providerType === "CLOUD") return "MEDIUM";
  if (dataRegion === "EU") return "MEDIUM";
  if (providerType === "OPEN_SOURCE") return "MEDIUM";
  if (dataRegion === "CN" || dataRegion === "RU") return "HIGH";
  return "LOW";
}
