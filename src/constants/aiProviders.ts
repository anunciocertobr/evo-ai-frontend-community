export const CUSTOM_OPENAI_PROVIDER = 'custom_openai_compatible';

export interface AiProvider {
  value: string;
  label: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'groq', label: 'Groq' },
  { value: 'mistral', label: 'Mistral AI' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'together_ai', label: 'Together AI' },
  { value: 'fireworks_ai', label: 'Fireworks AI' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'bedrock', label: 'AWS Bedrock' },
  { value: 'vertex_ai', label: 'Google Vertex AI' },
  { value: CUSTOM_OPENAI_PROVIDER, label: 'Custom (OpenAI-compatible)' },
];

// Providers speaking the OpenAI wire protocol serve every AI feature. The rest
// are only reachable through AI Agents. Mirrors IsOpenAICompatible in
// evo-ai-core-service-community/pkg/api_key/model/api_key.go.
const OPENAI_COMPATIBLE_PROVIDERS = new Set([
  'openai',
  'azure',
  'custom',
  CUSTOM_OPENAI_PROVIDER,
]);

export function isOpenAICompatible(provider: string): boolean {
  return OPENAI_COMPATIBLE_PROVIDERS.has(provider);
}

// The API returns only the last characters of a key, never the key itself.
export function maskKey(hint?: string): string {
  return hint ? `••••${hint}` : '••••';
}
