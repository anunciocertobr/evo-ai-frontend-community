import { Agent } from '@/types/agents';

export type AgentFacetKey = 'type' | 'model';

export interface AgentFacetSelection {
  type: string[];
  model: string[];
}

export const EMPTY_AGENT_FACETS: AgentFacetSelection = { type: [], model: [] };

/**
 * As 3 opções de Tipo do protótipo. "Avançado" agrupa os orquestradores e o a2a —
 * o usuário filtra por natureza do agente, não pelo enum interno.
 */
export interface AgentTypeFacet {
  value: string;
  labelKey: string;
  types: string[];
}

export const AGENT_TYPE_FACETS: AgentTypeFacet[] = [
  { value: 'native', labelKey: 'filters.types.native', types: ['llm'] },
  { value: 'external', labelKey: 'filters.types.external', types: ['external'] },
  {
    value: 'advanced',
    labelKey: 'filters.types.advanced',
    types: ['a2a', 'sequential', 'parallel', 'loop'],
  },
];

/** `openai/gpt-4o` → `gpt-4o`: o provider não distingue nada na lista. */
export const modelValue = (model?: string | null): string =>
  (model || '').split('/').pop() || '';

/** Opções de Modelo vêm dos agentes JÁ CARREGADOS — não há endpoint de modelos usados. */
export const buildModelOptions = (agents: Agent[]): string[] =>
  [...new Set(agents.map(agent => modelValue(agent.model)).filter(Boolean))].sort();

export const countSelectedFacets = (selection: AgentFacetSelection): number =>
  selection.type.length + selection.model.length;

const matchesType = (agent: Agent, selected: string[]): boolean => {
  if (selected.length === 0) return true;
  return selected.some(value =>
    AGENT_TYPE_FACETS.find(facet => facet.value === value)?.types.includes(agent.type),
  );
};

const matchesModel = (agent: Agent, selected: string[]): boolean =>
  selected.length === 0 || selected.includes(modelValue(agent.model));

export const applyAgentFacets = (agents: Agent[], selection: AgentFacetSelection): Agent[] =>
  agents.filter(
    agent => matchesType(agent, selection.type) && matchesModel(agent, selection.model),
  );

export const toggleFacetValue = (
  selection: AgentFacetSelection,
  key: AgentFacetKey,
  value: string,
): AgentFacetSelection => {
  const current = selection[key];
  return {
    ...selection,
    [key]: current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value],
  };
};
