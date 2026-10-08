import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

export interface GtmAccount {
  accountId: string;
  name: string;
}

export interface GtmContainer {
  containerId: string;
  accountId: string;
  name: string;
  publicId: string;
  usageContext?: string[];
}

export interface GtmParameter {
  type: string;
  key: string;
  value?: string;
}

export interface GtmResource {
  name?: string;
  type: string;
  notes?: string;
  tagId?: string;
  triggerId?: string;
  variableId?: string;
  folderId?: string;
  templateId?: string;
  parentFolderId?: string;
  firingTriggerId?: string[];
  parameter?: GtmParameter[];
  fingerprint?: string;
}

export interface GtmWorkspaceData {
  workspace_id: string;
  tags: GtmResource[];
  triggers: GtmResource[];
  variables: GtmResource[];
  folders: GtmResource[];
  templates: GtmResource[];
}

export type GtmResourceKind = 'tags' | 'triggers' | 'variables' | 'folders';

export interface GtmPermission {
  path?: string;
  accountId: string;
  emailAddress: string;
  accountAccess?: { permission: string };
  containerAccess?: { containerId: string; permission: string }[];
}

class GtmService {
  private readonly baseUrl = '/marketing/gtm';

  async getAccounts(): Promise<GtmAccount[]> {
    const response = await api.get(`${this.baseUrl}/accounts`);
    return extractData<GtmAccount[]>(response);
  }

  async getContainers(accountId: string): Promise<GtmContainer[]> {
    const response = await api.get(`${this.baseUrl}/accounts/${accountId}/containers`);
    return extractData<GtmContainer[]>(response);
  }

  async createContainer(accountId: string, name: string, usageContext: 'web' | 'server'): Promise<GtmContainer> {
    const response = await api.post(`${this.baseUrl}/accounts/${accountId}/containers`, { name, usage_context: usageContext });
    return extractData<GtmContainer>(response);
  }

  // Cria o contêiner e dispara em background a importação do modelo padrão
  // (web: pacote completo de tags/variáveis; server: base de Facebook CAPI
  // + TikTok Events API) — os campos em `fields` são os IDs/tokens
  // opcionais; o que não for preenchido vira "0000000000" no backend, pra
  // ficar óbvio o que falta completar depois direto no GTM. Roda num job
  // (não espera terminar): importar o modelo inteiro respeitando a cota de
  // escrita do Google leva vários minutos.
  async createContainerFromTemplate(
    accountId: string,
    clientName: string,
    usageContext: 'web' | 'server',
    fields: Record<string, string>,
    sheetUrl?: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`${this.baseUrl}/accounts/${accountId}/containers/from_template`, {
      client_name: clientName,
      usage_context: usageContext,
      fields,
      sheet_url: sheetUrl,
    });
    return response.data;
  }

  async getWorkspace(accountId: string, containerId: string): Promise<GtmWorkspaceData> {
    const response = await api.get(`${this.baseUrl}/accounts/${accountId}/containers/${containerId}/workspace`);
    return extractData<GtmWorkspaceData>(response);
  }

  async createResource(
    accountId: string,
    containerId: string,
    resource: GtmResourceKind,
    payload: Partial<GtmResource>,
  ): Promise<GtmResource> {
    const response = await api.post(`${this.baseUrl}/accounts/${accountId}/containers/${containerId}/${resource}`, {
      resource_payload: payload,
    });
    return extractData<GtmResource>(response);
  }

  async updateResource(
    accountId: string,
    containerId: string,
    resource: GtmResourceKind,
    resourceId: string,
    payload: Partial<GtmResource>,
  ): Promise<GtmResource> {
    const response = await api.put(`${this.baseUrl}/accounts/${accountId}/containers/${containerId}/${resource}/${resourceId}`, {
      resource_payload: payload,
    });
    return extractData<GtmResource>(response);
  }

  async deleteResource(accountId: string, containerId: string, resource: GtmResourceKind, resourceId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/accounts/${accountId}/containers/${containerId}/${resource}/${resourceId}`);
  }

  async importContainer(accountId: string, containerId: string, containerVersionJson: string): Promise<void> {
    await api.post(`${this.baseUrl}/accounts/${accountId}/containers/${containerId}/import`, {
      container_version: containerVersionJson,
    });
  }

  async getPermissions(accountId: string): Promise<GtmPermission[]> {
    const response = await api.get(`${this.baseUrl}/accounts/${accountId}/permissions`);
    return extractData<GtmPermission[]>(response);
  }

  async invitePermission(
    accountId: string,
    email: string,
    accountPermission: string,
    containerId?: string,
    containerPermission?: string,
  ): Promise<GtmPermission> {
    const response = await api.post(`${this.baseUrl}/accounts/${accountId}/permissions`, {
      email,
      account_permission: accountPermission,
      container_id: containerId,
      container_permission: containerPermission,
    });
    return extractData<GtmPermission>(response);
  }

  async removePermission(accountId: string, permissionId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/accounts/${accountId}/permissions/${encodeURIComponent(permissionId)}`);
  }
}

export const gtmService = new GtmService();
