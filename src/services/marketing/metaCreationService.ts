import api from '@/services/core/api';

const ENDPOINT = '/reports/meta_ads_manager';

export interface FacebookPageOption {
  id: string;
  name: string;
}

export interface LeadForm {
  id: string;
  name: string;
  status: string;
  leads_count?: number;
  created_time?: string;
}

export interface LeadFormLead {
  id: string;
  created_time: string;
  field_data: Array<{ name: string; values: string[] }>;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
}

export interface LeadQuestionOption {
  key: string;
  value: string;
}

export interface LeadQuestion {
  type: string;
  key?: string;
  label?: string;
  options?: LeadQuestionOption[];
}

export interface LeadFormDetail {
  id: string;
  name: string;
  status: string;
  questions: LeadQuestion[];
  legal_content?: { privacy_policy?: { url: string; link_text: string } };
  context_card?: { title: string; content: string[]; button_text: string };
  thank_you_page?: {
    title: string;
    body: string;
    button_type: string;
    button_text: string;
    website_url?: string;
  };
  follow_up_action_url?: string;
}

// Catálogo de perguntas padrão da Meta, agrupado como no Gerenciador de
// Anúncios — confirmado contra a Graph API real (v23.0): pedir um tipo fora
// desta lista responde 400 listando o enum aceito.
export const QUESTION_CATEGORIES: Array<{ label: string; options: Array<{ type: string; label: string }> }> = [
  {
    label: 'Contato',
    options: [
      { type: 'FULL_NAME', label: 'Nome completo' },
      { type: 'FIRST_NAME', label: 'Primeiro nome' },
      { type: 'LAST_NAME', label: 'Sobrenome' },
      { type: 'EMAIL', label: 'Email' },
      { type: 'PHONE', label: 'Telefone' },
      { type: 'WHATSAPP_NUMBER', label: 'WhatsApp' },
    ],
  },
  {
    label: 'Informações do usuário',
    options: [
      { type: 'CITY', label: 'Cidade' },
      { type: 'STATE', label: 'Estado' },
      { type: 'PROVINCE', label: 'Província' },
      { type: 'COUNTRY', label: 'País' },
      { type: 'ZIP', label: 'CEP' },
      { type: 'POST_CODE', label: 'Código postal' },
      { type: 'STREET_ADDRESS', label: 'Endereço' },
      { type: 'ADDRESS_LINE_TWO', label: 'Complemento' },
      { type: 'DOB', label: 'Data de nascimento' },
      { type: 'GENDER', label: 'Gênero' },
    ],
  },
  {
    label: 'Dados demográficos',
    options: [
      { type: 'MARITIAL_STATUS', label: 'Estado civil' },
      { type: 'RELATIONSHIP_STATUS', label: 'Situação de relacionamento' },
      { type: 'MILITARY_STATUS', label: 'Situação militar' },
      { type: 'EDUCATION_LEVEL', label: 'Escolaridade' },
    ],
  },
  {
    label: 'Informações profissionais',
    options: [
      { type: 'JOB_TITLE', label: 'Cargo' },
      { type: 'COMPANY_NAME', label: 'Empresa' },
      { type: 'WORK_EMAIL', label: 'Email profissional' },
      { type: 'WORK_PHONE_NUMBER', label: 'Telefone profissional' },
    ],
  },
  {
    label: 'Documento de identidade',
    options: [
      { type: 'ID_CPF', label: 'CPF (Brasil)' },
      { type: 'ID_AR_DNI', label: 'DNI (Argentina)' },
      { type: 'ID_CL_RUT', label: 'RUT (Chile)' },
      { type: 'ID_CO_CC', label: 'Cédula (Colômbia)' },
      { type: 'ID_EC_CI', label: 'Cédula (Equador)' },
      { type: 'ID_PE_DNI', label: 'DNI (Peru)' },
      { type: 'ID_MX_RFC', label: 'RFC (México)' },
    ],
  },
  {
    label: 'Agendamento',
    options: [{ type: 'DATE_TIME', label: 'Data e hora marcada' }],
  },
];

// Enum confirmado contra a Graph API real (pedir um valor inválido responde
// 400 listando os aceitos): VIEW_WEBSITE, CALL_BUSINESS, MESSAGE_BUSINESS,
// DOWNLOAD, SCHEDULE_APPOINTMENT, VIEW_ON_FACEBOOK, PROMO_CODE, NONE,
// WHATSAPP, P2B_MESSENGER, BOOK_ON_WEBSITE.
export const THANK_YOU_BUTTON_TYPES: Array<{ value: string; label: string }> = [
  { value: 'VIEW_WEBSITE', label: 'Ir para o site' },
  { value: 'DOWNLOAD', label: 'Ver arquivos' },
  { value: 'CALL_BUSINESS', label: 'Ligar para a empresa' },
  { value: 'WHATSAPP', label: 'Conversar no WhatsApp' },
  { value: 'MESSAGE_BUSINESS', label: 'Enviar mensagem' },
  { value: 'P2B_MESSENGER', label: 'Mensagem no Messenger' },
  { value: 'PROMO_CODE', label: 'Resgatar código promocional' },
  { value: 'SCHEDULE_APPOINTMENT', label: 'Agendar horário' },
  { value: 'BOOK_ON_WEBSITE', label: 'Agendar no site' },
  { value: 'VIEW_ON_FACEBOOK', label: 'Ver no Facebook' },
  { value: 'NONE', label: 'Nenhuma ação' },
];

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

export interface MetaPageRef {
  id: string;
  name: string;
}

export interface MetaInstagramAccount {
  id: string;
  username?: string;
  name: string;
  page_id: string;
  page_name: string;
}

// Origem do vídeo no público de vídeo, igual às abas do Gerenciador de
// Anúncios: Página do Facebook, Instagram ou a própria conta conectada.
// `id` muda de significado conforme a origem (page_id / ig_user_id).
export type MetaVideoSource = 'page' | 'ig' | 'conta';

export interface MetaVideo {
  id: string;
  title?: string;
  description?: string;
  caption?: string;
  source: MetaVideoSource;
  source_name?: string;
  media_type?: string;
  created_time?: string;
  length?: number;
  views_count?: number;
  like_count?: number;
  comments_count?: number;
  permalink_url?: string;
  thumbnail_url?: string;
}

// Usado no duplicar pra preencher o formulário com o que o público de origem
// REALMENTE é. A Meta não expõe video_id/page_id/app_id na leitura — o que
// volta é a `rule` (event_sources + filtro de evento/URL), o `data_source*`,
// o `pixel_id` e o `lookalike_spec` — então o front deduz o tipo a partir
// disso (ver parseAudienceDetail). Os campos abaixo são os que a API aceita
// de verdade: pedir `prefill`, `origin_audience_id`, `video_group_ids`,
// `facebook_page_id`, `creation_params` ou `event_sources` derruba a leitura
// INTEIRA do público com "Tried accessing nonexisting field", que era o que
// fazia o duplicar na mesma conta vir sem formulário preenchido.
export interface AudienceDetail {
  id: string;
  name: string;
  subtype: string;
  description?: string;
  retention_days?: number;
  lookalike_spec?: { type?: string; ratio?: number; country?: string; source_spec?: unknown };
  pixel_id?: string;
  rule?: string;
  data_source?: { type?: string; subtype?: string; sub_type?: string };
  data_source_types?: string[];
  included_custom_audiences?: Array<{ id?: string | number }>;
  excluded_custom_audiences?: Array<{ id?: string | number }>;
  account_id?: string;
  approximate_count_lower_bound?: number;
  delivery_status?: number;
}

export type TargetingCategory = 'interests' | 'behaviors' | 'demographics';

export interface TargetingItem {
  id: string;
  name: string;
  type?: string;
  path?: string[];
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
}

// Um item escolhido guarda a categoria junto (a Graph API exige o
// flexible_spec agrupado por interests/behaviors/demographics, não uma
// lista solta) — ver groupTargetingItems no TargetingBuilder.
export interface ChosenTargetingItem extends TargetingItem {
  category: TargetingCategory;
}

export interface TargetingSpec {
  // A Graph API devolve `countries` quando o público usa país simples, mas
  // um público salvo com segmentação geográfica de verdade também traz
  // `cities`/`places` (cidade real, sem coordenada) e/ou `custom_locations`
  // (pin+raio, com latitude/longitude) — mesmo formato de AdSetTargeting em
  // trafficMetrics.ts. `countries` é opcional porque o TargetingBuilder
  // manda só `custom_locations` (sem país) quando o usuário escolhe
  // localização específica em vez de país.
  geo_locations: {
    countries?: string[];
    cities?: Array<{ name?: string; region?: string; country?: string; radius?: number; distance_unit?: string; lat?: number; lng?: number }>;
    places?: Array<{ name?: string; region?: string; country?: string; radius?: number; distance_unit?: string; lat?: number; lng?: number }>;
    custom_locations?: Array<{ latitude?: number; longitude?: number; radius?: number; distance_unit?: string }>;
  };
  age_min: number;
  age_max: number;
  genders?: number[];
  flexible_spec?: Array<Record<TargetingCategory, Array<{ id: string; name: string }>>>;
  exclusions?: Partial<Record<TargetingCategory, Array<{ id: string; name: string }>>>;
  // Públicos personalizados e semelhantes incluídos no público salvo — o
  // Ad Manager permite misturar os dois ("Públicos incluídos" > "Públicos
  // personalizados"). A Graph API espera só os ids em `custom_audiences`.
  custom_audiences?: Array<{ id: string }>;
  // Advantage+ Audience: quando ligado (1), a Meta trata idade/localização/
  // interesses como SUGESTÃO e pode expandir o público automaticamente
  // buscando conversão — perde parte do controle manual. Preferência padrão
  // do CRM é manual (0/omitido); só liga quando o usuário escolhe
  // explicitamente no TargetingBuilder.
  targeting_automation?: { advantage_audience?: 0 | 1 };
}

// Lista curada e reutilizável de itens de direcionamento, salva localmente
// no CRM (a Graph API não tem esse conceito solto) — serve como "banco" de
// onde um público/grupo de direcionamento pode puxar um subconjunto.
export interface TargetingList {
  id: string;
  name: string;
  items: ChosenTargetingItem[];
}

export interface LocationGroupPin {
  name: string;
  lat: number;
  lng: number;
  radius: number;
  // true = região de exclusão (a Meta não anuncia ali). Ausente = inclusão.
  exclude?: boolean;
}

// Grupo de localizações (região + raio) salvo localmente no CRM, POR CONTA
// DE ANÚNCIO — diferente da TargetingList acima, que é global. Pensado pra
// reaproveitar o mesmo recorte geográfico ao montar o direcionamento de um
// conjunto de anúncios, e pra duplicar tanto dentro da mesma conta quanto
// pra outra (os pins não têm nenhuma dependência da conta de origem).
export interface LocationGroup {
  id: string;
  ad_account_id: string;
  name: string;
  pins: LocationGroupPin[];
}

// Público salvo de verdade na Meta (geo/idade/gênero/interesses completo,
// vinculado a uma conta de anúncio específica) — diferente da TargetingList
// acima, que é só um recorte de itens salvo localmente sem conta associada.
export interface SavedAudience {
  id: string;
  name: string;
  description?: string;
  targeting: TargetingSpec;
  approximate_count?: number;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
}

// Imagem/vídeo já existente na biblioteca de criativos da conta de anúncio
// (/act_X/adimages e /act_X/advideos) — reaproveitável em qualquer anúncio
// novo sem precisar subir de novo.
export interface AdCreativeImage {
  id: string;
  name?: string;
  url: string;
  hash: string;
  width?: number;
  height?: number;
  created_time?: string;
  permalink_url?: string;
}

export interface AdCreativeVideo {
  id: string;
  title?: string;
  picture?: string;
  source?: string;
  created_time?: string;
  length?: number;
  status?: { video_status?: string };
}

export interface ReachEstimate {
  estimate_mau_lower_bound?: number;
  estimate_mau_upper_bound?: number;
  estimate_dau_lower_bound?: number;
  estimate_dau_upper_bound?: number;
}

// Eventos de engajamento aceitos pela Graph API como `event` da rule de um
// público de engajamento de Página do Facebook (o mesmo conjunto de
// "Engagement rules" da doc). A UI também deixa digitar qualquer outro valor.
export const META_ENGAGEMENT_EVENTS: Array<{ value: string; label: string }> = [
  { value: 'page_engaged', label: 'Interagiu com a página (qualquer interação)' },
  { value: 'page_post_interaction', label: 'Interagiu com posts da página (reação, comentário, compartilhamento)' },
  { value: 'lead_form_open', label: 'Abriu o formulário de lead' },
  { value: 'instant_experience_open', label: 'Abriu o anúncio de experiência instantânea' },
];

// Eventos de perfil profissional do Instagram — o `type` do event_source é
// "page", mas quem distingue é o prefixo `ig_` no filtro de evento.
export const META_INSTAGRAM_EVENTS: Array<{ value: string; label: string }> = [
  { value: 'ig_business_profile_engaged', label: 'Interagiu com o perfil ou o conteúdo do Instagram' },
  { value: 'ig_business_profile_all', label: 'Visitou o perfil OU mandou mensagem (o mais amplo)' },
  { value: 'ig_user_messaged_business', label: 'Mandou mensagem no direct do Instagram' },
];

// Eventos de app mais usados — o campo aceita qualquer nome de evento do App
// Events API, então a UI deixa digitar o que quiser também.
export const META_APP_EVENTS: Array<{ value: string; label: string }> = [
  { value: 'any', label: 'Qualquer evento do app (abriu o app)' },
  { value: 'AddToCart', label: 'AddToCart (adicionou ao carrinho)' },
  { value: 'Purchase', label: 'Purchase (comprou)' },
  { value: 'InitiateCheckout', label: 'InitiateCheckout (iniciou o checkout)' },
  { value: 'CompleteRegistration', label: 'CompleteRegistration (criou conta)' },
  { value: 'Lead', label: 'Lead (enviou formulário)' },
  { value: 'Search', label: 'Search (buscou no app)' },
  { value: 'LevelUp', label: 'LevelUp (subiu de nível)' },
];

export interface LeadFormCreatePayload {
  pageId: string;
  name: string;
  questions: LeadQuestion[];
  privacyPolicyUrl?: string;
  privacyPolicyLinkText?: string;
  greetingTitle?: string;
  greetingContent?: string[];
  greetingButtonText?: string;
  thankYouTitle?: string;
  thankYouBody?: string;
  thankYouButtonType?: string;
  thankYouButtonText?: string;
  thankYouWebsiteUrl?: string;
}

class MetaCreationService {
  // --- Formulários de Lead ---
  // Formulários pertencem a uma PÁGINA (não à conta de anúncio) — por isso
  // o fluxo é BM > Página, não BM > Conta como nas outras abas.

  async listPagesForBm(businessId: string): Promise<FacebookPageOption[]> {
    const response = await api.post<FacebookPageOption[]>(ENDPOINT, {
      acao: 'listar_paginas',
      id_bm: businessId,
    });
    return response.data || [];
  }

  async listLeadForms(pageId: string): Promise<LeadForm[]> {
    const response = await api.post<LeadForm[]>(ENDPOINT, {
      acao: 'listar_formularios_lead',
      id_pagina: pageId,
    });
    return response.data || [];
  }

  async getLeadFormDetail(pageId: string, formId: string): Promise<LeadFormDetail> {
    const response = await api.post<LeadFormDetail>(ENDPOINT, {
      acao: 'detalhe_formulario_lead',
      id_pagina: pageId,
      id_formulario: formId,
    });
    return response.data;
  }

  async updateLeadFormStatus(pageId: string, formId: string, status: 'ACTIVE' | 'ARCHIVED'): Promise<void> {
    await api.post(ENDPOINT, {
      acao: 'atualizar_status_formulario_lead',
      id_pagina: pageId,
      id_formulario: formId,
      status,
    });
  }

  // Todos os leads já recebidos por esse formulário, direto na Graph API
  // (histórico completo, não só o que passou pelo webhook de importação).
  async listFormLeads(pageId: string, formId: string): Promise<LeadFormLead[]> {
    const response = await api.post<LeadFormLead[]>(ENDPOINT, {
      acao: 'leads_formulario_lead',
      id_pagina: pageId,
      id_formulario: formId,
    });
    return response.data || [];
  }

  private toLeadFormParams(payload: LeadFormCreatePayload) {
    return {
      id_pagina: payload.pageId,
      name: payload.name,
      questions: JSON.stringify(payload.questions),
      privacy_policy_url: payload.privacyPolicyUrl,
      privacy_policy_link_text: payload.privacyPolicyLinkText,
      greeting_title: payload.greetingTitle,
      greeting_content: payload.greetingContent ? JSON.stringify(payload.greetingContent) : undefined,
      greeting_button_text: payload.greetingButtonText,
      thank_you_title: payload.thankYouTitle,
      thank_you_body: payload.thankYouBody,
      thank_you_button_type: payload.thankYouButtonType,
      thank_you_button_text: payload.thankYouButtonText,
      thank_you_website_url: payload.thankYouWebsiteUrl,
    };
  }

  async createLeadForm(payload: LeadFormCreatePayload): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>(ENDPOINT, {
      acao: 'criar_formulario_lead',
      ...this.toLeadFormParams(payload),
    });
    return response.data;
  }

  async duplicateLeadForm(params: {
    sourcePageId: string;
    formId: string;
    targetPageId: string;
    overrides: Partial<LeadFormCreatePayload>;
  }): Promise<{ id: string }> {
    const overrideParams = this.toLeadFormParams(params.overrides as LeadFormCreatePayload);
    delete (overrideParams as { id_pagina?: string }).id_pagina;
    const response = await api.post<{ id: string }>(ENDPOINT, {
      acao: 'duplicar_formulario_lead',
      id_pagina_origem: params.sourcePageId,
      id_formulario: params.formId,
      id_pagina_destino: params.targetPageId,
      overrides: overrideParams,
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

  async getAudienceDetail(audienceId: string): Promise<AudienceDetail> {
    const response = await api.post<AudienceDetail>(ENDPOINT, {
      acao: 'detalhe_publico',
      id_publico: audienceId,
    });
    return response.data;
  }

  // Nome de um público (usado pra casar o público de origem de um semelhante
  // com o público de mesmo nome que existe na conta de destino, ao duplicar).
  async getAudienceName(audienceId: string): Promise<{ id: string; name: string }> {
    const response = await api.post<{ id: string; name: string }>(ENDPOINT, {
      acao: 'nome_publico',
      id_publico: audienceId,
    });
    return response.data;
  }

  // Páginas + perfis de Instagram, pra montar os públicos de engajamento
  // (Facebook Page / Instagram) e a origem de vídeo. `businessId` é a BM
  // selecionada na UI e é obrigatória na prática: a conta de anúncio pode ser
  // cliente de outra BM, e resolver pelo `owner` da conta traz as Páginas
  // erradas (ou nenhuma).
  async listPagesForAdAccount(adAccountId: string, businessId?: string | null): Promise<MetaPageRef[]> {
    const response = await api.post<MetaPageRef[]>(ENDPOINT, {
      acao: 'listar_paginas_por_conta',
      id_conta_anuncio: adAccountId,
      id_bm: businessId ?? undefined,
    });
    return response.data || [];
  }

  async listInstagramAccounts(businessId: string): Promise<MetaInstagramAccount[]> {
    const response = await api.post<MetaInstagramAccount[]>(ENDPOINT, {
      acao: 'listar_instagram_por_conta',
      id_bm: businessId,
    });
    return response.data || [];
  }

  // Vídeos disponíveis pra origem do público de vídeo, com as informações
  // que a tela mostra. A Meta não devolve o `video_id` na leitura do público,
  // então a lista é a única forma de o usuário escolher o vídeo certo.
  async listVideosForSource(source: MetaVideoSource, sourceId?: string): Promise<MetaVideo[]> {
    const response = await api.post<MetaVideo[]>(ENDPOINT, {
      acao: 'listar_videos_por_origem',
      origem: source,
      id_origem: sourceId,
    });
    return response.data || [];
  }

  // Exclusão definitiva do público (DELETE por nó na Graph API). Sem volta:
  // a UI pede confirmação com o nome antes de chamar.
  async deleteAudience(audienceId: string): Promise<{ id: string; name: string; deleted: boolean }> {
    const response = await api.post<{ id: string; name: string; deleted: boolean }>(ENDPOINT, {
      acao: 'excluir_publico',
      id_publico: audienceId,
    });
    return response.data;
  }

  async getInstagramAccountForPage(pageId: string): Promise<{ id: string; name: string }> {
    const response = await api.post<{ id: string; name: string }>(ENDPOINT, {
      acao: 'conta_instagram_da_pagina',
      id_pagina: pageId,
    });
    return response.data;
  }

  async createEngagementAudience(payload: {
    adAccountId: string;
    name: string;
    pageId: string;
    retentionDays: number;
    eventValue?: string;
    description?: string;
  }): Promise<CustomAudience> {
    const response = await api.post<CustomAudience>(ENDPOINT, {
      acao: 'criar_publico_engajamento',
      id_conta_anuncio: payload.adAccountId,
      name: payload.name,
      page_id: payload.pageId,
      retention_days: payload.retentionDays,
      evento: payload.eventValue,
      description: payload.description,
    });
    return response.data;
  }

  async createInstagramAudience(payload: {
    adAccountId: string;
    name: string;
    igUserId: string;
    retentionDays: number;
    eventValue?: string;
    description?: string;
  }): Promise<CustomAudience> {
    const response = await api.post<CustomAudience>(ENDPOINT, {
      acao: 'criar_publico_instagram',
      id_conta_anuncio: payload.adAccountId,
      name: payload.name,
      ig_user_id: payload.igUserId,
      retention_days: payload.retentionDays,
      evento: payload.eventValue,
      description: payload.description,
    });
    return response.data;
  }

  async createAppAudience(payload: {
    adAccountId: string;
    name: string;
    appId: string;
    retentionDays: number;
    eventName?: string;
    description?: string;
  }): Promise<CustomAudience> {
    const response = await api.post<CustomAudience>(ENDPOINT, {
      acao: 'criar_publico_app',
      id_conta_anuncio: payload.adAccountId,
      name: payload.name,
      app_id: payload.appId,
      retention_days: payload.retentionDays,
      evento: payload.eventName,
      description: payload.description,
    });
    return response.data;
  }

  async createVideoAudience(payload: {
    adAccountId: string;
    name: string;
    videoId: string;
    retentionDays: number;
    description?: string;
  }): Promise<CustomAudience> {
    const response = await api.post<CustomAudience>(ENDPOINT, {
      acao: 'criar_publico_video',
      id_conta_anuncio: payload.adAccountId,
      name: payload.name,
      video_id: payload.videoId,
      retention_days: payload.retentionDays,
      description: payload.description,
    });
    return response.data;
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
    originAudienceId?: string;
    // source_spec: JSON da regra da fonte (site/página/Instagram/app/vídeo).
    // É o que permite "semelhante de site" etc. sem criar antes o público
    // semente — além do formato já existente (origin_audience_id).
    sourceSpec?: Record<string, unknown>;
    lookalikeType?: 'similarity' | 'reach';
    country: string;
    ratio: number;
  }): Promise<CustomAudience> {
    const response = await api.post<CustomAudience>(ENDPOINT, {
      acao: 'criar_publico_semelhante',
      id_conta_anuncio: payload.adAccountId,
      name: payload.name,
      origin_audience_id: payload.originAudienceId,
      source_spec: payload.sourceSpec ? JSON.stringify(payload.sourceSpec) : undefined,
      tipo_similaridade: payload.lookalikeType,
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

  // --- Direcionamento Detalhado ---

  async searchTargeting(category: TargetingCategory, query: string): Promise<TargetingItem[]> {
    const response = await api.post<TargetingItem[]>(ENDPOINT, {
      acao: 'buscar_direcionamento',
      categoria: category,
      q: query,
    });
    return response.data || [];
  }

  async getTargetingSuggestions(interestNames: string[]): Promise<TargetingItem[]> {
    const response = await api.post<TargetingItem[]>(ENDPOINT, {
      acao: 'sugestoes_direcionamento',
      interesses: JSON.stringify(interestNames),
    });
    return response.data || [];
  }

  async estimateReach(adAccountId: string, targeting: TargetingSpec): Promise<ReachEstimate> {
    const response = await api.post<ReachEstimate>(ENDPOINT, {
      acao: 'estimar_alcance',
      id_conta_anuncio: adAccountId,
      targeting: JSON.stringify(targeting),
    });
    return response.data;
  }

  async createSavedAudience(adAccountId: string, name: string, targeting: TargetingSpec): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>(ENDPOINT, {
      acao: 'criar_publico_salvo',
      id_conta_anuncio: adAccountId,
      name,
      targeting: JSON.stringify(targeting),
    });
    return response.data;
  }

  async listSavedAudiences(adAccountId: string): Promise<SavedAudience[]> {
    const response = await api.post<SavedAudience[]>(ENDPOINT, {
      acao: 'listar_publicos_salvos',
      id_conta_anuncio: adAccountId,
    });
    // O backend devolve os bounds da Graph API (o campo `approximate_count`
    // não existe no edge /saved_audiences); normalizamos pro count exibido.
    return (response.data || []).map((sa) => ({
      ...sa,
      approximate_count: sa.approximate_count ?? sa.approximate_count_lower_bound,
    }));
  }

  async duplicateSavedAudience(params: {
    sourceAudienceId: string;
    targetAccountId: string;
    overrides?: { name?: string; targeting?: TargetingSpec };
  }): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>(ENDPOINT, {
      acao: 'duplicar_publico_salvo',
      id_publico_salvo: params.sourceAudienceId,
      id_conta_destino: params.targetAccountId,
      overrides: {
        name: params.overrides?.name,
        targeting: params.overrides?.targeting ? JSON.stringify(params.overrides.targeting) : undefined,
      },
    });
    return response.data;
  }

  // Sobrescreve nome/targeting de um público salvo que já existe na Meta —
  // diferente de duplicar, aqui o id continua o mesmo (os conjuntos de
  // anúncios que já usam esse público passam a usar a versão nova).
  async updateSavedAudience(savedAudienceId: string, name: string, targeting: TargetingSpec): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>(ENDPOINT, {
      acao: 'atualizar_publico_salvo',
      id_publico_salvo: savedAudienceId,
      name,
      targeting: JSON.stringify(targeting),
    });
    return response.data;
  }

  // Targeting completo de um público salvo específico — usado pra abrir o
  // formulário de edição já preenchido.
  async getSavedAudienceDetail(savedAudienceId: string): Promise<SavedAudience> {
    const response = await api.post<SavedAudience>(ENDPOINT, {
      acao: 'detalhe_publico_salvo',
      id_publico_salvo: savedAudienceId,
    });
    return response.data;
  }

  async deleteSavedAudience(savedAudienceId: string): Promise<void> {
    await api.post(ENDPOINT, { acao: 'excluir_publico_salvo', id_publico_salvo: savedAudienceId });
  }

  // --- Biblioteca de criativos (imagens/vídeos já na conta de anúncio) --
  // Testado ao vivo: listar e excluir já funcionam com o acesso atual do
  // app. Só subir (uploadCreativeImageByUrl) depende do Marketing API
  // Access Tier estar em "Full access" — até a Meta aprovar, só essa ação
  // devolve erro (mensagem real da Graph API já vem no response, sem
  // precisar tratamento especial aqui).

  async listCreativeImages(adAccountId: string): Promise<AdCreativeImage[]> {
    const response = await api.post<AdCreativeImage[]>(ENDPOINT, {
      acao: 'listar_imagens_criativo',
      id_conta_anuncio: adAccountId,
    });
    return response.data || [];
  }

  async listCreativeVideos(adAccountId: string): Promise<AdCreativeVideo[]> {
    const response = await api.post<AdCreativeVideo[]>(ENDPOINT, {
      acao: 'listar_videos_criativo',
      id_conta_anuncio: adAccountId,
    });
    return response.data || [];
  }

  async uploadCreativeImageByUrl(adAccountId: string, url: string): Promise<void> {
    await api.post(ENDPOINT, { acao: 'subir_imagem_criativo', id_conta_anuncio: adAccountId, url });
  }

  async deleteCreativeImage(adAccountId: string, imageHash: string): Promise<void> {
    await api.post(ENDPOINT, { acao: 'excluir_imagem_criativo', id_conta_anuncio: adAccountId, hash: imageHash });
  }

  async deleteCreativeVideo(videoId: string): Promise<void> {
    await api.post(ENDPOINT, { acao: 'excluir_video_criativo', id_video: videoId });
  }

  // --- Listas de direcionamento (salvas localmente, não na Meta) ---

  async listTargetingLists(): Promise<TargetingList[]> {
    const response = await api.post<TargetingList[]>(ENDPOINT, { acao: 'listar_listas_direcionamento' });
    return response.data || [];
  }

  async createTargetingList(name: string, items: ChosenTargetingItem[]): Promise<TargetingList> {
    const response = await api.post<TargetingList>(ENDPOINT, {
      acao: 'criar_lista_direcionamento',
      name,
      items: JSON.stringify(items),
    });
    return response.data;
  }

  async updateTargetingList(id: string, updates: { name?: string; items?: ChosenTargetingItem[] }): Promise<TargetingList> {
    const response = await api.post<TargetingList>(ENDPOINT, {
      acao: 'atualizar_lista_direcionamento',
      id,
      name: updates.name,
      items: updates.items ? JSON.stringify(updates.items) : undefined,
    });
    return response.data;
  }

  async deleteTargetingList(id: string): Promise<void> {
    await api.post(ENDPOINT, { acao: 'excluir_lista_direcionamento', id });
  }

  // --- Grupos de localização (salvos localmente, POR CONTA DE ANÚNCIO —
  // diferente das listas de direcionamento acima, que são globais). Listar
  // sempre filtra pela conta escolhida; duplicar pode mirar a mesma conta
  // (cria uma cópia lado a lado) ou qualquer outra, já que os pins não têm
  // nenhuma dependência da conta de origem. ---

  async listLocationGroups(adAccountId: string): Promise<LocationGroup[]> {
    const response = await api.post<LocationGroup[]>(ENDPOINT, {
      acao: 'listar_grupos_localizacao',
      id_conta_anuncio: adAccountId,
    });
    return response.data || [];
  }

  async createLocationGroup(adAccountId: string, name: string, pins: LocationGroupPin[]): Promise<LocationGroup> {
    const response = await api.post<LocationGroup>(ENDPOINT, {
      acao: 'criar_grupo_localizacao',
      id_conta_anuncio: adAccountId,
      name,
      pins: JSON.stringify(pins),
    });
    return response.data;
  }

  async updateLocationGroup(id: string, updates: { name?: string; pins?: LocationGroupPin[] }): Promise<LocationGroup> {
    const response = await api.post<LocationGroup>(ENDPOINT, {
      acao: 'atualizar_grupo_localizacao',
      id,
      name: updates.name,
      pins: updates.pins ? JSON.stringify(updates.pins) : undefined,
    });
    return response.data;
  }

  async deleteLocationGroup(id: string): Promise<void> {
    await api.post(ENDPOINT, { acao: 'excluir_grupo_localizacao', id });
  }

  async duplicateLocationGroup(id: string, targetAdAccountId: string, name?: string): Promise<LocationGroup> {
    const response = await api.post<LocationGroup>(ENDPOINT, {
      acao: 'duplicar_grupo_localizacao',
      id,
      id_conta_destino: targetAdAccountId,
      name,
    });
    return response.data;
  }
}

export const metaCreationService = new MetaCreationService();
