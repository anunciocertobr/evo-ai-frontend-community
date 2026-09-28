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

// Onde a conversa acontece quando o objetivo é mensagens. Cada destino muda
// TRÊS campos ao mesmo tempo no backend (destination_type do conjunto,
// promoted_object e o CTA do criativo) — ver Meta::AdsManagerService#messaging_cta
// e #messaging_promoted_object. Por isso a escolha é única aqui, e não três
// campos soltos que dessincronizariam entre si.
export type MensagemDestino = 'MESSENGER' | 'WHATSAPP' | 'INSTAGRAM';

export const MENSAGEM_DESTINOS: Array<{ value: MensagemDestino; label: string; hint: string; needsPhone?: boolean }> = [
  { value: 'MESSENGER', label: 'Messenger', hint: 'Chat na página do Facebook' },
  { value: 'WHATSAPP', label: 'WhatsApp', hint: 'Conversa no WhatsApp', needsPhone: true },
  { value: 'INSTAGRAM', label: 'Direct do Instagram', hint: 'Chat no perfil da página' },
];

// Eventos de conversão aceitos pela Meta em `conversion_location`. A lista é
//fechada porque a Graph API recusa qualquer valor fora dela.
export const CONVERSION_EVENTS = ['PURCHASE', 'LEAD', 'SIGN_UP', 'ADD_TO_CART', 'INITIATE_CHECKOUT', 'DOWNLOAD', 'SUBSCRIBE'] as const;

export type ConversionEvent = (typeof CONVERSION_EVENTS)[number];

export interface CreateCampaignTargeting {
  age_min: number;
  age_max: number;
  publisher_platforms: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  custom_audience_id?: string;
  // Nome do público salvo escolhido no seletor — o backend
  // (Meta::AdsManagerService#resolve_audience) busca por nome na Meta e
  // reaproveita o targeting inteiro salvo (aba Direcionamento).
  saved_audience_name?: string;
  detailed_targeting_manual?: string[];
  geo_locations: {
    // `location_types` é campo obsoleto: a Graph API atual recusa o array com
    // o subcode 1870199. O app não manda mais, e `countries` é o formato que
    // a Meta aceita para país.
    location_types?: string[];
    countries?: string[];
    // Pin do mapa (lat/lng + raio) — `key: 'custom_location_pin'` é o
    // formato que Meta::AdsManagerService#normalize_geo já sabe converter
    // pra `geo_locations.custom_locations` (formato real da Graph API).
    cities?: Array<{ key: string; name: string; radius: number; distance_unit: string; latitude: number; longitude: number }>;
  };
}

// Campos que pertencem ao NÍVEL DO CONJUNTO na Meta, e que por isso ficam
// separados dos da campanha. Viajam dentro do objeto de cada adset em
// `criar_campanha` e dentro de `overrides` nas duplicações — o backend lê
// exatamente estes nomes.
export interface AdSetLevelOptions {
  // Página que roda o conjunto. Antes era sempre a página conectada; o
  // backend agora busca o token da página escolhida.
  page_id?: string;
  // Objetivo de mensagens: destino + número do WhatsApp quando aplicável.
  mensagem_destino?: MensagemDestino;
  whatsapp_phone_number?: string;
  // Objetivo de conversão: local de conversão (site/app) + evento.
  conversion_location?: string;
  conversion_app?: string;
  conversion_event?: ConversionEvent;
  // Pixel usado como evento de conversão quando o local é o site.
  pixel_id?: string;
}

export interface CreateCampaignPayload {
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  objective: string;
  link?: string;
  // Orçamento diário da campanha (CBO). Quando presente, o backend descarta o
  // `daily_budget` de cada conjunto e exige limite de lance por conjunto.
  campaign_daily_budget?: string;
  adsets: Array<AdSetLevelOptions & {
    adset_name: string;
    adset_status: 'ACTIVE' | 'PAUSED';
    // Ausente quando o orçamento está na campanha (CBO).
    daily_budget?: string;
    optimization_goal: string;
    bid_strategy: string;
    // Limite de lance/custo-alvo em centavos — exigido pela Meta quando há CBO.
    bid_amount?: string;
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

// Tira `undefined`/string vazia do overrides: o backend usa `.presence` em
// cada campo, mas mandar `page_id: ''` faria ele cair no default errado
// (string vazia não é `nil`, mas também não é a página escolhida).
function stripEmpty(overrides?: Record<string, unknown>): Record<string, unknown> {
  if (!overrides) return {};
  return Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export interface AdAccountPage {
  id: string;
  name: string;
  instagram_business_account?: { id?: string; username?: string } | null;
}

export class MetaAdsManagerService {
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

  // `overrides` aceita os campos do nível do CONJUNTO (orçamento, página,
  // destino de mensagens, local de conversão) e o `targeting` copiado da
  // origem — é o que faz a cópia respeitar o que a pessoa escolheu no modal em
  // vez de repetir cegamente o da campanha original.
  async duplicateCampaignWithObjective(params: {
    campaignId: string;
    adAccountId: string;
    newName: string;
    newObjective: string;
    newOptimizationGoal?: string;
    overrides?: Record<string, unknown>;
  }): Promise<void> {
    await api.post(ENDPOINT, {
      acao: 'duplicar_objetivo',
      id: params.campaignId,
      id_conta_anuncio: params.adAccountId,
      novo_objetivo: params.newObjective,
      novo_optimization_goal: params.newOptimizationGoal,
      overrides: { name: params.newName, ...stripEmpty(params.overrides) },
    });
  }

  async duplicateAdSetToCampaign(params: {
    adSetId: string;
    adAccountId: string;
    targetCampaignId: string;
    newName: string;
    newOptimizationGoal?: string;
    overrides?: Record<string, unknown>;
  }): Promise<void> {
    await api.post(ENDPOINT, {
      acao: 'duplicar_adset_objetivo',
      id: params.adSetId,
      id_conta_anuncio: params.adAccountId,
      id_campanha_destino: params.targetCampaignId,
      novo_optimization_goal: params.newOptimizationGoal,
      overrides: { adset_name: params.newName, ...stripEmpty(params.overrides) },
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

  // Páginas que podem rodar anúncio nesta conta de anúncios. A Meta não tem
  // "conta de anúncios → páginas" direto: as páginas vêm da BM dona da conta
  // (`/act_{id}/...` via `owning_business_of_ad_account` no backend). Por isso
  // a lista é da BM, e a pré-seleção no front é por conta — a Meta só aceita
  // página que esteja na mesma BM.
  //
  // `instagram_id` vem preenchido só nas páginas com perfil profissional
  // ligado, e é o que permite oferecer Direct do Instagram como destino.
  async listPages(adAccountId: string, businessId?: string): Promise<AdAccountPage[]> {
    const response = await api.post<AdAccountPage[]>(ENDPOINT, {
      acao: 'listar_paginas_por_conta',
      id_conta_anuncio: adAccountId,
      id_bm: businessId,
    });
    return response.data || [];
  }

  async getCreativeDetails(adId: string): Promise<CreativeDetails> {
    const response = await api.post<Array<CreativeDetails>>(ENDPOINT, {
      acao: 'criativo',
      id_anuncio: adId,
    });
    return (
      response.data?.[0] || {
        imagem: null,
        video: null,
        thumbnail_url: null,
        carrossel: [],
        titulo: null,
        texto_principal: null,
        criativo_nome: null,
      }
    );
  }
}

export interface CreativeCarouselCard {
  imagem: string | null;
  nome: string | null;
  descricao: string | null;
}

export interface CreativeDetails {
  imagem: string | null;
  video: string | null;
  thumbnail_url: string | null;
  carrossel: CreativeCarouselCard[];
  titulo: string | null;
  texto_principal: string | null;
  criativo_nome: string | null;
}

export const metaAdsManagerService = new MetaAdsManagerService();
