import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@evoapi/design-system';
import { ArrowLeftRight, Building2, ChevronLeft, ChevronRight, Clock, Loader2, Search, Settings2 } from 'lucide-react';
import { BaseHeader } from '@/components/base';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import { trafficPanelService, type TrafficAccount } from '@/services/marketing/trafficPanelService';
import {
  aggregateDataForLevel,
  sortAggregatedItems,
  type AggregatedItem,
  type StructuralCampaign,
  type RawInsightRow,
  type SortKey,
  type SortDirection,
} from '@/utils/marketing/trafficMetrics';
import {
  METRIC_ORDER,
  METRIC_LABELS,
  METRIC_COLORS,
  METRIC_ICONS,
  ZERO_HIDDEN_METRICS,
  DEFAULT_METRIC_VISIBILITY,
  formatMetricValue,
  type MetricKey,
} from '@/utils/marketing/trafficMetricDisplay';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'last30d' | 'year' | 'maximum';

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  week: 'Últimos 7 dias',
  month: 'Este mês',
  last30d: 'Últimos 30 dias',
  year: 'Último ano',
  maximum: 'Máximo',
};

const SORT_OPTIONS: Array<{ value: string; label: string; key: SortKey; direction: SortDirection }> = [
  { value: 'name_asc', label: 'Nome (A-Z)', key: 'name', direction: 'asc' },
  { value: 'spend_desc', label: 'Maior gasto', key: 'spend', direction: 'desc' },
  { value: 'spend_asc', label: 'Menor gasto', key: 'spend', direction: 'asc' },
  { value: 'cpc_asc', label: 'Melhor CPC', key: 'cpc', direction: 'asc' },
  { value: 'ctr_desc', label: 'Melhor CTR', key: 'ctr', direction: 'desc' },
  { value: 'messaging_desc', label: 'Mais mensagens', key: 'messaging', direction: 'desc' },
];

const METRIC_VISIBILITY_STORAGE_KEY = 'traffic-panel-metric-visibility';
const SETTINGS_STORAGE_KEY = 'traffic-panel-settings';
const DAYS_LEFT_SPEND_WINDOW = 30;

// Cor do título do card por nível — igual ao original (account=slate-200,
// campaign=sky-300, adset=teal-300, ad=yellow-300).
const LEVEL_TITLE_COLOR: Record<DrillLevelForColor, string> = {
  accounts: 'text-slate-200',
  campaigns: 'text-sky-300',
  adsets: 'text-teal-300',
  ads: 'text-yellow-300',
};

type DrillLevelForColor = 'accounts' | 'campaigns' | 'adsets' | 'ads';

function formatDateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRangeForPreset(preset: DatePreset): { start: string; stop: string } {
  const now = new Date();
  const start = new Date(now);
  const stop = new Date(now);
  switch (preset) {
    case 'today':
      return { start: formatDateLocal(now), stop: formatDateLocal(now) };
    case 'yesterday':
      start.setDate(now.getDate() - 1);
      stop.setDate(now.getDate() - 1);
      break;
    case 'week':
      start.setDate(now.getDate() - 6);
      break;
    case 'month':
      start.setFullYear(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last30d':
      start.setDate(now.getDate() - 29);
      break;
    case 'year':
      start.setDate(now.getDate() - 364);
      break;
    case 'maximum':
      start.setFullYear(2010, 0, 1);
      break;
  }
  return { start: formatDateLocal(start), stop: formatDateLocal(stop) };
}

function loadStoredVisibility(): Record<MetricKey, boolean> {
  try {
    const raw = localStorage.getItem(METRIC_VISIBILITY_STORAGE_KEY);
    if (!raw) return DEFAULT_METRIC_VISIBILITY;
    return { ...DEFAULT_METRIC_VISIBILITY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_METRIC_VISIBILITY;
  }
}

function loadStoredSettings(): { datePreset: DatePreset; sortValue: string } {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { datePreset: 'yesterday', sortValue: 'spend_desc' };
    const parsed = JSON.parse(raw);
    return { datePreset: parsed.datePreset || 'yesterday', sortValue: parsed.sortValue || 'spend_desc' };
  } catch {
    return { datePreset: 'yesterday', sortValue: 'spend_desc' };
  }
}

interface Entity {
  id: string;
  name: string;
}

type DrillLevel = DrillLevelForColor;

// Ponto colorido de status — igual ao getStatusDotHTML do original (bolinha,
// não badge com texto).
function StatusDot({ status }: { status: string }) {
  const upper = (status || 'UNKNOWN').toUpperCase();
  let colorClass = 'bg-red-500';
  let label = 'Erro/Outro';
  if (upper === 'ACTIVE') {
    colorClass = 'bg-green-500';
    label = 'Ativa';
  } else if (upper === 'PAUSED' || upper === 'INACTIVE') {
    colorClass = 'bg-gray-500';
    label = 'Pausada';
  } else if (upper === 'PENDING_REVIEW' || upper === 'DISAPPROVED') {
    colorClass = 'bg-yellow-500';
    label = 'Revisão/Reprovada';
  }
  return <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ml-2 ${colorClass}`} title={`Status: ${label} (${upper})`} />;
}

function getDaysLeftColor(daysLeft: number): string {
  if (daysLeft > 14) return 'text-green-400';
  if (daysLeft > 7) return 'text-yellow-400';
  return 'text-red-400';
}

function computeDaysLeft(account: TrafficAccount): number {
  const balance = parseFloat(account.balance || '0');
  const periodSpend = parseFloat(account.insights_30d?.[0]?.spend || '0');
  const dailySpend = periodSpend / DAYS_LEFT_SPEND_WINDOW;
  if (!(dailySpend > 0) || !(balance > 0)) return 0;
  return balance / dailySpend;
}

// Ícone + rótulo colorido à esquerda, valor colorido (mesma cor) à direita —
// mesmo layout e paleta do renderMetricRow original.
function MetricRow({ metricKey, value, visible }: { metricKey: MetricKey; value: number; visible: boolean }) {
  if (!visible) return null;
  if (ZERO_HIDDEN_METRICS.includes(metricKey) && !(value > 0)) return null;
  const Icon = METRIC_ICONS[metricKey];
  const colorClass = METRIC_COLORS[metricKey];
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${colorClass}`} />
        <span className="font-medium text-slate-400">{METRIC_LABELS[metricKey]}:</span>
      </div>
      <span className={`font-semibold ${colorClass}`}>{formatMetricValue(metricKey, value)}</span>
    </div>
  );
}

function accountToMetricValues(account: TrafficAccount): Partial<Record<MetricKey, number>> {
  const insight = account.insights?.[0];
  const actions = insight?.actions || [];
  const findAction = (types: string[]) => {
    for (const t of types) {
      const found = actions.find((a) => a.action_type === t);
      if (found) return parseFloat(found.value || '0');
    }
    return 0;
  };
  const spend = parseFloat(insight?.spend || '0');
  const impressions = parseFloat(insight?.impressions || '0');
  const reach = parseFloat(insight?.reach || '0');
  const clicks = parseFloat(insight?.clicks || '0');
  const messaging = findAction(['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection']);
  const leads = findAction([
    'lead',
    'onsite_conversion.lead_grouped',
    'offsite_conversion.fb_pixel_lead',
    'onsite_conversion.lead',
    'onsite_web_lead',
    'offsite_complete_registration_add_meta_leads',
  ]);
  return {
    balance: parseFloat(account.balance || '0'),
    spend,
    impressions,
    reach,
    frequency: reach > 0 ? impressions / reach : 0,
    clicks,
    cpc: clicks > 0 ? spend / clicks : 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
    messaging,
    cpMsg: messaging > 0 ? spend / messaging : 0,
    leads,
    cpLead: leads > 0 ? spend / leads : 0,
    linkClicks: findAction(['link_click']),
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
  };
}

function itemToMetricValues(item: AggregatedItem): Partial<Record<MetricKey, number>> {
  return {
    spend: item.spend,
    impressions: item.impressions,
    reach: item.reach,
    frequency: item.frequency,
    clicks: item.clicks,
    cpc: item.cpc,
    ctr: item.ctr,
    messaging: item.messaging,
    cpMsg: item.cpMsg,
    leads: item.leads,
    cpLead: item.cpLead,
    linkClicks: item.linkClicks,
    cpm: item.cpm,
  };
}

export default function TrafficPanelPage() {
  const [bms, setBms] = useState<Entity[] | null>(null);
  const [loadingBms, setLoadingBms] = useState(false);
  const [selectedBm, setSelectedBm] = useState<Entity | null>(null);

  const [accounts, setAccounts] = useState<TrafficAccount[] | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<TrafficAccount | null>(null);

  const stored = loadStoredSettings();
  const [datePreset, setDatePreset] = useState<DatePreset>(stored.datePreset);
  const [sortValue, setSortValue] = useState(stored.sortValue);
  const [visibility, setVisibility] = useState<Record<MetricKey, boolean>>(loadStoredVisibility());
  const [query, setQuery] = useState('');

  const [treeStructural, setTreeStructural] = useState<StructuralCampaign[]>([]);
  const [treeInsights, setTreeInsights] = useState<RawInsightRow[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  const [level, setLevel] = useState<DrillLevel>('accounts');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [adSetId, setAdSetId] = useState<string | null>(null);

  const { start: dateStart, stop: dateStop } = useMemo(() => getDateRangeForPreset(datePreset), [datePreset]);

  useEffect(() => {
    localStorage.setItem(METRIC_VISIBILITY_STORAGE_KEY, JSON.stringify(visibility));
  }, [visibility]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ datePreset, sortValue }));
  }, [datePreset, sortValue]);

  useEffect(() => {
    setLoadingBms(true);
    clientGoalsService
      .listBusinessManagers()
      .then(setBms)
      .catch(() => {
        toast.error('Não foi possível carregar as Business Managers.');
        setBms([]);
      })
      .finally(() => setLoadingBms(false));
  }, []);

  const loadAccounts = (bmId: string) => {
    setLoadingAccounts(true);
    trafficPanelService
      .listAccounts(bmId, dateStart, dateStop)
      .then(setAccounts)
      .catch(() => {
        toast.error('Não foi possível carregar as contas de anúncio.');
        setAccounts([]);
      })
      .finally(() => setLoadingAccounts(false));
  };

  const selectBm = (bm: Entity) => {
    setSelectedBm(bm);
    setAccounts(null);
    setSelectedAccount(null);
    setLevel('accounts');
    loadAccounts(bm.id);
  };

  useEffect(() => {
    if (selectedBm) loadAccounts(selectedBm.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStart, dateStop]);

  const loadTree = (accountId: string) => {
    setLoadingTree(true);
    trafficPanelService
      .getCampaignsTree(accountId, dateStart, dateStop)
      .then(({ structural, insights }) => {
        setTreeStructural(structural);
        setTreeInsights(insights);
      })
      .catch(() => toast.error('Não foi possível carregar as campanhas dessa conta.'))
      .finally(() => setLoadingTree(false));
  };

  const selectAccount = (account: TrafficAccount) => {
    setSelectedAccount(account);
    setLevel('campaigns');
    setCampaignId(null);
    setAdSetId(null);
    setQuery('');
    loadTree(account.id);
  };

  useEffect(() => {
    if (selectedAccount) loadTree(selectedAccount.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStart, dateStop]);

  const sortOption = SORT_OPTIONS.find((o) => o.value === sortValue) || SORT_OPTIONS[1];

  const campaigns = useMemo(() => aggregateDataForLevel(treeStructural, treeInsights, 'campaign'), [treeStructural, treeInsights]);
  const adSets = useMemo(
    () => (campaignId ? aggregateDataForLevel(treeStructural, treeInsights, 'adset', campaignId) : []),
    [treeStructural, treeInsights, campaignId],
  );
  const ads = useMemo(
    () => (adSetId ? aggregateDataForLevel(treeStructural, treeInsights, 'ad', adSetId) : []),
    [treeStructural, treeInsights, adSetId],
  );

  const currentItems = useMemo(
    () => (level === 'campaigns' ? campaigns : level === 'adsets' ? adSets : level === 'ads' ? ads : []),
    [level, campaigns, adSets, ads],
  );
  const filteredItems = useMemo(
    () => currentItems.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())),
    [currentItems, query],
  );
  const sortedItems = useMemo(
    () => sortAggregatedItems(filteredItems, sortOption.key, sortOption.direction),
    [filteredItems, sortOption],
  );

  const filteredAccounts = useMemo(
    () => (accounts || []).filter((a) => a.name.toLowerCase().includes(query.toLowerCase())),
    [accounts, query],
  );

  const toggleVisibility = (key: MetricKey) => setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  const openCampaign = (campaign: AggregatedItem) => {
    setCampaignId(campaign.id);
    setLevel('adsets');
    setQuery('');
  };
  const openAdSet = (adSet: AggregatedItem) => {
    setAdSetId(adSet.id);
    setLevel('ads');
    setQuery('');
  };

  const goBack = () => {
    if (level === 'ads') {
      setLevel('adsets');
      setAdSetId(null);
    } else if (level === 'adsets') {
      setLevel('campaigns');
      setCampaignId(null);
    } else if (level === 'campaigns') {
      setSelectedAccount(null);
      setLevel('accounts');
    }
    setQuery('');
  };

  const settingsPanel = (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="outline" className="border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-100" title="Métricas visíveis">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-slate-800 border-slate-700 text-slate-200" align="end">
        <p className="text-xs font-semibold mb-2 text-slate-400">Métricas visíveis</p>
        <div className="space-y-1.5 max-h-80 overflow-auto">
          {METRIC_ORDER.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={visibility[key]} onCheckedChange={() => toggleVisibility(key)} />
              {METRIC_LABELS[key]}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  const selectTriggerClass = 'w-40 bg-slate-700 text-slate-300 border-slate-600 focus:ring-sky-500';

  const toolbar = (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
        <SelectTrigger className={selectTriggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
          {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((key) => (
            <SelectItem key={key} value={key}>
              {DATE_PRESET_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortValue} onValueChange={setSortValue}>
        <SelectTrigger className="w-44 bg-slate-700 text-slate-300 border-slate-600 focus:ring-sky-500">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {settingsPanel}
    </div>
  );

  const cardBaseClass =
    'text-left rounded-lg p-4 shadow-xl flex flex-col justify-between bg-slate-800 border border-slate-700 transition-all duration-300';
  const cardInteractiveClass = 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sky-500/10 active:scale-[0.98]';

  return (
    <div className="space-y-4 pb-8">
      <BaseHeader title="Painel Tráfego" subtitle="Contas, campanhas, conjuntos e anúncios direto na Meta Ads." />

      <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 p-4 sm:p-6">
        {!selectedBm ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800">
            <Command className="bg-transparent">
              <CommandInput placeholder="Buscar Business Manager..." className="text-slate-200" />
              {loadingBms ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <>
                  <CommandEmpty className="text-slate-400">Nenhuma Business Manager encontrada.</CommandEmpty>
                  <CommandGroup heading="Business Manager" className="max-h-96 overflow-auto text-slate-200">
                    {(bms || []).map((bm) => (
                      <CommandItem key={bm.id} value={bm.name} onSelect={() => selectBm(bm)} className="text-slate-200 aria-selected:bg-slate-700">
                        {bm.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </Command>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {level !== 'accounts' && (
                  <Button size="icon" variant="ghost" onClick={goBack} title="Voltar" className="text-slate-300 hover:bg-slate-700 hover:text-slate-100">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <span className="text-sm text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> {selectedBm.name}
                </span>
                {selectedAccount && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm text-slate-300">{selectedAccount.name}</span>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                  onClick={() => {
                    setSelectedBm(null);
                    setAccounts(null);
                    setSelectedAccount(null);
                    setLevel('accounts');
                  }}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Trocar
                </Button>
              </div>
              {toolbar}
            </div>

            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome..."
                className="pl-8 bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500 focus-visible:ring-sky-500"
              />
            </div>

            {level === 'accounts' ? (
              loadingAccounts ? (
                <div className="text-center text-sm text-slate-400 py-10">Carregando...</div>
              ) : filteredAccounts.length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-10 border border-dashed border-slate-700 rounded-md">
                  Nenhuma conta encontrada.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredAccounts.map((account) => {
                    const values = accountToMetricValues(account);
                    const daysLeft = computeDaysLeft(account);
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => selectAccount(account)}
                        className={`${cardBaseClass} ${cardInteractiveClass}`}
                      >
                        <div className="mb-2 pb-1">
                          <h3 className={`text-sm font-bold line-clamp-2 leading-tight ${LEVEL_TITLE_COLOR.accounts}`} title={account.name}>
                            {account.name}
                          </h3>
                          {account.is_prepay_account && daysLeft > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold ${getDaysLeftColor(daysLeft)} bg-slate-700/50 px-2 py-0.5 rounded-full mt-1`}
                              title={`Orçamento dura ${daysLeft.toFixed(1)} dias`}
                            >
                              <Clock className="w-3 h-3" /> {daysLeft.toFixed(0)} dias restantes
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 pt-2">
                          {METRIC_ORDER.map((key) => (
                            <MetricRow key={key} metricKey={key} value={values[key] ?? 0} visible={visibility[key]} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : loadingTree ? (
              <div className="text-center text-sm text-slate-400 py-10">Carregando...</div>
            ) : sortedItems.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-10 border border-dashed border-slate-700 rounded-md">
                Nenhum item encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {sortedItems.map((item) => {
                  const values = itemToMetricValues(item);
                  const canDrill = level === 'campaigns' || level === 'adsets';
                  return (
                    <div
                      key={item.id}
                      role={canDrill ? 'button' : undefined}
                      tabIndex={canDrill ? 0 : undefined}
                      onClick={canDrill ? () => (level === 'campaigns' ? openCampaign(item) : openAdSet(item)) : undefined}
                      onKeyDown={
                        canDrill
                          ? (e) => {
                              if (e.key !== 'Enter') return;
                              if (level === 'campaigns') openCampaign(item);
                              else openAdSet(item);
                            }
                          : undefined
                      }
                      className={`${cardBaseClass} ${canDrill ? cardInteractiveClass : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2 pb-1 border-b border-slate-700">
                        <h3 className={`text-sm font-bold line-clamp-2 leading-tight pr-1 ${LEVEL_TITLE_COLOR[level]}`} title={item.name}>
                          {item.name}
                        </h3>
                        <StatusDot status={item.status} />
                      </div>
                      <div className="space-y-1 pt-2">
                        {METRIC_ORDER.filter((k) => k !== 'balance').map((key) => (
                          <MetricRow key={key} metricKey={key} value={values[key] ?? 0} visible={visibility[key]} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
