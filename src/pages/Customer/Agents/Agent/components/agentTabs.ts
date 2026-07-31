import { isExternalAgent, isOrchestratorAgent } from '@/utils/agents';

export type AgentDetailTab = 'profile' | 'tools' | 'products' | 'configuration' | 'channels';

/**
 * Compartilhado pelas duas barras de abas do detalhe (a principal e a de Configuração).
 * `flex-none`/`h-auto` cancelam o `flex-1 h-[calc(100%-1px)]` da base do TabsTrigger:
 * tailwind-merge não resolve `flex-1` contra `inline-flex`, e os chips esticavam.
 */
export const AGENT_TAB_LIST_CLASS =
  'h-auto w-full flex-wrap justify-start gap-2 rounded-none bg-transparent p-0';

export const AGENT_TAB_TRIGGER_CLASS =
  'inline-flex h-auto flex-none items-center gap-2 rounded-[9px] border border-transparent bg-transparent px-4 py-[9px] text-[13.5px] font-medium text-[#5B6470] shadow-none hover:bg-[#F4F6F8] hover:text-[#1A211E] data-[state=active]:border-[#B9E3CA] data-[state=active]:bg-[#F0FAF4] data-[state=active]:font-semibold data-[state=active]:text-[#359558] data-[state=active]:shadow-none data-[state=active]:hover:bg-[#E7F5ED]';

/** `size-*` e não `h-/w-`: a base aplica `[&_svg:not([class*='size-'])]:size-4`. */
export const AGENT_TAB_ICON_CLASS = 'size-[18px]';

/** Sub Agentes é oferecido a LLM + orquestradores de fluxo, mas não a `task`/`external`. */
export const supportsSubAgents = (agentType?: string): boolean =>
  ['llm', 'sequential', 'parallel', 'loop'].includes(agentType || '');

/** Ferramentas / Integrações / Servidores MCP: só tipos não-orquestradores e não-externos. */
export const supportsToolBlocks = (agentType?: string): boolean =>
  !isOrchestratorAgent(agentType) && !isExternalAgent(agentType);

/** Espelha os gates dos 3 cards do ConfigurationSection: fora desta lista a aba abria vazia. */
export const supportsConfiguration = (agentType?: string): boolean =>
  ['llm', 'a2a', 'task', 'external'].includes(agentType || '');

export const getVisibleAgentTabs = (agentType?: string): AgentDetailTab[] => {
  const tabs: AgentDetailTab[] = ['profile'];

  if (supportsSubAgents(agentType) || supportsToolBlocks(agentType)) {
    tabs.push('tools');
  }
  if (!isOrchestratorAgent(agentType)) {
    tabs.push('products');
  }
  if (supportsConfiguration(agentType)) {
    tabs.push('configuration');
  }

  tabs.push('channels');
  return tabs;
};
