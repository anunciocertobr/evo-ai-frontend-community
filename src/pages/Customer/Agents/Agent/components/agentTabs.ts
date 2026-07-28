import { isExternalAgent, isOrchestratorAgent } from '@/utils/agents';

export type AgentDetailTab = 'profile' | 'tools' | 'products' | 'configuration' | 'channels';

/** Sub Agentes é oferecido a LLM + orquestradores de fluxo, mas não a `task`/`external`. */
export const supportsSubAgents = (agentType?: string): boolean =>
  ['llm', 'sequential', 'parallel', 'loop'].includes(agentType || '');

/** Ferramentas / Integrações / Servidores MCP: só tipos não-orquestradores e não-externos. */
export const supportsToolBlocks = (agentType?: string): boolean =>
  !isOrchestratorAgent(agentType) && !isExternalAgent(agentType);

export const getVisibleAgentTabs = (agentType?: string): AgentDetailTab[] => {
  const tabs: AgentDetailTab[] = ['profile'];

  if (supportsSubAgents(agentType) || supportsToolBlocks(agentType)) {
    tabs.push('tools');
  }
  if (!isOrchestratorAgent(agentType)) {
    tabs.push('products');
  }

  tabs.push('configuration', 'channels');
  return tabs;
};
