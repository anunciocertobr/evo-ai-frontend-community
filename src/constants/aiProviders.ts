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

// Scopes ordered from the most generic to the most specific, mirroring
// Ai::CredentialResolver::SCOPE_CHAIN in the CRM. Rails owns the resolution
// that features rely on; this preview exists so the screen can show which
// credential is in effect without a round trip per feature.
export const SCOPE_CHAIN: ApiKeyScope[] = ['installation', 'account'];

export type ApiKeyScope = 'installation' | 'account';

interface ResolvableCredential {
  provider: string;
  scope?: ApiKeyScope;
  is_active: boolean;
  openai_compatible?: boolean;
}

// Mirrors the resolver: most specific link first, skipping credentials whose
// provider the feature cannot speak, so it falls through to a broader link.
export function resolveCredential<T extends ResolvableCredential>(
  credentials: T[],
  { openAICompatibleOnly = false }: { openAICompatibleOnly?: boolean } = {},
): T | undefined {
  for (const scope of [...SCOPE_CHAIN].reverse()) {
    const match = credentials.find(
      credential =>
        credential.is_active &&
        (credential.scope ?? 'account') === scope &&
        (!openAICompatibleOnly ||
          (credential.openai_compatible ?? isOpenAICompatible(credential.provider))),
    );

    if (match) {
      return match;
    }
  }

  return undefined;
}
