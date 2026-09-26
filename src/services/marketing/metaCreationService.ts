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

// Usado só ao duplicar um público pra outra conta — retention_days e
// lookalike_spec (ratio/país) são reaproveitáveis; pixel/público de origem
// não (são da conta de destino, nunca os mesmos ids da conta de origem).
export interface AudienceDetail {
  id: string;
  name: string;
  subtype: string;
  description?: string;
  retention_days?: number;
  lookalike_spec?: { ratio?: number; country?: string };
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
  geo_locations: { countries: string[] };
  age_min: number;
  age_max: number;
  genders?: number[];
  flexible_spec?: Array<Record<TargetingCategory, Array<{ id: string; name: string }>>>;
  exclusions?: Partial<Record<TargetingCategory, Array<{ id: string; name: string }>>>;
}

// Lista curada e reutilizável de itens de direcionamento, salva localmente
// no CRM (a Graph API não tem esse conceito solto) — serve como "banco" de
// onde um público/grupo de direcionamento pode puxar um subconjunto.
export interface TargetingList {
  id: string;
  name: string;
  items: ChosenTargetingItem[];
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

export interface ReachEstimate {
  estimate_mau_lower_bound?: number;
  estimate_mau_upper_bound?: number;
  estimate_dau_lower_bound?: number;
  estimate_dau_upper_bound?: number;
}

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
}

export const metaCreationService = new MetaCreationService();
