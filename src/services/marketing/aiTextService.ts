import api from '@/services/core/api';

export type AiProvider = 'groq' | 'openai' | 'gemini';

export const AI_PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: 'groq', label: 'Groq' },
  { value: 'openai', label: 'ChatGPT (OpenAI)' },
  { value: 'gemini', label: 'Google Gemini' },
];

export interface AiModelOption {
  id: string;
  label: string;
}

interface GroqOrOpenAiModel {
  id: string;
}

interface GeminiModel {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

/**
 * Mesmo proxy server-side (`/tools_proxy/*`) já usado pelas ferramentas de
 * IA que vivem como HTML solto no editor (Copy de Tráfego, Roteiro de Vídeo
 * etc.) — aqui é chamado direto pelo client autenticado da SPA em vez do
 * truque de token via postMessage (que só existe pra contornar o iframe
 * sandboxed daquelas ferramentas).
 */
export async function listAiModels(provider: AiProvider): Promise<AiModelOption[]> {
  const response = await api.get<{ data?: GeminiModel[] } & { models?: GeminiModel[] }>(
    `/tools_proxy/${provider}/models`,
  );
  const data = response.data as unknown as {
    data?: GroqOrOpenAiModel[];
    models?: GeminiModel[];
  };

  if (provider === 'gemini') {
    return (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => ({ id: m.name.replace('models/', ''), label: m.displayName || m.name }));
  }

  return (data.data || [])
    .filter((m) => !/whisper|orpheus|prompt-guard/i.test(m.id))
    .map((m) => ({ id: m.id, label: m.id }));
}

export async function generateText(
  provider: AiProvider,
  model: string,
  prompt: string,
  temperature = 0.8,
): Promise<string> {
  if (provider === 'gemini') {
    const response = await api.post<{
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    }>('/tools_proxy/gemini/generate_content', {
      model,
      payload: { contents: [{ parts: [{ text: prompt }] }] },
    });
    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Resposta da IA em formato inesperado.');
    return text;
  }

  const endpoint = provider === 'openai' ? '/tools_proxy/openai/chat_completions' : '/tools_proxy/groq/chat_completions';
  const response = await api.post<{ choices?: { message?: { content?: string } }[] }>(endpoint, {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
  });
  const text = response.data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Resposta da IA em formato inesperado.');
  return text;
}
