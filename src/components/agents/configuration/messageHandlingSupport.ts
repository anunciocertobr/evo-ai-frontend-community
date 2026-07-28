import { Agent } from '@/types/agents';
import { LLMConfigData } from '@/components/ai_agents/Forms/LLMConfigForm';
import { isExternalAgent, supportsMessageHandling } from '@/utils/agents';
import { ExternalConfigData } from './types';

/** Indica se há algo para renderizar — usado para gatear o card "Tratamento de Mensagens". */
export const hasMessageHandlingContent = (
  agent: Agent,
  llmConfigData: LLMConfigData | null,
  externalConfigData?: ExternalConfigData | null
): boolean => {
  if (agent.type === 'a2a' || agent.type === 'task') return true;
  if (isExternalAgent(agent.type)) return Boolean(externalConfigData?.advanced_config);
  return supportsMessageHandling(agent.type) && Boolean(llmConfigData?.advanced_config);
};
