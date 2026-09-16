import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

export interface AgentKanbanStats {
  total: number;
  stages: Array<{ name: string; count: number }>;
}

export async function getAgentsKanbanStats(): Promise<Record<string, AgentKanbanStats>> {
  const response = await api.get('/admin/real_estate/agents_kanban_stats');
  const result = extractData<{ agents: Record<string, AgentKanbanStats> }>(response);
  return result.agents ?? {};
}

export interface AgentLead {
  id: string;
  created_at: string;
  stage_name: string;
  product_name: string | null;
  message: string | null;
  contact: {
    name: string | null;
    phone: string | null;
    email: string | null;
  };
}

export async function getAgentLeads(agentId: string): Promise<AgentLead[]> {
  const response = await api.get(`/admin/real_estate/agents/${agentId}/leads`);
  const result = extractData<{ leads: AgentLead[] }>(response);
  return result.leads ?? [];
}
