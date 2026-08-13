import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import authApi from '@/services/core/apiAuth';
import type {
  Macro,
  MacrosResponse,
  MacroResponse,
  MacroDeleteResponse,
  MacroCreateData,
  MacroUpdateData,
  MacroExecuteData,
  MacrosListParams,
} from '@/types/automation';

export type MacroFormDataSource = 'inboxes' | 'agents' | 'teams' | 'labels';

export interface MacroFormData {
  inboxes: any[];
  agents: any[];
  teams: any[];
  labels: any[];
  campaigns: any[];
  customAttributes: any[];
  failedSources: MacroFormDataSource[];
}

class MacrosService {
  // List macros with optional parameters
  async getMacros(params?: MacrosListParams): Promise<MacrosResponse> {
    const response = await api.get('/macros', { params });
    return extractResponse<Macro>(response) as MacrosResponse;
  }

  // Get single macro
  async getMacro(macroId: string): Promise<MacroResponse> {
    const response = await api.get(`/macros/${macroId}`);
    return extractData<MacroResponse>(response);
  }

  // Create macro
  async createMacro(data: MacroCreateData): Promise<MacroResponse> {
    const response = await api.post('/macros', data);
    return extractData<MacroResponse>(response);
  }

  // Update macro
  async updateMacro(macroId: string, data: Partial<MacroUpdateData>): Promise<MacroResponse> {
    const response = await api.put(`/macros/${macroId}`, data);
    return extractData<MacroResponse>(response);
  }

  // Delete macro
  async deleteMacro(macroId: string): Promise<MacroDeleteResponse> {
    const response = await api.delete(`/macros/${macroId}`);
    return extractData<MacroDeleteResponse>(response);
  }

  // Execute macro — returns execution results with status per action
  async executeMacro(data: MacroExecuteData): Promise<{ data?: { executions?: Array<{ id: string; status: string; error_message?: string; actions_result?: Array<{ action: string; status: string; error?: string }> }> } }> {
    const response = await api.post(`/macros/${data.macroId}/execute`, {
      conversation_ids: data.conversationIds,
    });
    return response.data;
  }

  // Search macros (if implemented in backend)
  async searchMacros(query: string, params?: MacrosListParams): Promise<MacrosResponse> {
    const searchParams = { ...params, q: query };
    return this.getMacros(searchParams);
  }

  async getFormData(): Promise<MacroFormData> {
    // Buscar dados necessários para o formulário em paralelo
    const [inboxesRes, agentsRes, teamsRes, labelsRes] = await Promise.allSettled([
      api.get('/inboxes'),
      authApi.get('/users'),
      api.get('/teams'),
      api.get('/labels'),
    ]);

    const failedSources: MacroFormDataSource[] = [];

    // Uma lista vazia por erro (403/500) é indistinguível de uma lista vazia de
    // verdade — sem registrar a fonte que falhou, o formulário mente pro usuário.
    const getResultData = (
      source: MacroFormDataSource,
      result: PromiseSettledResult<any>,
      isAuthService = false,
    ): any[] => {
      if (result.status === 'rejected') {
        console.error(`Erro ao carregar ${source} no formulário de macros:`, result.reason);
        failedSources.push(source);
        return [];
      }

      try {
        if (isAuthService) {
          // Auth services return {data, meta} structure
          const response = extractResponse(result.value);
          return (response.data as any[]) || [];
        }
        const data = extractData(result.value);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error(`Erro ao interpretar ${source} no formulário de macros:`, error);
        failedSources.push(source);
        return [];
      }
    };

    return {
      inboxes: getResultData('inboxes', inboxesRes),
      agents: getResultData('agents', agentsRes, true), // true = isAuthService
      teams: getResultData('teams', teamsRes),
      labels: getResultData('labels', labelsRes),
      campaigns: [],
      customAttributes: [], // TODO: Implementar busca de custom attributes se necessário
      failedSources,
    };
  }
}

export const macrosService = new MacrosService();
