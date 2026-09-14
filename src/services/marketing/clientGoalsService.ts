import api from '@/services/core/api';

export type ObjectiveType =
  | 'mensagens'
  | 'seguidores'
  | 'video'
  | 'alcance'
  | 'vendas_site'
  | 'lead_site'
  | 'outro';

export const OBJECTIVE_TYPE_OPTIONS: { value: ObjectiveType; label: string }[] = [
  { value: 'mensagens', label: 'Mensagens' },
  { value: 'seguidores', label: 'Seguidores' },
  { value: 'video', label: 'Visualizações de Vídeo' },
  { value: 'alcance', label: 'Alcance' },
  { value: 'vendas_site', label: 'Vendas no Site' },
  { value: 'lead_site', label: 'Lead no Site' },
  { value: 'outro', label: 'Outro' },
];

export const SALES_CHANNEL_OPTIONS = [
  'Site',
  'WhatsApp',
  'Loja Física',
  'Marketplace',
  'Instagram/Direct',
  'Telefone',
  'Outro',
];

export const CHANGELOG_LEVEL_OPTIONS: { value: ChangelogLevel; label: string }[] = [
  { value: 'conta', label: 'Conta' },
  { value: 'campanha', label: 'Campanha' },
  { value: 'conjunto', label: 'Conjunto de Anúncios' },
  { value: 'anuncio', label: 'Anúncio' },
];

export type ChangelogLevel = 'conta' | 'campanha' | 'conjunto' | 'anuncio';

export type Gender = 'all' | 'male' | 'female';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
];

export interface ClientGoalLocation {
  name: string;
  radius: number | null;
}

export interface ClientGoalAdAccount {
  id: string;
  name: string;
  locations: ClientGoalLocation[];
  age_min: number | null;
  age_max: number | null;
  gender: Gender | null;
  objectives: ClientGoalObjective[];
  campaigns: ClientGoalCampaignGoal[];
}

// Meta definida num nível mais fundo que a conta (campanha/conjunto/
// anúncio) — só existe uma entrada aqui quando o usuário decide comparar o
// resultado de uma campanha/conjunto/anúncio específico, não o agregado da
// conta inteira. id/name vêm denormalizados do drill-down ao vivo
// (AccountHistorySummary) no momento em que a meta é criada.
export interface ClientGoalCampaignGoal {
  id: string;
  name: string;
  objectives: ClientGoalObjective[];
  adsets: ClientGoalAdSetGoal[];
}

export interface ClientGoalAdSetGoal {
  id: string;
  name: string;
  objectives: ClientGoalObjective[];
  ads: ClientGoalAdGoal[];
}

export interface ClientGoalAdGoal {
  id: string;
  name: string;
  objectives: ClientGoalObjective[];
}

export interface ClientGoalObjectiveStatus {
  trackable: boolean;
  last_date: string | null;
  last_cost_per_result: number | null;
  last_within_margin: boolean | null;
  days_out_of_margin: number;
  observation: string;
}

export interface ClientGoalObjective {
  key?: string;
  objective_type: ObjectiveType;
  custom_label?: string | null;
  budget: number | null;
  target_result_daily?: number | null;
  target_result_weekly?: number | null;
  target_result_monthly?: number | null;
  cost_margin_daily_min?: number | null;
  cost_margin_daily_max?: number | null;
  cost_margin_weekly_min?: number | null;
  cost_margin_weekly_max?: number | null;
  cost_margin_monthly_min?: number | null;
  cost_margin_monthly_max?: number | null;
  status?: ClientGoalObjectiveStatus;
}

export interface ClientGoalChangelogEntry {
  change_date: string;
  level: ChangelogLevel;
  reference_name?: string;
  description: string;
}

export interface ClientGoal {
  id: string;
  name: string;
  segments: string[];
  sales_channel?: string | null;
  meta_budget: number | null;
  active: boolean;
  ad_accounts: ClientGoalAdAccount[];
  changelog: ClientGoalChangelogEntry[];
  created_at: string;
  updated_at: string;
}

export type ClientGoalFormData = Omit<ClientGoal, 'id' | 'created_at' | 'updated_at'>;

export interface AdMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  actions: Record<string, number>;
}

export interface AdNode {
  id: string;
  name: string;
  effective_status: string;
  metrics: AdMetrics;
}

export interface AdSetNode {
  id: string;
  name: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  active_ads_count: number;
  metrics: AdMetrics;
  ads: AdNode[];
}

export interface CampaignNode {
  id: string;
  name: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  active_adsets_count: number;
  metrics: AdMetrics;
  adsets: AdSetNode[];
}

export interface AccountHistorySummary {
  targeting_summary: {
    age_min: number | null;
    age_max: number | null;
    gender: Gender;
    locations: ClientGoalLocation[];
  };
  active_campaigns: CampaignNode[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  errors?: string[];
}

class ClientGoalsService {
  private readonly baseUrl = '/marketing/client_goals';

  async list(includeInactive = false): Promise<ClientGoal[]> {
    const response = await api.get<ApiEnvelope<ClientGoal[]>>(this.baseUrl, {
      params: includeInactive ? { include_inactive: 1 } : undefined,
    });
    return response.data.data;
  }

  async get(id: string): Promise<ClientGoal> {
    const response = await api.get<ApiEnvelope<ClientGoal>>(`${this.baseUrl}/${id}`);
    return response.data.data;
  }

  async create(payload: ClientGoalFormData): Promise<ClientGoal> {
    const response = await api.post<ApiEnvelope<ClientGoal>>(this.baseUrl, {
      marketing_client_goal: payload,
    });
    return response.data.data;
  }

  async update(id: string, payload: ClientGoalFormData): Promise<ClientGoal> {
    const response = await api.put<ApiEnvelope<ClientGoal>>(`${this.baseUrl}/${id}`, {
      marketing_client_goal: payload,
    });
    return response.data.data;
  }

  async remove(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // Botão "Buscar conta": preenche o nome da conta a partir só do ID que o
  // usuário colou, sem precisar navegar Business Manager > Contas no Painel
  // Tráfego pra descobrir o nome. Reaproveita o mesmo endpoint despachado
  // por `acao` que o Painel Tráfego já usa (Meta::AdsManagerService#account_info).
  async lookupAdAccount(id: string): Promise<{ id: string; name: string }> {
    const response = await api.post<{ name?: string; account_id?: string; id?: string }>(
      '/reports/meta_ads_manager',
      { acao: 'conta_info', id_conta_anuncio: id },
    );
    return { id: response.data.id || response.data.account_id || id, name: response.data.name || '' };
  }

  // Seletor "BM > Conta": mesmas duas ações que o Painel Tráfego já usa pra
  // navegar Business Manager > Contas, só que devolvendo listas simples pro
  // combobox com busca (em vez da árvore completa com insights/gasto que o
  // Painel Tráfego usa).
  async listBusinessManagers(): Promise<{ id: string; name: string }[]> {
    const response = await api.post<[{ lista_bms?: { id: string; name: string }[] }]>(
      '/reports/meta_ads_manager',
      { acao: 'lista_bms' },
    );
    return response.data?.[0]?.lista_bms || [];
  }

  async listAdAccountsForBm(businessId: string): Promise<{ id: string; name: string }[]> {
    const response = await api.post<[{ lista_final_contas_de_anuncios?: { id: string; name: string }[] }]>(
      '/reports/meta_ads_manager',
      { acao: 'lista_de_contas', id_bm: businessId },
    );
    return (response.data?.[0]?.lista_final_contas_de_anuncios || []).map((a) => ({ id: a.id, name: a.name }));
  }

  // Autocomplete do campo "Nome da conta": lista TODAS as contas que o token
  // tem acesso, sem escopar por BM (mesma ação, só sem id_bm — Meta::AdsManagerService#ad_accounts
  // cai pro /me/adaccounts global quando business_id vem em branco).
  async listAllAdAccounts(): Promise<{ id: string; name: string }[]> {
    const response = await api.post<[{ lista_final_contas_de_anuncios?: { id: string; name: string }[] }]>(
      '/reports/meta_ads_manager',
      { acao: 'lista_de_contas' },
    );
    return (response.data?.[0]?.lista_final_contas_de_anuncios || []).map((a) => ({ id: a.id, name: a.name }));
  }

  // Ao escolher uma conta (autocomplete, seletor BM>Conta ou "Buscar conta"):
  // preenche idade/gênero/localizações a partir do histórico de público da
  // conta e traz as campanhas ativas agora, pra contexto
  // (Meta::AdsManagerService#account_history_summary).
  async getAccountHistorySummary(id: string): Promise<AccountHistorySummary> {
    const response = await api.post<AccountHistorySummary>('/reports/meta_ads_manager', {
      acao: 'conta_historico',
      id_conta_anuncio: id,
    });
    return response.data;
  }
}

export const clientGoalsService = new ClientGoalsService();
