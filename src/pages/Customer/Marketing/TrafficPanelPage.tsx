import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Badge,
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
import { ArrowLeftRight, Building2, ChevronLeft, ChevronRight, Loader2, Search, Settings2 } from 'lucide-react';
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

type DrillLevel = 'accounts' | 'campaigns' | 'adsets' | 'ads';

function MetricRow({ metricKey, value, visible }: { metricKey: MetricKey; value: number; visible: boolean }) {
  if (!visible) return null;
  if (ZERO_HIDDEN_METRICS.includes(metricKey) && !(value > 0)) return null;
  return (
    <p className="text-xs flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{METRIC_LABELS[metricKey]}:</span>
      <span className="font-medium">{formatMetricValue(metricKey, value)}</span>
    </p>
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
        <Button size="icon" variant="outline" title="Métricas visíveis">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <p className="text-xs font-semibold mb-2 text-muted-foreground">Métricas visíveis</p>
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

  const toolbar = (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((key) => (
            <SelectItem key={key} value={key}>
              {DATE_PRESET_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortValue} onValueChange={setSortValue}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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

  return (
    <div className="space-y-4 pb-8">
      <BaseHeader title="Painel Tráfego" subtitle="Contas, campanhas, conjuntos e anúncios direto na Meta Ads." />

      {!selectedBm ? (
        <div className="rounded-lg border border-border bg-card">
          <Command>
            <CommandInput placeholder="Buscar Business Manager..." />
            {loadingBms ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhuma Business Manager encontrada.</CommandEmpty>
                <CommandGroup heading="Business Manager" className="max-h-96 overflow-auto">
                  {(bms || []).map((bm) => (
                    <CommandItem key={bm.id} value={bm.name} onSelect={() => selectBm(bm)}>
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
                <Button size="icon" variant="ghost" onClick={goBack} title="Voltar">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {selectedBm.name}
              </span>
              {selectedAccount && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{selectedAccount.name}</span>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
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
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome..." className="pl-8" />
          </div>

          {level === 'accounts' ? (
            loadingAccounts ? (
              <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
                Nenhuma conta encontrada.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredAccounts.map((account) => {
                  const values = accountToMetricValues(account);
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => selectAccount(account)}
                      className="text-left rounded-lg border border-border bg-card p-4 space-y-1.5 hover:bg-muted/40 transition-colors"
                    >
                      <h4 className="text-sm font-semibold truncate mb-1.5" title={account.name}>
                        {account.name}
                      </h4>
                      {METRIC_ORDER.map((key) => (
                        <MetricRow key={key} metricKey={key} value={values[key] ?? 0} visible={visibility[key]} />
                      ))}
                    </button>
                  );
                })}
              </div>
            )
          ) : loadingTree ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : sortedItems.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
              Nenhum item encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedItems.map((item) => {
                const values = itemToMetricValues(item);
                const canDrill = level === 'campaigns' || level === 'adsets';
                const Wrapper = canDrill ? 'button' : 'div';
                return (
                  <Wrapper
                    key={item.id}
                    type={canDrill ? 'button' : undefined}
                    onClick={canDrill ? () => (level === 'campaigns' ? openCampaign(item) : openAdSet(item)) : undefined}
                    className={`text-left rounded-lg border border-border bg-card p-4 space-y-1.5 ${canDrill ? 'hover:bg-muted/40 transition-colors' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="text-sm font-semibold truncate" title={item.name}>
                        {item.name}
                      </h4>
                      <Badge variant={item.status === 'ACTIVE' ? 'default' : 'secondary'} className="shrink-0">
                        {item.status}
                      </Badge>
                    </div>
                    {METRIC_ORDER.filter((k) => k !== 'balance').map((key) => (
                      <MetricRow key={key} metricKey={key} value={values[key] ?? 0} visible={visibility[key]} />
                    ))}
                  </Wrapper>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
