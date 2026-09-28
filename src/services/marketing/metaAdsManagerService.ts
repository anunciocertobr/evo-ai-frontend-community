import api from '@/services/core/api';

const ENDPOINT = '/reports/meta_ads_manager';

export type MetaLevel = 'campaign' | 'adset' | 'ad';

// Cada objetivo do seletor carrega o par objective+optimization_goal de
// verdade que a Graph API espera — igual ao OBJECTIVE_MAP do painel legado
// (dashboards-src/painel_trafego.html), testado um por um contra conta real.
// Os 6 objetivos que o painel oferece — e só eles, como pedido. Cada um carrega
// o `objective` que a Graph API desta integração aceita de verdade: a versão
// da API em uso RECUSA os nomes modernos (AWARENESS, TRAFFIC, LEADS...) com
// "Objective is invalid. Use one of: ... OUTCOME_AWARENESS, OUTCOME_TRAFFIC,
// OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_APP_PROMOTION, OUTCOME_ENGAGEMENT",
// então os rótulos novos do Gerenciador de Anúncios são mapeados pra
// `OUTCOME_*`, que é o que a conta aceita.
export type ObjectiveKey = 'reconhecimento' | 'trafego' | 'engajamento' | 'leads' | 'app' | 'vendas';

export interface ObjectiveOption {
  objective: string;
  label: string;
  // Descrição curta que aparece no seletor — o usuário precisa saber a
  // diferença entre "Engajamento" e "Leads" sem abrir a Meta.
  hint: string;
  // Precisa do link do site no anúncio (clicar leva para a URL).
  needsLink: boolean;
  // Metas de desempenho (`optimization_goal`) que a Meta ACEITA para este
  // objetivo — todas testadas uma a uma na conta 588639403580243, o resto é
  // recusado com subcode 2490408 ("a meta de desempenho não está disponível").
  goals: Array<{ value: string; label: string }>;
}

export const OBJECTIVES: ObjectiveOption[] = [
  {
    objective: 'OUTCOME_AWARENESS',
    label: 'Reconhecimento',
    hint: 'Mostrar a marca para mais gente. Escolha entre alcance ou visualizações de vídeo.',
    needsLink: false,
    goals: [
      { value: 'REACH', label: 'Alcance (pessoas diferentes)' },
      { value: 'THRUPLAY', label: 'Visualizações de vídeo (10s)' },
    ],
  },
  {
    objective: 'OUTCOME_TRAFFIC',
    label: 'Tráfego',
    hint: 'Levar pessoas para o site, para a loja de aplicativos ou para a conversa.',
    needsLink: true,
    goals: [
      { value: 'LINK_CLICKS', label: 'Cliques no link' },
      { value: 'LANDING_PAGE_VIEWS', label: 'Visualizações da página' },
      { value: 'CONVERSIONS', label: 'Conversas (WhatsApp/Messenger)' },
    ],
  },
  {
    objective: 'OUTCOME_ENGAGEMENT',
    label: 'Engajamento',
    hint: 'Curtidas, comentários, compartilhamentos e também conversa no WhatsApp/Messenger.',
    needsLink: false,
    goals: [
      { value: 'POST_ENGAGEMENT', label: 'Engajamento com o post' },
      { value: 'EVENT_RESPONSES', label: 'Respostas a eventos' },
      { value: 'CONVERSATIONS', label: 'Conversas (WhatsApp/Messenger)' },
    ],
  },
  {
    objective: 'OUTCOME_LEADS',
    label: 'Leads',
    hint: 'Cadastro por formulário dentro do anúncio ou conversa de vendas no WhatsApp.',
    needsLink: false,
    goals: [
      { value: 'CONVERSIONS', label: 'Conversa no WhatsApp' },
      { value: 'LEAD_GENERATION', label: 'Formulário de cadastro' },
    ],
  },
  {
    objective: 'OUTCOME_APP_PROMOTION',
    label: 'Promoção do App',
    hint: 'Instalações e ações dentro do aplicativo. Exige o app vinculado à conta.',
    needsLink: false,
    goals: [
      { value: 'APP_INSTALLS', label: 'Instalações do app' },
      { value: 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS', label: 'Instalações e conversões no site' },
    ],
  },
  {
    objective: 'OUTCOME_SALES',
    label: 'Vendas',
    hint: 'Compras no site (pixel) ou venda na conversa do WhatsApp/Messenger.',
    needsLink: true,
    goals: [
      { value: 'OFFSITE_CONVERSIONS', label: 'Compras no site (pixel)' },
      { value: 'CONVERSATIONS', label: 'Conversas (WhatsApp/Messenger)' },
    ],
  },
];

// Chave estável usada nos formulários (vem da posição/literal acima).
export type ObjectiveKeyOf = ObjectiveKey;

export const OBJECTIVE_BY_KEY: Record<ObjectiveKey, ObjectiveOption> = OBJECTIVES.reduce(
  (acc, option, index) => {
    acc[(['reconhecimento', 'trafego', 'engajamento', 'leads', 'app', 'vendas'] as ObjectiveKey[])[index]] = option;
    return acc;
  },
  {} as Record<ObjectiveKey, ObjectiveOption>,
);

export const DEFAULT_OBJECTIVE: ObjectiveKey = 'trafego';

// Descobre a chave do objetivo a partir do que a Meta devolveu na campanha
// (`OUTCOME_*` ou os nomes antigos), pra pré-selecionar no formulário sem
// deixar o campo em branco quando a pessoa abre "duplicar".
export function objectiveKeyForValue(objectiveValue?: string | null): ObjectiveKey {
  const value = (objectiveValue || '').toUpperCase();
  if (!value) return DEFAULT_OBJECTIVE;
  if (value.includes('AWARENESS')) return 'reconhecimento';
  if (value.includes('TRAFFIC')) return 'trafego';
  if (value.includes('ENGAGEMENT')) return 'engajamento';
  if (value.includes('LEADS') || value.includes('LEAD_GENERATION')) return 'leads';
  if (value.includes('APP')) return 'app';
  if (value.includes('SALES') || value.includes('CONVERSION')) return 'vendas';
  return DEFAULT_OBJECTIVE;
}

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
    // Texto livre que identifica o conjunto dentro do Gerenciador de Anúncios.
    description?: string;
    // Ausente quando o orçamento está na campanha (CBO).
    daily_budget?: string;
    // Orçamento vitalício: valor total do período. Exige `end_time` — a Meta
    // recusa sem data de término com o subcode 1487094.
    lifetime_budget?: string;
    end_time?: string;
    optimization_goal: string;
    bid_strategy: string;
    // Limite de lance/custo-alvo no formato de exibição (ex.: "15.00"). O
    // backend converte para centavos inteiros — mandar centavos aqui também
    // faria a conversão acontecer duas vezes.
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

// Número de WhatsApp que a conta de anúncios já usa naquela página. A WABA não
// é legível pelo token de página (a Meta recusa
// `/{page}/whatsapp_business_accounts` e `/{waba}/phone_numbers` com "Tried
// accessing nonexisting field"), então a lista vem dos `promoted_object` dos
// conjuntos da própria conta — que é exatamente o conjunto de números que ela
// consegue anunciar.
export interface WhatsappNumberOption {
  phone_number: string;
  waba_id?: string | null;
  source?: string;
}

export class MetaAdsManagerService {
  // Números de WhatsApp que a conta já usa na página escolhida.
  async listWhatsappNumbers(adAccountId: string, pageId: string): Promise<WhatsappNumberOption[]> {
    if (!pageId) return [];
    const response = await api.post<WhatsappNumberOption[]>(ENDPOINT, {
      acao: 'listar_numeros_whatsapp',
      id_conta_anuncio: adAccountId,
      id_pagina: pageId,
    });
    return response.data || [];
  }

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
