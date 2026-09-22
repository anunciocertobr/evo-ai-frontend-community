import api from '@/services/core/api';

const ENDPOINT = '/reports/meta_ads_manager';

export type MetaLevel = 'campaign' | 'adset' | 'ad';

// Cada objetivo do seletor carrega o par objective+optimization_goal de
// verdade que a Graph API espera — igual ao OBJECTIVE_MAP do painel legado
// (dashboards-src/painel_trafego.html), testado um por um contra conta real.
export type ObjectiveKey = 'messages' | 'leads' | 'traffic' | 'conversions' | 'engagement' | 'ig_profile';

export const OBJECTIVE_MAP: Record<ObjectiveKey, { objective: string; optimizationGoal: string; label: string; needsLink: boolean }> = {
  messages: { objective: 'OUTCOME_ENGAGEMENT', optimizationGoal: 'CONVERSATIONS', label: 'Mensagens (WhatsApp/Messenger)', needsLink: false },
  leads: { objective: 'OUTCOME_LEADS', optimizationGoal: 'LEAD_GENERATION', label: 'Geração de Leads (Cadastro)', needsLink: false },
  traffic: { objective: 'OUTCOME_TRAFFIC', optimizationGoal: 'LINK_CLICKS', label: 'Tráfego (Site)', needsLink: true },
  conversions: { objective: 'OUTCOME_SALES', optimizationGoal: 'OFFSITE_CONVERSIONS', label: 'Conversão (Vendas/Pixel)', needsLink: true },
  engagement: { objective: 'OUTCOME_ENGAGEMENT', optimizationGoal: 'POST_ENGAGEMENT', label: 'Engajamento (Vídeo/Post)', needsLink: false },
  ig_profile: { objective: 'OUTCOME_TRAFFIC', optimizationGoal: 'VISIT_INSTAGRAM_PROFILE', label: 'Visita ao Perfil do Instagram', needsLink: false },
};

export interface CreateCampaignTargeting {
  age_min: number;
  age_max: number;
  publisher_platforms: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  custom_audience_id?: string;
  detailed_targeting_manual?: string[];
  geo_locations: {
    location_types: string[];
    countries?: string[];
    // Pin do mapa (lat/lng + raio) — `key: 'custom_location_pin'` é o
    // formato que Meta::AdsManagerService#normalize_geo já sabe converter
    // pra `geo_locations.custom_locations` (formato real da Graph API).
    cities?: Array<{ key: string; name: string; radius: number; distance_unit: string; latitude: number; longitude: number }>;
  };
}

export interface CreateCampaignPayload {
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  objective: string;
  link?: string;
  adsets: Array<{
    adset_name: string;
    adset_status: 'ACTIVE' | 'PAUSED';
    daily_budget: string;
    optimization_goal: string;
    bid_strategy: string;
    targeting: CreateCampaignTargeting;
    ads: Array<{
      ad_name: string;
      ad_status: 'ACTIVE' | 'PAUSED';
      title?: string;
      body?: string;
      asset_base64: string;
      asset_mimetype: string;
    }>;
  }>;
}

// `edicao` precisa chegar como uma STRING JSON sem chaves externas
// (`"status":"ACTIVE"`) — o controller faz `JSON.parse("{#{raw}}")`. Nunca
// mandar um objeto JS direto nesse campo.
function edicaoToString(edicao: Record<string, string>): string {
  return Object.entries(edicao)
    .map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
    .join(',');
}

class MetaAdsManagerService {
  async updateItem(nivel: MetaLevel, id: string, edicao: Record<string, string>): Promise<void> {
    await api.post(ENDPOINT, {
      acao: 'editar',
      nivel,
      id,
      edicao: edicaoToString(edicao),
    });
  }

  async toggleStatus(nivel: MetaLevel, id: string, newStatus: 'ACTIVE' | 'PAUSED'): Promise<void> {
    await this.updateItem(nivel, id, { status: newStatus });
  }

  async renameItem(nivel: MetaLevel, id: string, newName: string): Promise<void> {
    await this.updateItem(nivel, id, { name: newName });
  }

  // Excluir campanha/conjunto/anúncio na Graph API é, na prática, marcar
  // status=ARCHIVED — mesmo valor usado pelo painel legado (não DELETED),
  // ação sem uma "lixeira" real por trás, pode ser irreversível.
  async deleteItem(nivel: MetaLevel, id: string): Promise<void> {
    await this.updateItem(nivel, id, { status: 'ARCHIVED' });
  }

  async duplicateCampaignWithObjective(params: {
    campaignId: string;
    adAccountId: string;
    newName: string;
    newObjective: string;
    newOptimizationGoal?: string;
  }): Promise<void> {
    await api.post(ENDPOINT, {
      acao: 'duplicar_objetivo',
      id: params.campaignId,
      id_conta_anuncio: params.adAccountId,
      novo_objetivo: params.newObjective,
      novo_optimization_goal: params.newOptimizationGoal,
      overrides: { name: params.newName },
    });
  }

  async duplicateAdSetToCampaign(params: {
    adSetId: string;
    adAccountId: string;
    targetCampaignId: string;
    newName: string;
    newOptimizationGoal?: string;
  }): Promise<void> {
    await api.post(ENDPOINT, {
      acao: 'duplicar_adset_objetivo',
      id: params.adSetId,
      id_conta_anuncio: params.adAccountId,
      id_campanha_destino: params.targetCampaignId,
      novo_optimization_goal: params.newOptimizationGoal,
      overrides: { adset_name: params.newName },
    });
  }

  async duplicateAdToAdSet(params: {
    adId: string;
    adAccountId: string;
    targetAdSetId: string;
    newName: string;
  }): Promise<void> {
    await api.post(ENDPOINT, {
      acao: 'duplicar_anuncio_objetivo',
      id: params.adId,
      id_conta_anuncio: params.adAccountId,
      id_conjunto_destino: params.targetAdSetId,
      overrides: { ad_name: params.newName },
    });
  }

  async createCampaign(adAccountId: string, campanha: CreateCampaignPayload): Promise<void> {
    await api.post(ENDPOINT, {
      acao: 'criar_campanha',
      id_conta_anuncio: adAccountId,
      campanha,
    });
  }
}

export const metaAdsManagerService = new MetaAdsManagerService();
