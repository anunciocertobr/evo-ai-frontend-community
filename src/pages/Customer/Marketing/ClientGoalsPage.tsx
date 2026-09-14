import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Plus,
  Trash2,
  Edit2,
  Target,
  Building2,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Power,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Card,
  CardContent,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@evoapi/design-system';
import { BaseHeader } from '@/components/base';
import { MetaAdAccountPicker } from '@/components/marketing/MetaAdAccountPicker';
import {
  clientGoalsService,
  ClientGoal,
  ClientGoalFormData,
  ClientGoalObjective,
  ClientGoalAdAccount,
  ClientGoalCampaignGoal,
  ClientGoalAdSetGoal,
  ClientGoalAdGoal,
  ClientGoalChangelogEntry,
  ObjectiveType,
  ChangelogLevel,
  OBJECTIVE_TYPE_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  CHANGELOG_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  Gender,
  AccountHistorySummary,
  AdMetrics,
  CampaignNode,
  AdSetNode,
  AdNode,
} from '@/services/marketing/clientGoalsService';

// Os campos do design system usam fundo transparente por padrão (só a borda
// marca o campo) — nesta tela, com vários campos numéricos pequenos lado a
// lado, isso ficava ilegível tanto no claro quanto no escuro (o campo se
// confundia com o fundo do card/diálogo). Fundo próprio, visível nos dois
// temas.
const FIELD_CLASS = 'bg-slate-100 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700';

const PERIODS = [
  { key: 'daily', label: 'Diário' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensal' },
] as const;

const roEmptyDrillDown = { campaignId: null as string | null, adsetId: null as string | null, adId: null as string | null };

const EMPTY_METRICS: AdMetrics = { spend: 0, impressions: 0, reach: 0, clicks: 0, actions: {} };

// Uma campanha/conjunto/anúncio com meta salva não pode sumir da lista só
// porque a Meta não reportou ela como ativa agora (pausou, por exemplo) —
// senão a meta configurada fica "invisível" e parece que não foi salva.
// Junta a lista ao vivo com qualquer meta salva que não esteja nela,
// mostrando as que só existem na meta salva sem métricas (tudo zerado).
function mergeWithSavedGoals<TLive extends { id: string; name: string }, TGoal extends { id: string; name: string }>(
  live: TLive[],
  goals: TGoal[],
  placeholder: (goal: TGoal) => TLive,
): TLive[] {
  const liveIds = new Set(live.map((l) => l.id));
  const missing = goals.filter((g) => !liveIds.has(g.id)).map(placeholder);
  return [...live, ...missing];
}

const campaignPlaceholder = (g: ClientGoalCampaignGoal): CampaignNode => ({
  id: g.id,
  name: g.name,
  active_adsets_count: 0,
  metrics: EMPTY_METRICS,
  adsets: [],
});

const adsetPlaceholder = (g: ClientGoalAdSetGoal): AdSetNode => ({
  id: g.id,
  name: g.name,
  effective_status: 'DESCONHECIDO',
  active_ads_count: 0,
  metrics: EMPTY_METRICS,
  ads: [],
});

const adPlaceholder = (g: ClientGoalAdGoal): AdNode => ({
  id: g.id,
  name: g.name,
  effective_status: 'DESCONHECIDO',
  metrics: EMPTY_METRICS,
});

const emptyObjective = (): ClientGoalObjective => ({
  key: `novo-${Math.random().toString(36).slice(2)}`,
  objective_type: 'mensagens',
  custom_label: '',
  budget: null,
  target_result_daily: null,
  target_result_weekly: null,
  target_result_monthly: null,
  cost_margin_daily_min: null,
  cost_margin_daily_max: null,
  cost_margin_weekly_min: null,
  cost_margin_weekly_max: null,
  cost_margin_monthly_min: null,
  cost_margin_monthly_max: null,
});

// Cada conta de anúncio tem seus PRÓPRIOS objetivos — contas diferentes do
// mesmo cliente podem ter metas bem diferentes entre si.
const emptyAdAccount = (): ClientGoalAdAccount => ({
  id: '',
  name: '',
  locations: [],
  age_min: null,
  age_max: null,
  gender: 'all',
  objectives: [emptyObjective()],
  campaigns: [],
});

// Registros salvos ANTES de campanha/conjunto/anúncio virarem níveis de
// meta possíveis não têm essas chaves — sem isso, ler um cliente antigo e
// tentar `acc.campaigns.find(...)` quebraria com "Cannot read properties of
// undefined".
const normalizeAdGoal = (a: Partial<ClientGoalAdGoal>): ClientGoalAdGoal => ({
  id: a.id || '',
  name: a.name || '',
  objectives: a.objectives || [],
});

const normalizeAdSetGoal = (a: Partial<ClientGoalAdSetGoal>): ClientGoalAdSetGoal => ({
  id: a.id || '',
  name: a.name || '',
  objectives: a.objectives || [],
  ads: (a.ads || []).map(normalizeAdGoal),
});

const normalizeCampaignGoal = (c: Partial<ClientGoalCampaignGoal>): ClientGoalCampaignGoal => ({
  id: c.id || '',
  name: c.name || '',
  objectives: c.objectives || [],
  adsets: (c.adsets || []).map(normalizeAdSetGoal),
});

const normalizeAdAccount = (a: ClientGoalAdAccount): ClientGoalAdAccount => ({
  ...a,
  campaigns: (a.campaigns || []).map(normalizeCampaignGoal),
});

const emptyForm = (): ClientGoalFormData => ({
  name: '',
  segments: [],
  sales_channel: '',
  meta_budget: null,
  active: true,
  ad_accounts: [emptyAdAccount()],
  changelog: [],
});

const formFromGoal = (goal: ClientGoal): ClientGoalFormData => ({
  name: goal.name,
  segments: goal.segments || [],
  sales_channel: goal.sales_channel || '',
  meta_budget: goal.meta_budget,
  active: goal.active,
  ad_accounts: (goal.ad_accounts.length ? goal.ad_accounts : [emptyAdAccount()]).map(normalizeAdAccount),
  changelog: goal.changelog,
});

// Uma conta "vazia" (linha adicionada via "Adicionar Conta" mas nunca
// preenchida) não deve virar uma conta salva — mas ID da conta é OPCIONAL:
// nem todo cliente tem uma conta de anúncio Meta real ainda (só perde o
// acompanhamento automático, ver `Sem acompanhamento automático`). Antes
// disso, o filtro exigia `id` preenchido e descartava a conta inteira (com
// todos os objetivos preenchidos) sem avisar nada, silenciosamente, sempre
// que o cliente não tinha ID de conta Meta.
// Objetivo "outro" sem rótulo derruba a validação do backend (custom_label
// obrigatório pra esse tipo) — aplicado recursivamente nos 4 níveis antes
// de salvar, porque o objetivo implícito de campanha/conjunto/anúncio
// (criado por withSingleObjective) pode herdar objective_type 'outro' do
// nível pai mesmo sem o usuário nunca ter visto um seletor de tipo.
const fixOutroLabel = (o: ClientGoalObjective): ClientGoalObjective =>
  o.objective_type === 'outro' && !o.custom_label?.trim() ? { ...o, custom_label: 'Outro' } : o;

const objectiveHasContent = (o: ClientGoalObjective) =>
  o.budget != null ||
  o.target_result_daily != null ||
  o.target_result_weekly != null ||
  o.target_result_monthly != null ||
  o.cost_margin_daily_min != null ||
  o.cost_margin_daily_max != null ||
  o.cost_margin_weekly_min != null ||
  o.cost_margin_weekly_max != null ||
  o.cost_margin_monthly_min != null ||
  o.cost_margin_monthly_max != null ||
  !!o.custom_label?.trim();

const campaignGoalHasContent = (c: ClientGoalCampaignGoal): boolean =>
  c.objectives.some(objectiveHasContent) || c.adsets.some(adsetGoalHasContent);

const adsetGoalHasContent = (a: ClientGoalAdSetGoal): boolean =>
  a.objectives.some(objectiveHasContent) || a.ads.some((ad) => ad.objectives.some(objectiveHasContent));

const accountHasContent = (a: ClientGoalAdAccount) =>
  !!a.id.trim() ||
  !!a.name.trim() ||
  a.locations.length > 0 ||
  a.age_min != null ||
  a.age_max != null ||
  (a.gender != null && a.gender !== 'all') ||
  a.objectives.some(objectiveHasContent) ||
  a.campaigns.some(campaignGoalHasContent);

const objectiveLabel = (o: ClientGoalObjective) =>
  o.objective_type === 'outro'
    ? o.custom_label || 'Outro'
    : OBJECTIVE_TYPE_OPTIONS.find((opt) => opt.value === o.objective_type)?.label || o.objective_type;

const money = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR'));

const genderLabel = (g: Gender | null | undefined) => GENDER_OPTIONS.find((opt) => opt.value === g)?.label || 'Todos';

const ageRangeLabel = (min: number | null | undefined, max: number | null | undefined) => {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}-${max} anos`;
  return min != null ? `A partir de ${min} anos` : `Até ${max} anos`;
};

// Espelha Marketing::GoalTrackingService::OBJECTIVE_ACTION_TYPES (backend)
// — o action_type dos Insights da Graph API que representa o "resultado"
// de cada tipo de objetivo. Mantenha os dois em sincronia se um mudar.
// 'alcance' não tem action_type: usa reach/1000 (tratado à parte em
// computeResults), e 'seguidores'/'outro' não têm como medir sozinhos.
const OBJECTIVE_ACTION_TYPES: Record<ObjectiveType, string[]> = {
  mensagens: ['onsite_conversion.total_messaging_connection', 'onsite_conversion.messaging_conversation_started_7d'],
  video: ['video_view'],
  vendas_site: ['offsite_conversion.fb_pixel_purchase', 'purchase', 'omni_purchase'],
  lead_site: ['offsite_conversion.fb_pixel_lead', 'lead', 'onsite_conversion.lead_grouped'],
  alcance: [],
  seguidores: [],
  outro: [],
};

// "Resultados" de uma campanha/conjunto/anúncio pros objetivos configurados
// NESSA conta (pode ter mais de um) — soma as actions que batem com
// qualquer um deles; se só "alcance" estiver configurado, usa reach/1000.
const computeResults = (objectiveTypes: ObjectiveType[], metrics: AdMetrics): number | null => {
  const actionTypes = Array.from(new Set(objectiveTypes.flatMap((t) => OBJECTIVE_ACTION_TYPES[t] || [])));
  if (actionTypes.length > 0) {
    return actionTypes.reduce((sum, type) => sum + (metrics.actions[type] || 0), 0);
  }
  if (objectiveTypes.includes('alcance')) return metrics.reach / 1000;
  return null;
};

const formatResults = (v: number) => (Number.isInteger(v) ? v.toLocaleString('pt-BR') : v.toFixed(1));

// O backend devolve { success: false, errors: ["motivo real"] } — sem isso,
// qualquer rejeição de validação (ex: nome com mais de 255 caracteres, fácil
// de acontecer colando de uma planilha) virava só "Erro ao salvar", sem
// dizer o que estava errado de verdade.
const extractErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const errors = (error.response?.data as { errors?: string[] } | undefined)?.errors;
    if (errors?.length) return errors.join(' ');
  }
  return fallback;
};

function ObservationBadge({ objective }: { objective: ClientGoalObjective }) {
  const status = objective.status;
  if (!status || !status.trackable) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <MinusCircle className="h-3 w-3" /> Sem acompanhamento automático
      </Badge>
    );
  }
  if (status.days_out_of_margin > 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> {status.observation}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800">
      <CheckCircle2 className="h-3 w-3" /> {status.observation}
    </Badge>
  );
}

// Mini-tabela Diário/Semanal/Mensal x Meta de Resultado/Margem Mín/Margem
// Máx de um objetivo — usada na leitura (linha expandida da tabela).
function ObjectivePeriodsTable({ objective }: { objective: ClientGoalObjective }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 pr-3 font-medium">Período</th>
            <th className="py-1 pr-3 font-medium">Meta de Resultado</th>
            <th className="py-1 pr-3 font-medium">Margem Mín (R$)</th>
            <th className="py-1 pr-3 font-medium">Margem Máx (R$)</th>
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period.key} className="border-t">
              <td className="py-1.5 pr-3 font-medium">{period.label}</td>
              <td className="py-1.5 pr-3">{num(objective[`target_result_${period.key}` as keyof ClientGoalObjective] as number)}</td>
              <td className="py-1.5 pr-3">{money(objective[`cost_margin_${period.key}_min` as keyof ClientGoalObjective] as number)}</td>
              <td className="py-1.5 pr-3">{money(objective[`cost_margin_${period.key}_max` as keyof ClientGoalObjective] as number)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Colunas Resultado Mín/Máx + Custo/Resultado Mín/Máx por período, direto —
// pra metas de campanha/conjunto/anúncio: sem Tipo de Objetivo, sem
// Orçamento, sem card, sem botão "Adicionar" (o objetivo é criado sozinho
// no primeiro campo preenchido, via withSingleObjective em
// ClientGoalFormFields). Repetido em edição (InlineGoalEditor, com inputs)
// e leitura (GoalPeriodsReadOnlyTable, só texto).
const GOAL_COLUMNS = ['Período', 'Resultado Mín', 'Resultado Máx', 'Custo/Result. Mín (R$)', 'Custo/Result. Máx (R$)'];

function GoalPeriodsReadOnlyTable({ objective }: { objective: ClientGoalObjective }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            {GOAL_COLUMNS.map((col) => (
              <th key={col} className="py-1 pr-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period.key} className="border-t">
              <td className="py-1.5 pr-3 font-medium">{period.label}</td>
              <td className="py-1.5 pr-3">{num(objective[`target_result_${period.key}_min` as keyof ClientGoalObjective] as number)}</td>
              <td className="py-1.5 pr-3">{num(objective[`target_result_${period.key}_max` as keyof ClientGoalObjective] as number)}</td>
              <td className="py-1.5 pr-3">{money(objective[`cost_margin_${period.key}_min` as keyof ClientGoalObjective] as number)}</td>
              <td className="py-1.5 pr-3">{money(objective[`cost_margin_${period.key}_max` as keyof ClientGoalObjective] as number)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineGoalEditor({
  objective,
  onChange,
}: {
  objective: ClientGoalObjective | undefined;
  onChange: (patch: Partial<ClientGoalObjective>) => void;
}) {
  const numField = (key: string) => {
    const typedKey = key as keyof ClientGoalObjective;
    return (
      <Input
        className={`${FIELD_CLASS} w-24`}
        type="number"
        step="0.01"
        value={(objective?.[typedKey] as number) ?? ''}
        onChange={(e) => onChange({ [typedKey]: e.target.value === '' ? null : Number(e.target.value) })}
      />
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            {GOAL_COLUMNS.map((col) => (
              <th key={col} className="py-1 pr-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period.key} className="border-t">
              <td className="py-1.5 pr-2 font-medium">{period.label}</td>
              <td className="py-1.5 pr-2">{numField(`target_result_${period.key}_min`)}</td>
              <td className="py-1.5 pr-2">{numField(`target_result_${period.key}_max`)}</td>
              <td className="py-1.5 pr-2">{numField(`cost_margin_${period.key}_min`)}</td>
              <td className="py-1.5 pr-2">{numField(`cost_margin_${period.key}_max`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Editor de metas (objectives) usado só no nível conta — tipo, orçamento,
// meta de resultado e margem por período, num card por objetivo (pode ter
// vários). Campanha/conjunto/anúncio usam InlineGoalEditor (mais simples,
// só as colunas de período) em vez deste — ver histórico do arquivo:
// aplicar este mesmo editor nesses 3 níveis ficou "bagunçado" (botão
// "Adicionar Meta" separado da tabela, um objetivo por vez) pro caso de uso
// real, que é comparar um único alvo por período contra o resultado real.
function ObjectivesEditor({
  title,
  objectives,
  isEditing,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  objectives: ClientGoalObjective[];
  isEditing: boolean;
  onAdd: () => void;
  onUpdate: (objIndex: number, patch: Partial<ClientGoalObjective>) => void;
  onRemove: (objIndex: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground">{title}</Label>
        <Button size="sm" variant="outline" onClick={onAdd} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Adicionar Meta
        </Button>
      </div>

      {objectives.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma meta definida aqui ainda.</p>
      ) : (
        <div className="space-y-4">
          {objectives.map((obj, objIndex) => (
            <Card key={obj.key || objIndex} className={FIELD_CLASS}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-[160px] flex-1">
                    <Label>Tipo de Objetivo</Label>
                    <Select
                      value={obj.objective_type}
                      onValueChange={(v) => onUpdate(objIndex, { objective_type: v as ObjectiveType })}
                    >
                      <SelectTrigger className={FIELD_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OBJECTIVE_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {obj.objective_type === 'outro' && (
                    <div className="min-w-[160px] flex-1">
                      <Label>Rótulo do Objetivo</Label>
                      <Input
                        className={FIELD_CLASS}
                        value={obj.custom_label || ''}
                        onChange={(e) => onUpdate(objIndex, { custom_label: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="w-full sm:w-40">
                    <Label>Orçamento (R$)</Label>
                    <Input
                      className={FIELD_CLASS}
                      type="number"
                      step="0.01"
                      value={obj.budget ?? ''}
                      onChange={(e) => onUpdate(objIndex, { budget: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </div>
                  <Button size="icon" variant="ghost" className="mt-6" onClick={() => onRemove(objIndex)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                {obj.objective_type === 'seguidores' || obj.objective_type === 'outro' ? (
                  <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
                    A API do Meta não expõe esse resultado diretamente nos Insights — este objetivo fica registrado, mas o
                    acompanhamento automático de "dias fora da meta" não é calculado para ele.
                  </p>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {PERIODS.map((period) => (
                    <div key={period.key} className="space-y-1 rounded-md border p-2">
                      <p className="text-xs font-semibold text-muted-foreground">{period.label}</p>
                      <Label className="text-xs">Meta de Resultado</Label>
                      <Input
                        className={FIELD_CLASS}
                        type="number"
                        step="0.01"
                        value={(obj[`target_result_${period.key}` as keyof ClientGoalObjective] as number) ?? ''}
                        onChange={(e) =>
                          onUpdate(objIndex, {
                            [`target_result_${period.key}`]: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                      <Label className="text-xs">Custo por Resultado — Margem Aceita (R$)</Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          className={`${FIELD_CLASS} min-w-0 flex-1`}
                          type="number"
                          step="0.01"
                          placeholder="Mín"
                          value={(obj[`cost_margin_${period.key}_min` as keyof ClientGoalObjective] as number) ?? ''}
                          onChange={(e) =>
                            onUpdate(objIndex, {
                              [`cost_margin_${period.key}_min`]: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                        <span className="shrink-0 text-xs text-muted-foreground">até</span>
                        <Input
                          className={`${FIELD_CLASS} min-w-0 flex-1`}
                          type="number"
                          step="0.01"
                          placeholder="Máx"
                          value={(obj[`cost_margin_${period.key}_max` as keyof ClientGoalObjective] as number) ?? ''}
                          onChange={(e) =>
                            onUpdate(objIndex, {
                              [`cost_margin_${period.key}_max`]: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {isEditing && obj.status && (
                  <div className="pt-1">
                    <ObservationBadge objective={obj} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface ClientGoalFormFieldsProps {
  form: ClientGoalFormData;
  setForm: React.Dispatch<React.SetStateAction<ClientGoalFormData>>;
  isEditing: boolean;
  newChangeEntry: ClientGoalChangelogEntry;
  setNewChangeEntry: React.Dispatch<React.SetStateAction<ClientGoalChangelogEntry>>;
}

// Os campos do formulário de cliente (nome/segmento/contas+objetivos/
// changelog) — reaproveitado tanto no diálogo de "Novo Cliente" quanto
// direto na linha expandida da tabela ao editar um cliente já existente
// (sem abrir uma "tela de edição" separada).
function ClientGoalFormFields({ form, setForm, isEditing, newChangeEntry, setNewChangeEntry }: ClientGoalFormFieldsProps) {
  const updateAdAccount = (index: number, field: 'id' | 'name', value: string) => {
    setForm((prev) => {
      const list = [...prev.ad_accounts];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, ad_accounts: list };
    });
  };

  const patchAdAccount = (index: number, patch: Partial<ClientGoalAdAccount>) => {
    setForm((prev) => {
      const list = [...prev.ad_accounts];
      list[index] = { ...list[index], ...patch };
      return { ...prev, ad_accounts: list };
    });
  };

  const addAdAccount = () => setForm((prev) => ({ ...prev, ad_accounts: [...prev.ad_accounts, emptyAdAccount()] }));

  const removeAdAccount = (index: number) =>
    setForm((prev) => ({ ...prev, ad_accounts: prev.ad_accounts.filter((_, i) => i !== index) }));

  // Botão "Buscar conta": em vez do usuário ter que ir no Painel Tráfego
  // achar o nome da conta pra colar aqui, cola só o ID e a gente busca o
  // nome direto na Graph API (Meta::AdsManagerService#account_info).
  const [lookupLoading, setLookupLoading] = useState<Record<number, boolean>>({});

  // Botão dedicado "Preencher com histórico da conta": só roda quando
  // clicado (não mais sozinho ao escolher a conta) — preenche idade/
  // gênero/localizações a partir do histórico de público da conta e traz a
  // árvore campanha > conjunto > anúncio das campanhas ativas agora, com
  // métricas. As campanhas não são salvas no formulário (é só contexto pra
  // consulta) — somem se a aba for fechada ou a conta trocada de novo.
  const [historyLoading, setHistoryLoading] = useState<Record<number, boolean>>({});
  const [activeCampaigns, setActiveCampaigns] = useState<Record<number, AccountHistorySummary['active_campaigns']>>(
    {},
  );

  // Tabela de "Contas de Anúncio": linha expande pra mostrar o formulário
  // completo da conta (idade/gênero/localizações/objetivos) — objetivos têm
  // campos demais pra caber em colunas. Dentro do expandido, o drill-down
  // campanha > conjunto > anúncio abre no máximo um de cada nível por vez.
  const [expandedAccounts, setExpandedAccounts] = useState<Record<number, boolean>>({});
  const emptyDrillDown = { campaignId: null as string | null, adsetId: null as string | null, adId: null as string | null };
  const [drillDown, setDrillDown] = useState<Record<number, typeof emptyDrillDown>>({});

  const toggleAccountExpanded = (index: number) =>
    setExpandedAccounts((prev) => ({ ...prev, [index]: !prev[index] }));

  const toggleCampaign = (accIndex: number, campaignId: string) =>
    setDrillDown((prev) => {
      const current = prev[accIndex] || emptyDrillDown;
      const isOpen = current.campaignId === campaignId;
      return { ...prev, [accIndex]: isOpen ? emptyDrillDown : { ...emptyDrillDown, campaignId } };
    });

  const toggleAdset = (accIndex: number, adsetId: string) =>
    setDrillDown((prev) => {
      const current = prev[accIndex] || emptyDrillDown;
      const isOpen = current.adsetId === adsetId;
      return { ...prev, [accIndex]: { ...current, adsetId: isOpen ? null : adsetId, adId: null } };
    });

  const toggleAd = (accIndex: number, adId: string) =>
    setDrillDown((prev) => {
      const current = prev[accIndex] || emptyDrillDown;
      const isOpen = current.adId === adId;
      return { ...prev, [accIndex]: { ...current, adId: isOpen ? null : adId } };
    });

  const applyAccountHistory = async (index: number) => {
    const id = form.ad_accounts[index]?.id?.trim();
    if (!id) {
      toast.error('Selecione ou cole o ID da conta antes de preencher com o histórico.');
      return;
    }
    setHistoryLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const summary = await clientGoalsService.getAccountHistorySummary(id);
      const t = summary.targeting_summary;
      patchAdAccount(index, {
        age_min: t.age_min,
        age_max: t.age_max,
        gender: t.gender || 'all',
        locations: t.locations,
      });
      setActiveCampaigns((prev) => ({ ...prev, [index]: summary.active_campaigns || [] }));
      toast.success('Idade, gênero e localizações preenchidos com o histórico da conta.');
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Não foi possível carregar o histórico dessa conta.'));
    } finally {
      setHistoryLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  const selectAccount = (index: number, account: { id: string; name: string }) => {
    patchAdAccount(index, { id: account.id, name: account.name });
  };

  const lookupAccount = async (index: number) => {
    const id = form.ad_accounts[index]?.id?.trim();
    if (!id) {
      toast.error('Cole o ID da conta antes de buscar.');
      return;
    }
    setLookupLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const info = await clientGoalsService.lookupAdAccount(id);
      selectAccount(index, { id: info.id, name: info.name || form.ad_accounts[index].name });
      toast.success(info.name ? `Conta encontrada: ${info.name}` : 'Conta encontrada.');
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Não foi possível buscar essa conta. Confira o ID.'));
    } finally {
      setLookupLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  // Autocomplete do "Nome da conta": busca a lista completa de contas UMA
  // vez (na primeira vez que o campo ganha foco) e reaproveita pra todas as
  // linhas — filtra localmente a cada tecla, sem chamar a API de novo.
  const [allAccounts, setAllAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [loadingAllAccounts, setLoadingAllAccounts] = useState(false);
  const [openNameDropdown, setOpenNameDropdown] = useState<number | null>(null);

  const ensureAllAccountsLoaded = () => {
    if (allAccounts !== null || loadingAllAccounts) return;
    setLoadingAllAccounts(true);
    clientGoalsService
      .listAllAdAccounts()
      .then(setAllAccounts)
      .catch(() => {
        toast.error('Não foi possível carregar a lista de contas de anúncio.');
        setAllAccounts([]);
      })
      .finally(() => setLoadingAllAccounts(false));
  };

  // Um par nome/raio "pendente" por conta (preenche os dois campos e clica
  // Adicionar) — precisa ser por índice porque cada conta tem sua própria
  // lista de localizações.
  const [locationInputs, setLocationInputs] = useState<Record<number, { name: string; radius: string }>>({});

  const getLocationInput = (accountIndex: number) => locationInputs[accountIndex] || { name: '', radius: '' };

  const setLocationInput = (accountIndex: number, patch: Partial<{ name: string; radius: string }>) =>
    setLocationInputs((prev) => ({ ...prev, [accountIndex]: { ...getLocationInput(accountIndex), ...patch } }));

  const addLocation = (accountIndex: number) => {
    const { name, radius } = getLocationInput(accountIndex);
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const current = form.ad_accounts[accountIndex].locations;
    if (!current.some((l) => l.name === trimmedName)) {
      patchAdAccount(accountIndex, {
        locations: [...current, { name: trimmedName, radius: radius.trim() === '' ? null : Number(radius) }],
      });
    }
    setLocationInputs((prev) => ({ ...prev, [accountIndex]: { name: '', radius: '' } }));
  };

  const removeLocation = (accountIndex: number, name: string) =>
    patchAdAccount(accountIndex, { locations: form.ad_accounts[accountIndex].locations.filter((l) => l.name !== name) });

  const updateObjective = (accountIndex: number, objIndex: number, patch: Partial<ClientGoalObjective>) => {
    setForm((prev) => {
      const accounts = [...prev.ad_accounts];
      const objectives = [...accounts[accountIndex].objectives];
      objectives[objIndex] = { ...objectives[objIndex], ...patch };
      accounts[accountIndex] = { ...accounts[accountIndex], objectives };
      return { ...prev, ad_accounts: accounts };
    });
  };

  const addObjective = (accountIndex: number) =>
    setForm((prev) => {
      const accounts = [...prev.ad_accounts];
      accounts[accountIndex] = { ...accounts[accountIndex], objectives: [...accounts[accountIndex].objectives, emptyObjective()] };
      return { ...prev, ad_accounts: accounts };
    });

  const removeObjective = (accountIndex: number, objIndex: number) =>
    setForm((prev) => {
      const accounts = [...prev.ad_accounts];
      accounts[accountIndex] = {
        ...accounts[accountIndex],
        objectives: accounts[accountIndex].objectives.filter((_, i) => i !== objIndex),
      };
      return { ...prev, ad_accounts: accounts };
    });

  // Metas por campanha/conjunto/anúncio (além da meta da conta): cada nível
  // só ganha uma entrada em `campaigns`/`adsets`/`ads` quando o usuário
  // decide definir uma meta ali — a entrada é criada na hora (com
  // objectives: []) se ainda não existir, a partir do id/nome que já vem do
  // drill-down ao vivo.
  const patchAccountCampaigns = (
    accountIndex: number,
    updater: (campaigns: ClientGoalCampaignGoal[]) => ClientGoalCampaignGoal[],
  ) =>
    setForm((prev) => {
      const accounts = [...prev.ad_accounts];
      accounts[accountIndex] = { ...accounts[accountIndex], campaigns: updater(accounts[accountIndex].campaigns) };
      return { ...prev, ad_accounts: accounts };
    });

  // Campanha/conjunto/anúncio têm no máximo UM objetivo implícito (sem
  // seletor de Tipo de Objetivo) — criado sozinho no primeiro campo
  // preenchido, herdando o objective_type da conta (só usado internamente
  // pra computeResults saber qual action_type comparar; nunca aparece na UI
  // desses 3 níveis).
  const withSingleObjective = <T extends { objectives: ClientGoalObjective[] }>(
    node: T,
    patch: Partial<ClientGoalObjective>,
    defaultObjectiveType: ObjectiveType,
  ): T => {
    const existing = node.objectives[0];
    const updated = existing ? { ...existing, ...patch } : { ...emptyObjective(), objective_type: defaultObjectiveType, ...patch };
    return { ...node, objectives: [updated] };
  };

  const findOrCreateCampaign = (campaigns: ClientGoalCampaignGoal[], id: string, name: string) =>
    campaigns.some((c) => c.id === id) ? campaigns : [...campaigns, { id, name, objectives: [], adsets: [] }];

  const patchCampaign = (
    accountIndex: number,
    campaignId: string,
    campaignName: string,
    patch: (camp: ClientGoalCampaignGoal) => ClientGoalCampaignGoal,
  ) =>
    patchAccountCampaigns(accountIndex, (campaigns) =>
      findOrCreateCampaign(campaigns, campaignId, campaignName).map((c) => (c.id === campaignId ? patch(c) : c)),
    );

  const findOrCreateAdset = (adsets: ClientGoalAdSetGoal[], id: string, name: string) =>
    adsets.some((a) => a.id === id) ? adsets : [...adsets, { id, name, objectives: [], ads: [] }];

  const patchAdset = (
    accountIndex: number,
    campaignId: string,
    campaignName: string,
    adsetId: string,
    adsetName: string,
    patch: (adset: ClientGoalAdSetGoal) => ClientGoalAdSetGoal,
  ) =>
    patchCampaign(accountIndex, campaignId, campaignName, (camp) => ({
      ...camp,
      adsets: findOrCreateAdset(camp.adsets, adsetId, adsetName).map((a) => (a.id === adsetId ? patch(a) : a)),
    }));

  const findOrCreateAd = (ads: ClientGoalAdGoal[], id: string, name: string) =>
    ads.some((a) => a.id === id) ? ads : [...ads, { id, name, objectives: [] }];

  const patchAd = (
    accountIndex: number,
    campaignId: string,
    campaignName: string,
    adsetId: string,
    adsetName: string,
    adId: string,
    adName: string,
    patch: (ad: ClientGoalAdGoal) => ClientGoalAdGoal,
  ) =>
    patchAdset(accountIndex, campaignId, campaignName, adsetId, adsetName, (adset) => ({
      ...adset,
      ads: findOrCreateAd(adset.ads, adId, adName).map((a) => (a.id === adId ? patch(a) : a)),
    }));

  const addChangelogEntry = () => {
    if (!newChangeEntry.description.trim()) {
      toast.error('Descreva a mudança antes de adicionar.');
      return;
    }
    setForm((prev) => ({ ...prev, changelog: [newChangeEntry, ...prev.changelog] }));
    setNewChangeEntry({ change_date: new Date().toISOString().slice(0, 10), level: 'conta', reference_name: '', description: '' });
  };

  const removeChangelogEntry = (index: number) =>
    setForm((prev) => ({ ...prev, changelog: prev.changelog.filter((_, i) => i !== index) }));

  const [segmentInput, setSegmentInput] = useState('');

  const addSegment = () => {
    const value = segmentInput.trim();
    if (!value) return;
    setForm((prev) => (prev.segments.includes(value) ? prev : { ...prev, segments: [...prev.segments, value] }));
    setSegmentInput('');
  };

  const removeSegment = (value: string) => setForm((prev) => ({ ...prev, segments: prev.segments.filter((s) => s !== value) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Nome do Cliente *</Label>
          <Input
            className={FIELD_CLASS}
            value={form.name}
            maxLength={255}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Burger House"
          />
        </div>
        <div>
          <Label>Segmentos</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              className={`${FIELD_CLASS} min-w-[140px] flex-1`}
              value={segmentInput}
              onChange={(e) => setSegmentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSegment();
                }
              }}
              placeholder="Ex: Hamburgueria (Enter pra adicionar)"
            />
            <Button type="button" size="icon" variant="outline" onClick={addSegment}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {form.segments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {form.segments.map((s) => (
                <Badge key={s} variant="outline" className="gap-1">
                  {s}
                  <button type="button" onClick={() => removeSegment(s)} className="ml-1 text-muted-foreground hover:text-red-500">
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label>Onde fecha venda?</Label>
          <Select value={form.sales_channel || ''} onValueChange={(v) => setForm((p) => ({ ...p, sales_channel: v }))}>
            <SelectTrigger className={FIELD_CLASS}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {SALES_CHANNEL_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Orçamento Total pra Meta (R$)</Label>
          <Input
            className={FIELD_CLASS}
            type="number"
            step="0.01"
            value={form.meta_budget ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, meta_budget: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </div>
      </div>

      <Separator />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm font-semibold">Contas de Anúncio e Objetivos</Label>
          <Button size="sm" variant="outline" onClick={addAdAccount} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar Conta
          </Button>
        </div>
        {form.ad_accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta adicionada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Conta</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Gênero</TableHead>
                <TableHead>Localizações</TableHead>
                <TableHead>Objetivos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.ad_accounts.map((acc, accIndex) => {
                const expanded = !!expandedAccounts[accIndex];
                const objectiveTypes = Array.from(new Set(acc.objectives.map((o) => o.objective_type)));
                const campaigns = activeCampaigns[accIndex]
                  ? mergeWithSavedGoals(activeCampaigns[accIndex] as CampaignNode[], acc.campaigns, campaignPlaceholder)
                  : activeCampaigns[accIndex];
                const drill = drillDown[accIndex];

                return (
                  <Fragment key={accIndex}>
                    <TableRow className="cursor-pointer" onClick={() => toggleAccountExpanded(accIndex)}>
                      <TableCell className="text-muted-foreground">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium">
                        {acc.name || acc.id ? (
                          <>
                            {acc.name || <span className="text-muted-foreground">(sem nome)</span>}
                            {acc.id && <div className="text-xs font-normal text-muted-foreground">{acc.id}</div>}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Conta não selecionada</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{ageRangeLabel(acc.age_min, acc.age_max) || '—'}</TableCell>
                      <TableCell className="text-sm">{genderLabel(acc.gender)}</TableCell>
                      <TableCell>
                        {acc.locations.length ? (
                          <div className="flex flex-wrap gap-1">
                            {acc.locations.slice(0, 2).map((loc) => (
                              <Badge key={loc.name} variant="outline">
                                {loc.name}
                              </Badge>
                            ))}
                            {acc.locations.length > 2 && <Badge variant="outline">+{acc.locations.length - 2}</Badge>}
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{acc.objectives.length}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Preencher idade/gênero/localizações com o histórico da conta e ver campanhas ativas"
                            disabled={!acc.id.trim() || historyLoading[accIndex]}
                            onClick={() => applyAccountHistory(accIndex)}
                          >
                            {historyLoading[accIndex] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <History className="h-4 w-4" />
                            )}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => removeAdAccount(accIndex)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <MetaAdAccountPicker onSelect={(account) => selectAccount(accIndex, account)} />
                              <Input
                                className={`${FIELD_CLASS} min-w-[140px] flex-1`}
                                placeholder="ID da conta (act_...)"
                                value={acc.id}
                                onChange={(e) => updateAdAccount(accIndex, 'id', e.target.value)}
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                title="Buscar essa conta na Meta pelo ID e preencher o nome"
                                disabled={lookupLoading[accIndex]}
                                onClick={() => lookupAccount(accIndex)}
                              >
                                {lookupLoading[accIndex] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Search className="h-4 w-4" />
                                )}
                              </Button>
                              <div className="relative min-w-[140px] flex-1">
                                <Input
                                  className={FIELD_CLASS}
                                  placeholder="Nome da conta"
                                  value={acc.name}
                                  autoComplete="off"
                                  onFocus={() => {
                                    ensureAllAccountsLoaded();
                                    setOpenNameDropdown(accIndex);
                                  }}
                                  onChange={(e) => {
                                    updateAdAccount(accIndex, 'name', e.target.value);
                                    setOpenNameDropdown(accIndex);
                                  }}
                                  onBlur={() =>
                                    setTimeout(() => setOpenNameDropdown((cur) => (cur === accIndex ? null : cur)), 150)
                                  }
                                />
                                {openNameDropdown === accIndex && (
                                  <div className="bg-popover text-popover-foreground absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border shadow-md">
                                    {loadingAllAccounts ? (
                                      <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando contas...
                                      </div>
                                    ) : (
                                      (() => {
                                        const query = acc.name.trim().toLowerCase();
                                        const matches = (allAccounts || []).filter(
                                          (a) => !query || a.name.toLowerCase().includes(query),
                                        );
                                        if (matches.length === 0) {
                                          return (
                                            <div className="p-2 text-xs text-muted-foreground">Nenhuma conta encontrada.</div>
                                          );
                                        }
                                        return matches.slice(0, 30).map((a) => (
                                          <button
                                            key={a.id}
                                            type="button"
                                            className="hover:bg-accent hover:text-accent-foreground block w-full truncate px-2 py-1.5 text-left text-sm"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                              selectAccount(accIndex, a);
                                              setOpenNameDropdown(null);
                                            }}
                                          >
                                            {a.name} <span className="text-muted-foreground">({a.id})</span>
                                          </button>
                                        ));
                                      })()
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {(historyLoading[accIndex] || campaigns) && (
                              <div className="rounded-md border border-dashed p-2 text-xs">
                                {historyLoading[accIndex] ? (
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Buscando histórico de público e campanhas
                                    ativas...
                                  </span>
                                ) : campaigns && campaigns.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <div className="min-w-[560px]">
                                      <div className="mb-1 font-medium text-foreground">
                                        Campanhas ativas agora ({campaigns.length}) — últimos 30 dias:
                                      </div>
                                      <div className="grid grid-cols-[1fr_90px_110px_110px] gap-x-2 border-b pb-1 text-muted-foreground">
                                        <span>Campanha</span>
                                        <span>Resultados</span>
                                        <span>Custo/Result.</span>
                                        <span>Conjuntos ativos</span>
                                      </div>
                                      {campaigns.map((camp) => {
                                        const campGoal = acc.campaigns.find((c) => c.id === camp.id);
                                        const campObjectiveTypes = campGoal?.objectives.length
                                          ? Array.from(new Set(campGoal.objectives.map((o) => o.objective_type)))
                                          : objectiveTypes;
                                        const results = computeResults(campObjectiveTypes, camp.metrics);
                                        const cpr = results != null && results > 0 ? camp.metrics.spend / results : null;
                                        const campOpen = drill?.campaignId === camp.id;
                                        const displayAdsets = mergeWithSavedGoals(camp.adsets, campGoal?.adsets || [], adsetPlaceholder);
                                        return (
                                          <Fragment key={camp.id}>
                                            <div
                                              className="grid cursor-pointer grid-cols-[1fr_90px_110px_110px] items-center gap-x-2 border-b py-1.5 hover:bg-accent/50"
                                              onClick={() => toggleCampaign(accIndex, camp.id)}
                                            >
                                              <span className="flex items-center gap-1 truncate">
                                                {campOpen ? (
                                                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                                ) : (
                                                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                                )}
                                                {camp.name}
                                                {!!campGoal?.objectives.length && (
                                                  <Badge variant="outline" className="ml-1 text-[10px]">
                                                    meta própria
                                                  </Badge>
                                                )}
                                              </span>
                                              <span>{results != null ? formatResults(results) : '—'}</span>
                                              <span>{cpr != null ? money(cpr) : '—'}</span>
                                              <span>{camp.active_adsets_count}</span>
                                            </div>
                                            {campOpen && (
                                              <div className="mb-2 ml-4 border-l pl-2">
                                                <div className="my-2">
                                                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Meta desta campanha</p>
                                                  <InlineGoalEditor
                                                    objective={campGoal?.objectives[0]}
                                                    onChange={(patch) =>
                                                      patchCampaign(accIndex, camp.id, camp.name, (c) =>
                                                        withSingleObjective(c, patch, acc.objectives[0]?.objective_type || 'mensagens'),
                                                      )
                                                    }
                                                  />
                                                </div>
                                                {displayAdsets.length === 0 ? (
                                                  <p className="py-1 text-muted-foreground">
                                                    Nenhum conjunto de anúncio nessa campanha.
                                                  </p>
                                                ) : (
                                                  displayAdsets.map((adset) => {
                                                    const adsetGoal = campGoal?.adsets.find((a) => a.id === adset.id);
                                                    const adsetObjectiveTypes = adsetGoal?.objectives.length
                                                      ? Array.from(new Set(adsetGoal.objectives.map((o) => o.objective_type)))
                                                      : campObjectiveTypes;
                                                    const adsetResults = computeResults(adsetObjectiveTypes, adset.metrics);
                                                    const adsetCpr =
                                                      adsetResults != null && adsetResults > 0
                                                        ? adset.metrics.spend / adsetResults
                                                        : null;
                                                    const adsetOpen = drill?.adsetId === adset.id;
                                                    const displayAds = mergeWithSavedGoals(adset.ads, adsetGoal?.ads || [], adPlaceholder);
                                                    return (
                                                      <Fragment key={adset.id}>
                                                        <div
                                                          className="grid cursor-pointer grid-cols-[1fr_90px_110px_110px] items-center gap-x-2 border-b py-1.5 hover:bg-accent/50"
                                                          onClick={() => toggleAdset(accIndex, adset.id)}
                                                        >
                                                          <span className="flex items-center gap-1 truncate">
                                                            {adsetOpen ? (
                                                              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                                            ) : (
                                                              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                                            )}
                                                            {adset.name}
                                                            <Badge variant="outline" className="ml-1 text-[10px]">
                                                              {adset.effective_status}
                                                            </Badge>
                                                            {!!adsetGoal?.objectives.length && (
                                                              <Badge variant="outline" className="text-[10px]">
                                                                meta própria
                                                              </Badge>
                                                            )}
                                                          </span>
                                                          <span>{adsetResults != null ? formatResults(adsetResults) : '—'}</span>
                                                          <span>{adsetCpr != null ? money(adsetCpr) : '—'}</span>
                                                          <span>{adset.active_ads_count}</span>
                                                        </div>
                                                        {adsetOpen && (
                                                          <div className="mb-2 ml-4 border-l pl-2">
                                                            <div className="my-2">
                                                              <p className="mb-1 text-xs font-semibold text-muted-foreground">Meta deste conjunto</p>
                                                              <InlineGoalEditor
                                                                objective={adsetGoal?.objectives[0]}
                                                                onChange={(patch) =>
                                                                  patchAdset(accIndex, camp.id, camp.name, adset.id, adset.name, (a) =>
                                                                    withSingleObjective(a, patch, campObjectiveTypes[0] || 'mensagens'),
                                                                  )
                                                                }
                                                              />
                                                            </div>
                                                            {displayAds.length === 0 ? (
                                                              <p className="py-1 text-muted-foreground">
                                                                Nenhum anúncio nesse conjunto.
                                                              </p>
                                                            ) : (
                                                              displayAds.map((ad) => {
                                                                const adGoal = adsetGoal?.ads.find((a) => a.id === ad.id);
                                                                const adObjectiveTypes = adGoal?.objectives.length
                                                                  ? Array.from(new Set(adGoal.objectives.map((o) => o.objective_type)))
                                                                  : adsetObjectiveTypes;
                                                                const adResults = computeResults(adObjectiveTypes, ad.metrics);
                                                                const adCpr =
                                                                  adResults != null && adResults > 0
                                                                    ? ad.metrics.spend / adResults
                                                                    : null;
                                                                const adOpen = drill?.adId === ad.id;
                                                                return (
                                                                  <Fragment key={ad.id}>
                                                                    <div
                                                                      className="grid cursor-pointer grid-cols-[1fr_90px_110px_110px] items-center gap-x-2 border-b py-1.5 last:border-b-0 hover:bg-accent/50"
                                                                      onClick={() => toggleAd(accIndex, ad.id)}
                                                                    >
                                                                      <span className="flex items-center gap-1 truncate pl-4">
                                                                        {adOpen ? (
                                                                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                                                        ) : (
                                                                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                                                        )}
                                                                        {ad.name}
                                                                        <Badge variant="outline" className="ml-1 text-[10px]">
                                                                          {ad.effective_status}
                                                                        </Badge>
                                                                        {!!adGoal?.objectives.length && (
                                                                          <Badge variant="outline" className="text-[10px]">
                                                                            meta própria
                                                                          </Badge>
                                                                        )}
                                                                      </span>
                                                                      <span>{adResults != null ? formatResults(adResults) : '—'}</span>
                                                                      <span>{adCpr != null ? money(adCpr) : '—'}</span>
                                                                      <span>—</span>
                                                                    </div>
                                                                    {adOpen && (
                                                                      <div className="mb-2 ml-4 border-l py-2 pl-2">
                                                                        <p className="mb-1 text-xs font-semibold text-muted-foreground">Meta deste anúncio</p>
                                                                        <InlineGoalEditor
                                                                          objective={adGoal?.objectives[0]}
                                                                          onChange={(patch) =>
                                                                            patchAd(
                                                                              accIndex,
                                                                              camp.id,
                                                                              camp.name,
                                                                              adset.id,
                                                                              adset.name,
                                                                              ad.id,
                                                                              ad.name,
                                                                              (a) => withSingleObjective(a, patch, adsetObjectiveTypes[0] || 'mensagens'),
                                                                            )
                                                                          }
                                                                        />
                                                                      </div>
                                                                    )}
                                                                  </Fragment>
                                                                );
                                                              })
                                                            )}
                                                          </div>
                                                        )}
                                                      </Fragment>
                                                    );
                                                  })
                                                )}
                                              </div>
                                            )}
                                          </Fragment>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Nenhuma campanha ativa no momento nessa conta.</span>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div>
                                <Label className="text-xs">Idade Mínima</Label>
                                <Input
                                  className={FIELD_CLASS}
                                  type="number"
                                  min={13}
                                  max={65}
                                  value={acc.age_min ?? ''}
                                  onChange={(e) =>
                                    patchAdAccount(accIndex, { age_min: e.target.value === '' ? null : Number(e.target.value) })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Idade Máxima</Label>
                                <Input
                                  className={FIELD_CLASS}
                                  type="number"
                                  min={13}
                                  max={65}
                                  value={acc.age_max ?? ''}
                                  onChange={(e) =>
                                    patchAdAccount(accIndex, { age_max: e.target.value === '' ? null : Number(e.target.value) })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Gênero</Label>
                                <Select
                                  value={acc.gender || 'all'}
                                  onValueChange={(v) => patchAdAccount(accIndex, { gender: v as Gender })}
                                >
                                  <SelectTrigger className={FIELD_CLASS}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {GENDER_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs">Localizações</Label>
                              <div className="flex flex-wrap gap-2">
                                <Input
                                  className={`${FIELD_CLASS} min-w-[140px] flex-1`}
                                  value={getLocationInput(accIndex).name}
                                  onChange={(e) => setLocationInput(accIndex, { name: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addLocation(accIndex);
                                    }
                                  }}
                                  placeholder="Ex: São Paulo, SP"
                                />
                                <Input
                                  className={`${FIELD_CLASS} w-28`}
                                  type="number"
                                  min={1}
                                  value={getLocationInput(accIndex).radius}
                                  onChange={(e) => setLocationInput(accIndex, { radius: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addLocation(accIndex);
                                    }
                                  }}
                                  placeholder="Raio (km)"
                                />
                                <Button type="button" size="icon" variant="outline" onClick={() => addLocation(accIndex)}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              {acc.locations.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {acc.locations.map((loc) => (
                                    <Badge key={loc.name} variant="outline" className="gap-1">
                                      {loc.name}
                                      {loc.radius != null && ` (+${loc.radius}km)`}
                                      <button
                                        type="button"
                                        onClick={() => removeLocation(accIndex, loc.name)}
                                        className="ml-1 text-muted-foreground hover:text-red-500"
                                      >
                                        ×
                                      </button>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            <Separator />

                            <ObjectivesEditor
                              title="Metas desta conta"
                              objectives={acc.objectives}
                              isEditing={isEditing}
                              onAdd={() => addObjective(accIndex)}
                              onUpdate={(objIndex, patch) => updateObjective(accIndex, objIndex, patch)}
                              onRemove={(objIndex) => removeObjective(accIndex, objIndex)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Separator />

      <div>
        <Label className="text-sm font-semibold">Mudanças na Conta / Campanha / Conjunto / Anúncio</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Registre mudanças feitas (ex: aumento de orçamento, pausa de campanha, troca de criativo) com a data — ajuda a explicar
          variações de resultado depois.
        </p>
        <div className="mb-3 grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-4">
          <Input
            className={FIELD_CLASS}
            type="date"
            value={newChangeEntry.change_date}
            onChange={(e) => setNewChangeEntry((p) => ({ ...p, change_date: e.target.value }))}
          />
          <Select value={newChangeEntry.level} onValueChange={(v) => setNewChangeEntry((p) => ({ ...p, level: v as ChangelogLevel }))}>
            <SelectTrigger className={FIELD_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANGELOG_LEVEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className={FIELD_CLASS}
            placeholder="Nome (opcional)"
            value={newChangeEntry.reference_name || ''}
            onChange={(e) => setNewChangeEntry((p) => ({ ...p, reference_name: e.target.value }))}
          />
          <Button variant="outline" className="gap-1" onClick={addChangelogEntry}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
          <Textarea
            className={`${FIELD_CLASS} sm:col-span-4`}
            placeholder="O que mudou?"
            value={newChangeEntry.description}
            onChange={(e) => setNewChangeEntry((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {form.changelog.map((c, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-md border p-2">
              <span>
                {c.change_date} — [{c.level}] {c.reference_name ? `${c.reference_name}: ` : ''}
                {c.description}
              </span>
              <Button size="icon" variant="ghost" onClick={() => removeChangelogEntry(idx)}>
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ClientGoalsPage() {
  const [goals, setGoals] = useState<ClientGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientGoalFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientGoal | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [newChangeEntry, setNewChangeEntry] = useState<ClientGoalChangelogEntry>({
    change_date: new Date().toISOString().slice(0, 10),
    level: 'conta',
    reference_name: '',
    description: '',
  });

  // Mesmo drill-down campanha > conjunto > anúncio do formulário de edição,
  // só que pra visão de leitura (clicar num cliente na lista sem entrar no
  // modo de edição) — aqui é só consulta, sem "Adicionar Meta"; a meta já
  // configurada de cada nível é mostrada com ObjectivePeriodsTable (mesmo
  // componente do nível conta). Chave composta `${goalId}:${accIndex}`
  // porque essa view itera vários goals ao mesmo tempo (cada um pode estar
  // expandido/carregando independente dos outros).
  const [roHistoryLoading, setRoHistoryLoading] = useState<Record<string, boolean>>({});
  const [roActiveCampaigns, setRoActiveCampaigns] = useState<Record<string, AccountHistorySummary['active_campaigns']>>(
    {},
  );
  const [roDrillDown, setRoDrillDown] = useState<Record<string, typeof roEmptyDrillDown>>({});

  const applyReadOnlyHistory = async (key: string, accountId: string) => {
    if (!accountId.trim()) return;
    setRoHistoryLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const summary = await clientGoalsService.getAccountHistorySummary(accountId);
      setRoActiveCampaigns((prev) => ({ ...prev, [key]: summary.active_campaigns || [] }));
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Não foi possível carregar as campanhas dessa conta.'));
    } finally {
      setRoHistoryLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const roToggleCampaign = (key: string, campaignId: string) =>
    setRoDrillDown((prev) => {
      const current = prev[key] || roEmptyDrillDown;
      const isOpen = current.campaignId === campaignId;
      return { ...prev, [key]: isOpen ? roEmptyDrillDown : { ...roEmptyDrillDown, campaignId } };
    });

  const roToggleAdset = (key: string, adsetId: string) =>
    setRoDrillDown((prev) => {
      const current = prev[key] || roEmptyDrillDown;
      const isOpen = current.adsetId === adsetId;
      return { ...prev, [key]: { ...current, adsetId: isOpen ? null : adsetId, adId: null } };
    });

  const roToggleAd = (key: string, adId: string) =>
    setRoDrillDown((prev) => {
      const current = prev[key] || roEmptyDrillDown;
      const isOpen = current.adId === adId;
      return { ...prev, [key]: { ...current, adId: isOpen ? null : adId } };
    });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientGoalsService.list(true);
      setGoals(data);
    } catch (error) {
      console.error('ClientGoalsPage.load error:', error);
      toast.error('Erro ao carregar a lista de clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const segments = useMemo(
    () => Array.from(new Set(goals.flatMap((g) => g.segments || []))).sort((a, b) => a.localeCompare(b)),
    [goals]
  );

  // Organizada por cliente (ordem alfabética) e filtrável por nome, status
  // (ativo/pausado) e segmento — um cliente pode ter mais de um segmento, o
  // filtro casa se QUALQUER um deles bater com o selecionado.
  const visibleGoals = useMemo(() => {
    return goals
      .filter((g) => !nameFilter.trim() || g.name.toLowerCase().includes(nameFilter.trim().toLowerCase()))
      .filter((g) => statusFilter === 'all' || (statusFilter === 'active' ? g.active : !g.active))
      .filter((g) => segmentFilter === 'all' || (g.segments || []).includes(segmentFilter))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [goals, nameFilter, statusFilter, segmentFilter]);

  const resetChangeEntry = () =>
    setNewChangeEntry({ change_date: new Date().toISOString().slice(0, 10), level: 'conta', reference_name: '', description: '' });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    resetChangeEntry();
    setDialogOpen(true);
  };

  // Edita direto na linha da tabela (expandida), sem abrir uma "tela de
  // edição" separada — acionado por duplo clique na linha ou pelo ícone de
  // lápis.
  const startInlineEdit = (goal: ClientGoal) => {
    setEditingId(goal.id);
    setForm(formFromGoal(goal));
    resetChangeEntry();
    setExpandedId(goal.id);
    setEditingRowId(goal.id);
  };

  const cancelInlineEdit = () => {
    setEditingRowId(null);
    setEditingId(null);
  };

  const toggleExpanded = (goal: ClientGoal) => {
    if (expandedId === goal.id) {
      setExpandedId(null);
      if (editingRowId === goal.id) cancelInlineEdit();
    } else {
      setExpandedId(goal.id);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    // Único campo obrigatório é o nome — conta de anúncio, objetivos, etc.
    // são todos opcionais e podem ser preenchidos depois. ID da conta é
    // opcional (nem todo cliente tem conta Meta ligada ainda): só derruba
    // uma linha de conta se ela estiver genuinamente vazia (nunca preenchida),
    // nunca por falta de ID especificamente. Um objetivo "Outro" sem rótulo
    // ainda precisa de algum texto pro backend (identifica o objetivo), então
    // preenche um padrão em vez de bloquear o salvamento.
    const cleanedAdAccounts = form.ad_accounts.filter(accountHasContent).map((a) => ({
      ...a,
      objectives: a.objectives.map(fixOutroLabel),
      campaigns: a.campaigns.map((c) => ({
        ...c,
        objectives: c.objectives.map(fixOutroLabel),
        adsets: c.adsets.map((adset) => ({
          ...adset,
          objectives: adset.objectives.map(fixOutroLabel),
          ads: adset.ads.map((ad) => ({ ...ad, objectives: ad.objectives.map(fixOutroLabel) })),
        })),
      })),
    }));

    setSaving(true);
    try {
      const payload: ClientGoalFormData = { ...form, ad_accounts: cleanedAdAccounts };
      if (editingId) {
        await clientGoalsService.update(editingId, payload);
        toast.success('Cliente atualizado.');
        setEditingRowId(null);
      } else {
        await clientGoalsService.create(payload);
        toast.success('Cliente cadastrado.');
      }
      setDialogOpen(false);
      setEditingId(null);
      load();
    } catch (error) {
      console.error('ClientGoalsPage.handleSave error:', error);
      toast.error(extractErrorMessage(error, 'Erro ao salvar. Confira os campos e tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (goal: ClientGoal) => {
    try {
      await clientGoalsService.update(goal.id, { ...goal, active: !goal.active });
      toast.success(goal.active ? 'Cliente pausado.' : 'Cliente reativado.');
      load();
    } catch (error) {
      console.error('ClientGoalsPage.handleToggleActive error:', error);
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await clientGoalsService.remove(deleteTarget.id);
      toast.success('Cliente removido.');
      setDeleteTarget(null);
      load();
    } catch (error) {
      console.error('ClientGoalsPage.handleDelete error:', error);
      toast.error('Erro ao remover.');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <BaseHeader
        title="Metas de Clientes"
        subtitle="Cada conta de anúncio com seus próprios objetivos, orçamento e metas de custo por resultado — clique duas vezes num cliente pra editar direto na tabela."
        primaryAction={{ label: 'Novo Cliente', icon: <Plus className="h-4 w-4" />, onClick: openCreate }}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {!loading && goals.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              className={`${FIELD_CLASS} max-w-xs`}
              placeholder="Buscar por cliente..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
              <SelectTrigger className={`${FIELD_CLASS} w-40`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Pausados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className={`${FIELD_CLASS} w-48`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os segmentos</SelectItem>
                {segments.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(nameFilter || statusFilter !== 'all' || segmentFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNameFilter('');
                  setStatusFilter('all');
                  setSegmentFilter('all');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
        ) : visibleGoals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente encontrado com esses filtros.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Cliente</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Fecha Venda</TableHead>
                <TableHead>Contas de Anúncio</TableHead>
                <TableHead>Orçamento Meta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleGoals.map((goal) => {
                const expanded = expandedId === goal.id;
                const editingThisRow = editingRowId === goal.id;
                return (
                  <Fragment key={goal.id}>
                    <TableRow
                      className={`cursor-pointer ${!goal.active ? 'opacity-60' : ''}`}
                      onClick={() => toggleExpanded(goal)}
                      onDoubleClick={() => startInlineEdit(goal)}
                    >
                      <TableCell className="w-6 text-muted-foreground">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" /> {goal.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {goal.segments?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {goal.segments.map((s) => (
                              <Badge key={s} variant="outline">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{goal.sales_channel || '—'}</TableCell>
                      <TableCell>
                        {goal.ad_accounts.length ? (
                          <div className="flex flex-wrap gap-1">
                            {goal.ad_accounts.map((a) => (
                              <Badge key={a.id} variant="outline" className="gap-1">
                                <Building2 className="h-3 w-3" /> {a.name || a.id}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{money(goal.meta_budget)}</TableCell>
                      <TableCell>
                        {goal.active ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pausado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title={goal.active ? 'Pausar' : 'Reativar'} onClick={() => handleToggleActive(goal)}>
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Editar" onClick={() => startInlineEdit(goal)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(goal)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-4" onClick={(e) => e.stopPropagation()}>
                          {editingThisRow ? (
                            <div className="space-y-4">
                              <ClientGoalFormFields
                                form={form}
                                setForm={setForm}
                                isEditing
                                newChangeEntry={newChangeEntry}
                                setNewChangeEntry={setNewChangeEntry}
                              />
                              <div className="flex justify-end gap-2 border-t pt-3">
                                <Button variant="outline" onClick={cancelInlineEdit}>
                                  Cancelar
                                </Button>
                                <Button onClick={handleSave} disabled={saving}>
                                  {saving ? 'Salvando...' : 'Salvar'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {goal.ad_accounts.length ? (
                                goal.ad_accounts.map((account, accIndex) => {
                                  const roKey = `${goal.id}:${accIndex}`;
                                  const accountCampaignGoals = account.campaigns || [];
                                  const roCampaigns = roActiveCampaigns[roKey]
                                    ? mergeWithSavedGoals(roActiveCampaigns[roKey] as CampaignNode[], accountCampaignGoals, campaignPlaceholder)
                                    : roActiveCampaigns[roKey];
                                  const roDrill = roDrillDown[roKey];
                                  const roObjectiveTypes = Array.from(new Set(account.objectives.map((o) => o.objective_type)));

                                  return (
                                    <div key={account.id || accIndex} className="rounded-md border bg-background p-3">
                                      <div className="mb-1 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                          <Building2 className="h-4 w-4 text-muted-foreground" />
                                          {account.name || account.id}
                                          <span className="text-xs font-normal text-muted-foreground">({account.id})</span>
                                        </div>
                                        {account.id && (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            title="Ver campanhas ativas dessa conta e comparar com a meta"
                                            disabled={roHistoryLoading[roKey]}
                                            onClick={() => applyReadOnlyHistory(roKey, account.id)}
                                          >
                                            {roHistoryLoading[roKey] ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <History className="h-4 w-4" />
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                      {(account.locations.length > 0 || ageRangeLabel(account.age_min, account.age_max) || account.gender) && (
                                        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                                          {account.locations.map((loc) => (
                                            <Badge key={loc.name} variant="outline">
                                              {loc.name}
                                              {loc.radius != null && ` (+${loc.radius}km)`}
                                            </Badge>
                                          ))}
                                          {ageRangeLabel(account.age_min, account.age_max) && (
                                            <Badge variant="outline">{ageRangeLabel(account.age_min, account.age_max)}</Badge>
                                          )}
                                          <Badge variant="outline">{genderLabel(account.gender)}</Badge>
                                        </div>
                                      )}
                                      {account.objectives.length ? (
                                        <div className="space-y-3">
                                          {account.objectives.map((o) => (
                                            <div key={o.key} className="rounded-md border p-2">
                                              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-xs font-semibold">{objectiveLabel(o)}</span>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs text-muted-foreground">Orçamento: {money(o.budget)}</span>
                                                  <ObservationBadge objective={o} />
                                                </div>
                                              </div>
                                              <ObjectivePeriodsTable objective={o} />
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">Nenhum objetivo cadastrado pra esta conta.</p>
                                      )}

                                      {(roHistoryLoading[roKey] || roCampaigns) && (
                                        <div className="mt-3 rounded-md border border-dashed p-2 text-xs">
                                          {roHistoryLoading[roKey] ? (
                                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                              <Loader2 className="h-3 w-3 animate-spin" /> Buscando campanhas ativas...
                                            </span>
                                          ) : roCampaigns && roCampaigns.length > 0 ? (
                                            <div className="overflow-x-auto">
                                              <div className="min-w-[560px]">
                                                <div className="mb-1 font-medium text-foreground">
                                                  Campanhas ativas agora ({roCampaigns.length}) — últimos 30 dias:
                                                </div>
                                                <div className="grid grid-cols-[1fr_90px_110px_110px] gap-x-2 border-b pb-1 text-muted-foreground">
                                                  <span>Campanha</span>
                                                  <span>Resultados</span>
                                                  <span>Custo/Result.</span>
                                                  <span>Conjuntos ativos</span>
                                                </div>
                                                {roCampaigns.map((camp) => {
                                                  const campGoal = accountCampaignGoals.find((c) => c.id === camp.id);
                                                  const campObjectiveTypes = campGoal?.objectives.length
                                                    ? Array.from(new Set(campGoal.objectives.map((o) => o.objective_type)))
                                                    : roObjectiveTypes;
                                                  const results = computeResults(campObjectiveTypes, camp.metrics);
                                                  const cpr = results != null && results > 0 ? camp.metrics.spend / results : null;
                                                  const campOpen = roDrill?.campaignId === camp.id;
                                                  const roDisplayAdsets = mergeWithSavedGoals(camp.adsets, campGoal?.adsets || [], adsetPlaceholder);
                                                  return (
                                                    <Fragment key={camp.id}>
                                                      <div
                                                        className="grid cursor-pointer grid-cols-[1fr_90px_110px_110px] items-center gap-x-2 border-b py-1.5 hover:bg-accent/50"
                                                        onClick={() => roToggleCampaign(roKey, camp.id)}
                                                      >
                                                        <span className="flex items-center gap-1 truncate">
                                                          {campOpen ? (
                                                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                                          ) : (
                                                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                                          )}
                                                          {camp.name}
                                                          {!!campGoal?.objectives.length && (
                                                            <Badge variant="outline" className="ml-1 text-[10px]">
                                                              meta própria
                                                            </Badge>
                                                          )}
                                                        </span>
                                                        <span>{results != null ? formatResults(results) : '—'}</span>
                                                        <span>{cpr != null ? money(cpr) : '—'}</span>
                                                        <span>{camp.active_adsets_count}</span>
                                                      </div>
                                                      {campOpen && (
                                                        <div className="mb-2 ml-4 border-l pl-2">
                                                          {!!campGoal?.objectives[0] && (
                                                            <div className="my-2">
                                                              <p className="mb-1 text-xs font-semibold text-muted-foreground">Meta desta campanha</p>
                                                              <GoalPeriodsReadOnlyTable objective={campGoal.objectives[0]} />
                                                            </div>
                                                          )}
                                                          {roDisplayAdsets.length === 0 ? (
                                                            <p className="py-1 text-muted-foreground">
                                                              Nenhum conjunto de anúncio nessa campanha.
                                                            </p>
                                                          ) : (
                                                            roDisplayAdsets.map((adset) => {
                                                              const adsetGoal = campGoal?.adsets.find((a) => a.id === adset.id);
                                                              const adsetObjectiveTypes = adsetGoal?.objectives.length
                                                                ? Array.from(new Set(adsetGoal.objectives.map((o) => o.objective_type)))
                                                                : campObjectiveTypes;
                                                              const adsetResults = computeResults(adsetObjectiveTypes, adset.metrics);
                                                              const adsetCpr =
                                                                adsetResults != null && adsetResults > 0
                                                                  ? adset.metrics.spend / adsetResults
                                                                  : null;
                                                              const adsetOpen = roDrill?.adsetId === adset.id;
                                                              const roDisplayAds = mergeWithSavedGoals(adset.ads, adsetGoal?.ads || [], adPlaceholder);
                                                              return (
                                                                <Fragment key={adset.id}>
                                                                  <div
                                                                    className="grid cursor-pointer grid-cols-[1fr_90px_110px_110px] items-center gap-x-2 border-b py-1.5 hover:bg-accent/50"
                                                                    onClick={() => roToggleAdset(roKey, adset.id)}
                                                                  >
                                                                    <span className="flex items-center gap-1 truncate">
                                                                      {adsetOpen ? (
                                                                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                                                      ) : (
                                                                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                                                      )}
                                                                      {adset.name}
                                                                      <Badge variant="outline" className="ml-1 text-[10px]">
                                                                        {adset.effective_status}
                                                                      </Badge>
                                                                      {!!adsetGoal?.objectives.length && (
                                                                        <Badge variant="outline" className="text-[10px]">
                                                                          meta própria
                                                                        </Badge>
                                                                      )}
                                                                    </span>
                                                                    <span>{adsetResults != null ? formatResults(adsetResults) : '—'}</span>
                                                                    <span>{adsetCpr != null ? money(adsetCpr) : '—'}</span>
                                                                    <span>{adset.active_ads_count}</span>
                                                                  </div>
                                                                  {adsetOpen && (
                                                                    <div className="mb-2 ml-4 border-l pl-2">
                                                                      {!!adsetGoal?.objectives[0] && (
                                                                        <div className="my-2">
                                                                          <p className="mb-1 text-xs font-semibold text-muted-foreground">Meta deste conjunto</p>
                                                                          <GoalPeriodsReadOnlyTable objective={adsetGoal.objectives[0]} />
                                                                        </div>
                                                                      )}
                                                                      {roDisplayAds.length === 0 ? (
                                                                        <p className="py-1 text-muted-foreground">
                                                                          Nenhum anúncio nesse conjunto.
                                                                        </p>
                                                                      ) : (
                                                                        roDisplayAds.map((ad) => {
                                                                          const adGoal = adsetGoal?.ads.find((a) => a.id === ad.id);
                                                                          const adObjectiveTypes = adGoal?.objectives.length
                                                                            ? Array.from(new Set(adGoal.objectives.map((o) => o.objective_type)))
                                                                            : adsetObjectiveTypes;
                                                                          const adResults = computeResults(adObjectiveTypes, ad.metrics);
                                                                          const adCpr =
                                                                            adResults != null && adResults > 0
                                                                              ? ad.metrics.spend / adResults
                                                                              : null;
                                                                          const adOpen = roDrill?.adId === ad.id;
                                                                          return (
                                                                            <Fragment key={ad.id}>
                                                                              <div
                                                                                className="grid cursor-pointer grid-cols-[1fr_90px_110px_110px] items-center gap-x-2 border-b py-1.5 last:border-b-0 hover:bg-accent/50"
                                                                                onClick={() => roToggleAd(roKey, ad.id)}
                                                                              >
                                                                                <span className="flex items-center gap-1 truncate pl-4">
                                                                                  {adOpen ? (
                                                                                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                                                                  ) : (
                                                                                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                                                                  )}
                                                                                  {ad.name}
                                                                                  <Badge variant="outline" className="ml-1 text-[10px]">
                                                                                    {ad.effective_status}
                                                                                  </Badge>
                                                                                  {!!adGoal?.objectives.length && (
                                                                                    <Badge variant="outline" className="text-[10px]">
                                                                                      meta própria
                                                                                    </Badge>
                                                                                  )}
                                                                                </span>
                                                                                <span>{adResults != null ? formatResults(adResults) : '—'}</span>
                                                                                <span>{adCpr != null ? money(adCpr) : '—'}</span>
                                                                                <span>—</span>
                                                                              </div>
                                                                              {adOpen && !!adGoal?.objectives[0] && (
                                                                                <div className="mb-2 ml-4 border-l py-2 pl-2">
                                                                                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Meta deste anúncio</p>
                                                                                  <GoalPeriodsReadOnlyTable objective={adGoal.objectives[0]} />
                                                                                </div>
                                                                              )}
                                                                            </Fragment>
                                                                          );
                                                                        })
                                                                      )}
                                                                    </div>
                                                                  )}
                                                                </Fragment>
                                                              );
                                                            })
                                                          )}
                                                        </div>
                                                      )}
                                                    </Fragment>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground">Nenhuma campanha ativa no momento nessa conta.</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-sm text-muted-foreground">Nenhuma conta de anúncio vinculada.</p>
                              )}

                              {goal.changelog.length > 0 && (
                                <div>
                                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Mudanças Registradas</p>
                                  <div className="space-y-1">
                                    {goal.changelog.map((c, idx) => (
                                      <p key={idx} className="text-xs text-muted-foreground">
                                        {c.change_date} — [{c.level}] {c.reference_name ? `${c.reference_name}: ` : ''}
                                        {c.description}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <p className="text-xs text-muted-foreground">Dica: dê dois cliques na linha do cliente pra editar.</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] sm:max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>
              Configure segmentos, contas de anúncio (cada uma com seus próprios objetivos/metas) e o histórico de mudanças.
            </DialogDescription>
          </DialogHeader>

          <ClientGoalFormFields
            form={form}
            setForm={setForm}
            isEditing={false}
            newChangeEntry={newChangeEntry}
            setNewChangeEntry={setNewChangeEntry}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove "{deleteTarget?.name}" e todo o histórico de acompanhamento automático dele. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
