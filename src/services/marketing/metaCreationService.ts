import api from '@/services/core/api';

const ENDPOINT = '/reports/meta_ads_manager';

export interface LeadForm {
  id: string;
  name: string;
  status: string;
  leads_count?: number;
  created_time?: string;
}

export interface LeadQuestion {
  type: 'FULL_NAME' | 'EMAIL' | 'PHONE' | 'CUSTOM';
  key?: string;
  label?: string;
}

export interface CustomAudience {
  id: string;
  name: string;
  subtype: 'WEBSITE' | 'LOOKALIKE' | 'CUSTOM' | string;
  description?: string;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  delivery_status?: { code: number; description: string };
  operation_status?: { code: number; description: string };
}

export interface MetaPixel {
  id: string;
  name: string;
}

class MetaCreationService {
  // --- Formulários de Lead ---

  async listLeadForms(): Promise<LeadForm[]> {
    const response = await api.post<LeadForm[]>(ENDPOINT, { acao: 'listar_formularios_lead' });
    return response.data || [];
  }

  async createLeadForm(payload: {
    name: string;
    questions: LeadQuestion[];
    privacy_policy_url: string;
    thank_you_title?: string;
    thank_you_body?: string;
  }): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>(ENDPOINT, {
      acao: 'criar_formulario_lead',
      ...payload,
      questions: JSON.stringify(payload.questions),
    });
    return response.data;
  }

  // --- Públicos ---

  async listAudiences(adAccountId: string): Promise<CustomAudience[]> {
    const response = await api.post<CustomAudience[]>(ENDPOINT, {
      acao: 'listar_publicos',
      id_conta_anuncio: adAccountId,
    });
    return response.data || [];
  }

  async listPixels(adAccountId: string): Promise<MetaPixel[]> {
    const response = await api.post<MetaPixel[]>(ENDPOINT, {
      acao: 'listar_pixels',
      id_conta_anuncio: adAccountId,
    });
    return response.data || [];
  }

  async createWebsiteAudience(payload: {
    adAccountId: string;
    name: string;
    pixelId: string;
    retentionDays: number;
    urlContains?: string;
    description?: string;
  }): Promise<CustomAudience> {
    const response = await api.post<CustomAudience>(ENDPOINT, {
      acao: 'criar_publico_site',
      id_conta_anuncio: payload.adAccountId,
      name: payload.name,
      pixel_id: payload.pixelId,
      retention_days: payload.retentionDays,
      url_contains: payload.urlContains,
      description: payload.description,
    });
    return response.data;
  }

  async createLookalikeAudience(payload: {
    adAccountId: string;
    name: string;
    originAudienceId: string;
    country: string;
    ratio: number;
  }): Promise<CustomAudience> {
    const response = await api.post<CustomAudience>(ENDPOINT, {
      acao: 'criar_publico_semelhante',
      id_conta_anuncio: payload.adAccountId,
      name: payload.name,
      origin_audience_id: payload.originAudienceId,
      country: payload.country,
      ratio: payload.ratio,
    });
    return response.data;
  }

  async createCustomerListAudience(payload: {
    adAccountId: string;
    name: string;
    description?: string;
  }): Promise<CustomAudience> {
    const response = await api.post<CustomAudience>(ENDPOINT, {
      acao: 'criar_publico_clientes',
      id_conta_anuncio: payload.adAccountId,
      name: payload.name,
      description: payload.description,
    });
    return response.data;
  }

  async addContactsToAudience(audienceId: string, contactIds: string[]): Promise<{ uploaded: number }> {
    const response = await api.post<{ uploaded: number }>(ENDPOINT, {
      acao: 'adicionar_clientes_publico',
      id_publico: audienceId,
      contact_ids: contactIds,
    });
    return response.data;
  }
}

export const metaCreationService = new MetaCreationService();
