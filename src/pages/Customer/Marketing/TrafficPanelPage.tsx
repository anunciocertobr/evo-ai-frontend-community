import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Label,
  Textarea,
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
} from '@evoapi/design-system';
import {
  ArrowLeftRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  ImagePlus,
  Loader2,
  Pause,
  PenLine,
  Play,
  Plus,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react';
import { BaseHeader } from '@/components/base';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import { trafficPanelService, type TrafficAccount } from '@/services/marketing/trafficPanelService';
import {
  metaAdsManagerService,
  OBJECTIVE_MAP,
  type ObjectiveKey,
  type CreateCampaignPayload,
  type MetaLevel,
} from '@/services/marketing/metaAdsManagerService';
import { apiErrorMessage } from '@/utils/apiHelpers';
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

function formatCurrencyBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

const LEVEL_TO_META_LEVEL: Record<'campaigns' | 'adsets' | 'ads', MetaLevel> = {
  campaigns: 'campaign',
  adsets: 'adset',
  ads: 'ad',
};

const ITEM_TYPE_LABEL: Record<'campaigns' | 'adsets' | 'ads', string> = {
  campaigns: 'Campanha',
  adsets: 'Conjunto',
  ads: 'Anúncio',
};

// Painel de detalhes exibido no card ao dar 1 clique numa campanha/conjunto/
// anúncio — mesma informação e mesmo texto de dica ("clique duplo para...")
// do getDetailsHTML original, só que em JSX em vez de string HTML montada
// na mão.
function CardDetails({ item, level }: { item: AggregatedItem; level: 'campaigns' | 'adsets' | 'ads' }) {
  if (level === 'campaigns') {
    const objective = item.objective ? item.objective.split('_').join(' ') : 'N/D';
    return (
      <div className="space-y-1 pt-2 text-xs">
        <h4 className="font-bold text-slate-300 mb-2">Detalhes da Campanha</h4>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Objetivo:</span>
          <span className="font-semibold text-sky-400">{objective}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Conjuntos Ativos:</span>
          <span className="font-semibold text-teal-400">
            {item.activeAdSetsCount || 0} de {item.totalAdSets || 0}
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Status:</span>
          <span className="font-semibold text-yellow-400">{item.status || 'N/D'}</span>
        </div>
        <div className="pt-2 text-center text-slate-500 text-[0.7rem] italic">Clique duplo para ver Conjuntos de Anúncios</div>
      </div>
    );
  }

  if (level === 'adsets') {
    const budget = formatCurrencyBRL(parseFloat(item.dailyBudget || '0') / 100);
    const geo = item.targeting?.geo_locations;
    let locationDetail = 'N/D';
    if (geo?.cities?.length) locationDetail = geo.cities[0].name || 'N/D';
    else if (geo?.places?.length) locationDetail = geo.places[0].name || 'N/D';
    else if (geo?.countries?.length) locationDetail = geo.countries.join(', ');

    const platforms = item.targeting?.publisher_platforms || [];
    const platformDetail = platforms.length > 0 ? platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') : 'Automático';

    const promoted = item.promotedObject;
    let objectiveDetail = 'N/D';
    if (promoted?.whatsapp_phone_number) objectiveDetail = `WhatsApp (${promoted.whatsapp_phone_number})`;
    else if (promoted?.pixel_id) objectiveDetail = `Pixel (${promoted.custom_event_type || 'Custom Event'})`;
    else if (promoted?.page_id) objectiveDetail = `Page ID (${promoted.page_id})`;

    const ageMin = item.targeting?.age_min || 18;
    const ageMax = item.targeting?.age_max || 65;

    return (
      <div className="space-y-1 pt-2 text-xs">
        <h4 className="font-bold text-slate-300 mb-2">Detalhes do Conjunto</h4>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Anúncios Ativos:</span>
          <span className="font-semibold text-yellow-400">
            {item.activeAdsCount || 0} de {item.totalAds || 0}
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Orçamento Diário:</span>
          <span className="font-semibold text-green-400">{budget}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Localização:</span>
          <span className="font-semibold text-red-400 text-right">{locationDetail}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Plataformas:</span>
          <span className="font-semibold text-sky-400 text-right">{platformDetail}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Idade:</span>
          <span className="font-semibold text-yellow-400">
            {ageMin}-{ageMax} anos
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Promovido:</span>
          <span className="font-semibold text-purple-400 text-right text-[0.7rem]">{objectiveDetail}</span>
        </div>
        <div className="pt-2 text-center text-slate-500 text-[0.7rem] italic">Clique duplo para ver Anúncios</div>
      </div>
    );
  }

  return (
    <div className="space-y-1 pt-2 text-xs">
      <h4 className="font-bold text-slate-300 mb-2">Detalhes do Anúncio</h4>
      <div className="flex justify-between items-center text-slate-300">
        <span className="font-medium text-slate-400">Status:</span>
        <span className="font-semibold text-yellow-400">{item.status || 'N/D'}</span>
      </div>
      <div className="flex justify-between items-center text-slate-300">
        <span className="font-medium text-slate-400">ID:</span>
        <span className="font-semibold text-yellow-400">{item.id}</span>
      </div>
    </div>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
  item: AggregatedItem;
  level: 'campaigns' | 'adsets' | 'ads';
}

// Menu de contexto do botão direito — replica o context-menu flutuante do
// painel legado (posição do cursor, ajustado pra não estourar a viewport),
// com as mesmas 5 ações: ativar/pausar, editar, duplicar, renomear, excluir.
function ContextMenu({
  state,
  onClose,
  onAction,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onAction: (action: 'status-toggle' | 'edit' | 'duplicate' | 'rename' | 'delete') => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { offsetWidth, offsetHeight } = menu;
    let x = state.x;
    let y = state.y;
    if (x + offsetWidth > window.innerWidth) x = window.innerWidth - offsetWidth - 10;
    if (y + offsetHeight > window.innerHeight) y = window.innerHeight - offsetHeight - 10;
    setPos({ x, y });
  }, [state.x, state.y]);

  useEffect(() => {
    const handleOutside = () => onClose();
    document.addEventListener('click', handleOutside);
    document.addEventListener('contextmenu', handleOutside);
    return () => {
      document.removeEventListener('click', handleOutside);
      document.removeEventListener('contextmenu', handleOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemType = ITEM_TYPE_LABEL[state.level];
  const isActive = state.item.status === 'ACTIVE';

  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-2 w-52 z-[130] space-y-1"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onAction('status-toggle')}
        className="flex items-center w-full px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors"
      >
        {isActive ? <Pause className="w-4 h-4 mr-2 text-yellow-400" /> : <Play className="w-4 h-4 mr-2 text-green-400" />}
        {isActive ? 'Pausar' : 'Ativar'} {itemType}
      </button>
      <button
        type="button"
        onClick={() => onAction('edit')}
        className="flex items-center w-full px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors"
      >
        <Edit2 className="w-4 h-4 mr-2 text-sky-400" /> Editar {itemType}
      </button>
      <button
        type="button"
        onClick={() => onAction('duplicate')}
        className="flex items-center w-full px-3 py-2 text-sm text-teal-400 hover:bg-slate-700 rounded-md transition-colors"
      >
        <Copy className="w-4 h-4 mr-2 text-teal-400" /> Duplicar {itemType}
      </button>
      <button
        type="button"
        onClick={() => onAction('rename')}
        className="flex items-center w-full px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors"
      >
        <PenLine className="w-4 h-4 mr-2 text-indigo-400" /> Renomear {itemType}
      </button>
      <button
        type="button"
        onClick={() => onAction('delete')}
        className="flex items-center w-full px-3 py-2 text-sm text-red-400 hover:bg-red-900/50 rounded-md transition-colors border-t border-slate-700 mt-2 pt-2"
      >
        <Trash2 className="w-4 h-4 mr-2" /> Excluir {itemType}
      </button>
    </div>
  );
}

// --- Modais de edição — um componente concreto por nível (nunca um form
// genérico), igual o padrão já usado no resto do projeto (ClientGoalsPage).
// Só nome+status(+orçamento no conjunto) são realmente editados: o
// objetivo da campanha na prática não é mutável pela Graph API depois de
// criada, e editar o criativo do anúncio (imagem/texto) exigiria recriar o
// ad_creative — o endpoint genérico `editar` só faz PATCH direto no nó, não
// está preparado pra esse fluxo. Ver relatório final para mais detalhes.

function EditCampaignModal({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item: AggregatedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('PAUSED');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setStatus(item.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED');
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome da campanha.');
      return;
    }
    setSaving(true);
    try {
      const edicao: Record<string, string> = {};
      if (trimmed !== item.name) edicao.name = trimmed;
      if (status !== item.status) edicao.status = status;
      if (Object.keys(edicao).length === 0) {
        toast('Nenhuma alteração para salvar.');
        onOpenChange(false);
        return;
      }
      await metaAdsManagerService.updateItem('campaign', item.id, edicao);
      toast.success(`Campanha '${trimmed}' editada com sucesso!`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error) || `Erro ao tentar editar a campanha '${item.name}'.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>Editar Campanha</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-slate-400">Nome da Campanha</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-300">Status Ativo</Label>
            <Checkbox checked={status === 'ACTIVE'} onCheckedChange={(checked) => setStatus(checked ? 'ACTIVE' : 'PAUSED')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAdSetModal({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item: AggregatedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('PAUSED');
  const [budget, setBudget] = useState('');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');
  const [savedAudienceName, setSavedAudienceName] = useState('');
  const [detailedTargeting, setDetailedTargeting] = useState('');
  const [geoLocationName, setGeoLocationName] = useState('');
  const [geoRadius, setGeoRadius] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setStatus(item.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED');
      setBudget((parseFloat(item.dailyBudget || '0') / 100).toFixed(2));
      setAgeMin(String(item.targeting?.age_min || 18));
      setAgeMax(String(item.targeting?.age_max || 65));
      setSavedAudienceName('');
      setDetailedTargeting('');
      const geo = item.targeting?.geo_locations;
      const firstCity = geo?.cities?.[0];
      const firstPlace = geo?.places?.[0];
      setGeoLocationName(firstCity?.name || firstPlace?.name || geo?.countries?.join(', ') || '');
      setGeoRadius(String(firstCity?.radius || firstPlace?.radius || ''));
      setPlatforms(item.targeting?.publisher_platforms?.length ? item.targeting.publisher_platforms : ['facebook', 'instagram']);
    }
  }, [item]);

  const togglePlatform = (value: string) =>
    setPlatforms((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));

  const handleSave = async () => {
    if (!item) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome do conjunto.');
      return;
    }
    const budgetValue = parseFloat(budget.replace(',', '.'));
    if (!(budgetValue > 0)) {
      toast.error('Informe um orçamento diário válido.');
      return;
    }
    const ageMinNum = parseInt(ageMin, 10);
    const ageMaxNum = parseInt(ageMax, 10);
    if (ageMinNum > ageMaxNum) {
      toast.error('Idade mínima não pode ser maior que a máxima.');
      return;
    }
    setSaving(true);
    try {
      const edicao: Record<string, string> = {};
      if (trimmed !== item.name) edicao.name = trimmed;
      if (status !== item.status) edicao.status = status;
      const budgetCents = Math.round(budgetValue * 100).toString();
      if (budgetCents !== item.dailyBudget) edicao.daily_budget = budgetCents;

      // `targeting` precisa chegar como STRING JSON (não objeto aninhado) —
      // o helper `update()` do backend faz `set_form_data` direto sem
      // serializar campos aninhados (só os caminhos dedicados de criar/
      // duplicar fazem `.to_json` antes de mandar pra Graph API). Pré-
      // serializando aqui, o valor chega como string e passa incólume pelo
      // `JSON.parse("{...}")` do controller — sem precisar mudar backend.
      const detailedTargetingManual = detailedTargeting
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const radiusNum = parseFloat(geoRadius);
      const targeting: Record<string, unknown> = {
        age_min: ageMinNum,
        age_max: ageMaxNum,
        publisher_platforms: platforms.length > 0 ? platforms : ['facebook', 'instagram'],
      };
      if (savedAudienceName.trim()) targeting.custom_audience_id = savedAudienceName.trim();
      if (detailedTargetingManual.length > 0) targeting.detailed_targeting_manual = detailedTargetingManual;
      if (geoLocationName.trim()) {
        targeting.geo_locations = {
          location_types: ['home', 'recent'],
          cities: [{ name: geoLocationName.trim(), radius: radiusNum > 0 ? radiusNum : 15, distance_unit: 'kilometer' }],
        };
      }
      edicao.targeting = JSON.stringify(targeting);

      if (Object.keys(edicao).length === 0) {
        toast('Nenhuma alteração para salvar.');
        onOpenChange(false);
        return;
      }
      await metaAdsManagerService.updateItem('adset', item.id, edicao);
      toast.success(`Conjunto '${trimmed}' editado com sucesso!`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error) || `Erro ao tentar editar o conjunto '${item.name}'.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Conjunto de Anúncios</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <Label className="text-sm font-medium text-slate-300">Status Ativo</Label>
            <Checkbox checked={status === 'ACTIVE'} onCheckedChange={(checked) => setStatus(checked ? 'ACTIVE' : 'PAUSED')} />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Nome do Conjunto</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
          </div>
          <div className="border-b border-slate-700 pb-4">
            <Label className="text-xs text-slate-400">Orçamento Diário (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={budget}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudget(e.target.value)}
              className="bg-slate-700 border-slate-600 text-slate-200"
            />
          </div>

          <div className="space-y-3 border-b border-slate-700 pb-4">
            <h4 className="text-sm font-semibold text-slate-200">Público Alvo</h4>
            <div>
              <Label className="text-xs text-slate-400">Público Salvo (nome, opcional)</Label>
              <Input
                value={savedAudienceName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSavedAudienceName(e.target.value)}
                placeholder="Em branco para público personalizado"
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-slate-700 pb-4">
            <div>
              <Label className="text-xs text-slate-400">Idade Mínima</Label>
              <Input
                type="number"
                min={13}
                max={65}
                value={ageMin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgeMin(e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Idade Máxima</Label>
              <Input
                type="number"
                min={17}
                max={65}
                value={ageMax}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgeMax(e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
            <div className="flex-grow">
              <Label className="text-xs text-slate-400">Localização (nome da cidade/país)</Label>
              <Input
                value={geoLocationName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGeoLocationName(e.target.value)}
                placeholder="Ex: São Paulo"
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
            <div className="w-24">
              <Label className="text-xs text-slate-400">Raio (km)</Label>
              <Input
                type="number"
                min={1}
                max={80}
                value={geoRadius}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGeoRadius(e.target.value)}
                placeholder="15"
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
          </div>

          <div className="border-b border-slate-700 pb-4">
            <Label className="text-xs text-slate-400">Direcionamento Detalhado (interesses, opcional)</Label>
            <Textarea
              value={detailedTargeting}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDetailedTargeting(e.target.value)}
              rows={2}
              placeholder="Ex: Marketing Digital, Compras Online"
              className="bg-slate-700 border-slate-600 text-slate-200"
            />
          </div>

          <div>
            <Label className="text-xs text-slate-400 block mb-1">Plataformas</Label>
            <div className="flex gap-4">
              {PLATFORM_OPTIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <Checkbox checked={platforms.includes(p.value)} onCheckedChange={() => togglePlatform(p.value)} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAdModal({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item: AggregatedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('PAUSED');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setStatus(item.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED');
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome do anúncio.');
      return;
    }
    setSaving(true);
    try {
      const edicao: Record<string, string> = {};
      if (trimmed !== item.name) edicao.name = trimmed;
      if (status !== item.status) edicao.status = status;
      if (Object.keys(edicao).length === 0) {
        toast('Nenhuma alteração para salvar.');
        onOpenChange(false);
        return;
      }
      await metaAdsManagerService.updateItem('ad', item.id, edicao);
      toast.success(`Anúncio '${trimmed}' editado com sucesso!`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error) || `Erro ao tentar editar o anúncio '${item.name}'.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>Editar Anúncio</DialogTitle>
          <DialogDescription className="text-slate-400">
            Edição de título/texto/criativo do anúncio ainda não está disponível por aqui — use o Gerenciador de Anúncios da Meta para isso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-slate-400">Nome do Anúncio</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-300">Status Ativo</Label>
            <Checkbox checked={status === 'ACTIVE'} onCheckedChange={(checked) => setStatus(checked ? 'ACTIVE' : 'PAUSED')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Renomear reaproveita a mesma ação `editar` (name), num diálogo dedicado —
// mais simples em React do que a flag isRename do modal de duplicar do
// legado, com o mesmo resultado funcional.
function RenameModal({
  item,
  level,
  open,
  onOpenChange,
  onSaved,
}: {
  item: AggregatedItem | null;
  level: 'campaigns' | 'adsets' | 'ads' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) setName(item.name);
  }, [item]);

  const handleSave = async () => {
    if (!item || !level) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o novo nome.');
      return;
    }
    setSaving(true);
    try {
      await metaAdsManagerService.renameItem(LEVEL_TO_META_LEVEL[level], item.id, trimmed);
      toast.success(`${ITEM_TYPE_LABEL[level]} renomeada para '${trimmed}' com sucesso!`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error) || `Erro ao tentar renomear '${item.name}'.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-sm">
        <DialogHeader>
          <DialogTitle>Renomear {level ? ITEM_TYPE_LABEL[level] : ''}</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          className="bg-slate-700 border-slate-600 text-slate-200"
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Renomear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Duplicar sempre recria do zero a partir do público/criativo da origem
// (nunca via /copies da Graph API, que perde configuração ao trocar
// objetivo — mesmo raciocínio documentado em Meta::AdsManagerService).
// Escopo desta versão: duplica dentro da MESMA conta de anúncio (sem os
// seletores em cascata de BM/conta de destino do legado — ver relatório).
// Seletor em cascata do destino (BM -> Conta -> Campanha -> Conjunto),
// igual ao dupLoadAccountsInto/dupLoadCampaignsInto/dupLoadAdsetsInto do
// painel legado — reaproveita os MESMOS serviços já usados no resto da
// página (clientGoalsService/trafficPanelService), sem chamada nova.
function DuplicateModal({
  item,
  level,
  currentBmId,
  adAccountId,
  dateStart,
  dateStop,
  campaigns,
  allAdSets,
  open,
  onOpenChange,
  onSaved,
}: {
  item: AggregatedItem | null;
  level: 'campaigns' | 'adsets' | 'ads' | null;
  currentBmId: string | null;
  adAccountId: string | null;
  dateStart: string;
  dateStop: string;
  campaigns: AggregatedItem[];
  allAdSets: AggregatedItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [newObjectiveKey, setNewObjectiveKey] = useState<ObjectiveKey | ''>('');
  const [saving, setSaving] = useState(false);

  const [targetBms, setTargetBms] = useState<Entity[]>([]);
  const [targetBmId, setTargetBmId] = useState('');
  const [targetAccounts, setTargetAccounts] = useState<TrafficAccount[]>([]);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [targetCampaigns, setTargetCampaigns] = useState<AggregatedItem[]>(campaigns);
  const [targetCampaignId, setTargetCampaignId] = useState('');
  const [targetAdSets, setTargetAdSets] = useState<AggregatedItem[]>(allAdSets);
  const [targetAdSetId, setTargetAdSetId] = useState('');
  const [loadingTargets, setLoadingTargets] = useState(false);

  const loadCampaignsForAccount = async (accountId: string, preselectCampaignId?: string) => {
    if (!accountId) return;
    setLoadingTargets(true);
    try {
      const { structural, insights } = await trafficPanelService.getCampaignsTree(accountId, dateStart, dateStop);
      const fetchedCampaigns = aggregateDataForLevel(structural, insights, 'campaign');
      setTargetCampaigns(fetchedCampaigns);
      const selectedCampaignId = preselectCampaignId || fetchedCampaigns[0]?.id || '';
      setTargetCampaignId(selectedCampaignId);
      if (level === 'ads') {
        const fetchedAdSets = aggregateDataForLevel(structural, insights, 'adset');
        setTargetAdSets(fetchedAdSets);
        setTargetAdSetId(item?.adSetId && accountId === adAccountId ? item.adSetId : fetchedAdSets[0]?.id || '');
      }
    } catch {
      toast.error('Não foi possível carregar as campanhas dessa conta.');
    } finally {
      setLoadingTargets(false);
    }
  };

  const loadAccountsForBm = async (bmId: string, preselectAccountId?: string) => {
    setLoadingTargets(true);
    try {
      const fetchedAccounts = await trafficPanelService.listAccounts(bmId, dateStart, dateStop);
      setTargetAccounts(fetchedAccounts);
      const selectedAccountId = preselectAccountId || fetchedAccounts[0]?.id || '';
      setTargetAccountId(selectedAccountId);
      if (level !== 'campaigns' && selectedAccountId) {
        await loadCampaignsForAccount(selectedAccountId, selectedAccountId === adAccountId ? item?.campaignId : undefined);
      }
    } catch {
      toast.error('Não foi possível carregar as contas dessa Business Manager.');
    } finally {
      setLoadingTargets(false);
    }
  };

  useEffect(() => {
    if (!item || !open) return;
    setName(`${item.name} - Cópia`);
    setNewObjectiveKey('');
    // Pré-seleciona BM/conta/campanha/conjunto atuais — o usuário só mexe
    // nos seletores se quiser duplicar pra outro lugar.
    setTargetCampaigns(campaigns);
    setTargetAdSets(allAdSets);
    setTargetCampaignId(item.campaignId || campaigns[0]?.id || '');
    setTargetAdSetId(item.adSetId || allAdSets[0]?.id || '');
    if (currentBmId) {
      setTargetBmId(currentBmId);
      clientGoalsService
        .listBusinessManagers()
        .then((bms) => setTargetBms(bms))
        .catch(() => toast.error('Não foi possível carregar as Business Managers.'));
    }
    if (adAccountId) setTargetAccountId(adAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, open]);

  const handleTargetBmChange = (bmId: string) => {
    setTargetBmId(bmId);
    loadAccountsForBm(bmId);
  };

  const handleTargetAccountChange = (accountId: string) => {
    setTargetAccountId(accountId);
    if (level !== 'campaigns') loadCampaignsForAccount(accountId);
  };

  const handleTargetCampaignChange = (campaignId: string) => {
    setTargetCampaignId(campaignId);
    if (level === 'ads') loadCampaignsForAccount(targetAccountId, campaignId);
  };

  const handleSave = async () => {
    if (!item || !level) return;
    const effectiveAdAccountId = targetAccountId || adAccountId;
    if (!effectiveAdAccountId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome do novo item.');
      return;
    }
    setSaving(true);
    try {
      if (level === 'campaigns') {
        const objMap = newObjectiveKey ? OBJECTIVE_MAP[newObjectiveKey] : null;
        await metaAdsManagerService.duplicateCampaignWithObjective({
          campaignId: item.id,
          adAccountId: effectiveAdAccountId,
          newName: trimmed,
          newObjective: objMap ? objMap.objective : item.objective || '',
          newOptimizationGoal: objMap?.optimizationGoal,
        });
      } else if (level === 'adsets') {
        if (!targetCampaignId) {
          toast.error('Selecione a campanha de destino.');
          setSaving(false);
          return;
        }
        await metaAdsManagerService.duplicateAdSetToCampaign({
          adSetId: item.id,
          adAccountId: effectiveAdAccountId,
          targetCampaignId,
          newName: trimmed,
        });
      } else {
        if (!targetAdSetId) {
          toast.error('Selecione o conjunto de destino.');
          setSaving(false);
          return;
        }
        await metaAdsManagerService.duplicateAdToAdSet({
          adId: item.id,
          adAccountId: effectiveAdAccountId,
          targetAdSetId,
          newName: trimmed,
        });
      }
      toast.success(`${ITEM_TYPE_LABEL[level]} '${item.name}' duplicada para '${trimmed}' com sucesso!`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error) || `Erro ao tentar duplicar '${item.name}'.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Duplicar {level ? ITEM_TYPE_LABEL[level] : ''}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Recria do zero com o mesmo público e criativo — pode apontar pra qualquer BM/conta/campanha/conjunto que você tenha acesso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-slate-400">Novo nome</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" autoFocus />
          </div>

          {level === 'campaigns' && (
            <div>
              <Label className="text-xs text-slate-400">Novo objetivo (opcional)</Label>
              <Select value={newObjectiveKey} onValueChange={(v) => setNewObjectiveKey(v as ObjectiveKey)}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="Manter o mesmo objetivo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {(Object.keys(OBJECTIVE_MAP) as ObjectiveKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {OBJECTIVE_MAP[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Recria a campanha do zero com o mesmo público e criativo, só trocando o objetivo.</p>
            </div>
          )}

          <div className="space-y-3 border-t border-slate-700 pt-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Duplicar para</p>
            <div>
              <Label className="text-xs text-slate-400">Business Manager</Label>
              <Select value={targetBmId} onValueChange={handleTargetBmChange}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="Selecione a BM" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {targetBms.map((bm) => (
                    <SelectItem key={bm.id} value={bm.id}>
                      {bm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Conta de anúncio</Label>
              <Select value={targetAccountId} onValueChange={handleTargetAccountChange}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {targetAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {level === 'adsets' && (
              <div>
                <Label className="text-xs text-slate-400">Campanha de destino</Label>
                <Select value={targetCampaignId} onValueChange={handleTargetCampaignChange}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                    <SelectValue placeholder="Selecione a campanha" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                    {targetCampaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {level === 'ads' && (
              <>
                <div>
                  <Label className="text-xs text-slate-400">Campanha</Label>
                  <Select value={targetCampaignId} onValueChange={handleTargetCampaignChange}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                      <SelectValue placeholder="Selecione a campanha" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                      {targetCampaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Conjunto de destino</Label>
                  <Select value={targetAdSetId} onValueChange={setTargetAdSetId}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                      <SelectValue placeholder="Selecione o conjunto" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                      {targetAdSets.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {loadingTargets && (
              <p className="text-xs text-slate-500">
                <Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Carregando...
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  item,
  level,
  open,
  onOpenChange,
  onDeleted,
}: {
  item: AggregatedItem | null;
  level: 'campaigns' | 'adsets' | 'ads' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!item || !level) return;
    setDeleting(true);
    try {
      await metaAdsManagerService.deleteItem(LEVEL_TO_META_LEVEL[level], item.id);
      toast.success(`${ITEM_TYPE_LABEL[level]} '${item.name}' arquivada (excluída) com sucesso.`);
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error(apiErrorMessage(error) || `Erro ao tentar excluir '${item.name}'.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar/Excluir {level ? ITEM_TYPE_LABEL[level] : 'Item'}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            Tem certeza que deseja <strong>ARQUIVAR</strong> (excluir logicamente) {level ? ITEM_TYPE_LABEL[level].toLowerCase() : 'este item'} &quot;
            {item?.name}&quot;? Esta ação pode ser irreversível no Meta Ads (Status: ARCHIVED).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting} className="border-slate-600 text-slate-300 bg-transparent">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Arquivar/Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const PLATFORM_OPTIONS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'audience_network', label: 'Audience Network' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let uidSeq = 0;
const nextUid = () => `x${Date.now()}-${uidSeq++}`;

interface LocationEntry {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// Mapa interativo (pin arrastável + raio) via Leaflet — mesma lib e mesmo
// padrão de integração com React (ref callback em vez de useRef+useEffect,
// necessário porque o mapa vive dentro de um Dialog do Radix, que monta/
// desmonta o conteúdo de verdade a cada abertura) já usado em
// RealEstateItemModal.tsx. Busca de endereço via Nominatim (OpenStreetMap),
// mesma API sem chave que o painel legado usava. Cada conjunto de anúncios
// tem sua própria instância, com sua própria lista de localizações.
function LocationMapPicker({ locations, onChange }: { locations: LocationEntry[]; onChange: (locations: LocationEntry[]) => void }) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const extraLayersRef = useRef<L.Layer[]>([]);
  const locationsRef = useRef(locations);
  locationsRef.current = locations;

  const [pin, setPin] = useState({ name: 'São Paulo', lat: -23.5505, lng: -46.6333, radius: 15 });
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);

  const placePin = (map: L.Map, lat: number, lng: number, radius: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setPin((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, name: 'Localização Personalizada (Arrastada)' }));
      });
      markerRef.current = marker;
    }
    if (circleRef.current) map.removeLayer(circleRef.current);
    circleRef.current = L.circle([lat, lng], { radius: radius * 1000, color: '#fbbf24', fillColor: '#fbbf24', fillOpacity: 0.1, weight: 2 }).addTo(map);
  };

  const redrawExtras = (map: L.Map) => {
    extraLayersRef.current.forEach((layer) => map.removeLayer(layer));
    extraLayersRef.current = [];
    locationsRef.current.forEach((loc) => {
      const marker = L.marker([loc.lat, loc.lng], { opacity: 0.6, title: `${loc.name} (${loc.radius}km)` }).addTo(map);
      const circle = L.circle([loc.lat, loc.lng], { radius: loc.radius * 1000, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.08, weight: 1.5 }).addTo(map);
      extraLayersRef.current.push(marker, circle);
    });
  };

  // Ref callback (não useRef+useEffect) — o Dialog do Radix só monta este
  // <div> de verdade quando abre, então é aqui (container != null) que o
  // mapa precisa nascer; a limpeza (container === null) roda no fechamento.
  const initMap = useCallback((container: HTMLDivElement | null) => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    }
    if (!container) return;

    const map = L.map(container).setView([pin.lat, pin.lng], 10);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

    placePin(map, pin.lat, pin.lng, pin.radius);
    redrawExtras(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      setPin((prev) => ({ ...prev, lat: e.latlng.lat, lng: e.latlng.lng, name: 'Localização Personalizada (Clique)' }));
    });

    setTimeout(() => map.invalidateSize(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current) placePin(mapRef.current, pin.lat, pin.lng, pin.radius);
  }, [pin.lat, pin.lng, pin.radius]);

  useEffect(() => {
    if (mapRef.current) redrawExtras(mapRef.current);
  }, [locations]);

  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return undefined;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&countrycodes=BR`;
        const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
        const data = (await response.json()) as NominatimResult[];
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const selectSuggestion = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const displayName = result.display_name.split(',').slice(0, 3).map((s) => s.trim()).join(', ');
    setPin((prev) => ({ ...prev, lat, lng, name: displayName }));
    setSearchQuery(displayName);
    setSuggestions([]);
  };

  const addLocation = () => {
    if (!(pin.radius > 0)) {
      toast.error('Informe um raio maior que 0.');
      return;
    }
    const isDuplicate = locations.some((loc) => loc.name === pin.name && loc.radius === pin.radius);
    if (isDuplicate) {
      toast.error('Esta localização com o mesmo raio já foi adicionada.');
      return;
    }
    onChange([...locations, { id: nextUid(), name: pin.name, lat: pin.lat, lng: pin.lng, radius: pin.radius }]);
  };

  const removeLocation = (id: string) => onChange(locations.filter((loc) => loc.id !== id));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          placeholder="Buscar cidade, CEP ou endereço..."
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
        {suggestions.length > 0 && (
          <div className="absolute w-full z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
            {suggestions.map((s, i) => (
              <div
                key={i}
                onClick={() => selectSuggestion(s)}
                className="p-3 cursor-pointer hover:bg-sky-700/50 transition-colors text-sm border-b border-slate-700 last:border-b-0 truncate text-slate-200"
              >
                {s.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs text-slate-400">Raio de Cobertura (km)</Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={80}
            step={1}
            value={pin.radius}
            onChange={(e) => setPin((prev) => ({ ...prev, radius: parseInt(e.target.value, 10) }))}
            className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-sky-400 font-semibold w-14 text-right">{pin.radius} km</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Input value={pin.name} readOnly className="bg-slate-700 text-slate-400 border-slate-600 text-sm flex-grow" />
        <Button type="button" onClick={addLocation} size="sm" className="shrink-0">
          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2 max-h-32 overflow-y-auto border border-slate-700 p-2 rounded-lg bg-slate-900/50">
        {locations.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center">Nenhuma localização adicionada.</p>
        ) : (
          locations.map((loc) => (
            <div key={loc.id} className="flex items-center justify-between p-2 text-sm bg-slate-700/70 rounded-md border border-slate-600">
              <div className="truncate pr-2">
                <span className="font-semibold text-sky-300">{loc.name}</span> <span className="text-xs text-slate-400">({loc.radius} km)</span>
              </div>
              <button type="button" onClick={() => removeLocation(loc.id)} className="text-red-400 hover:text-red-300 p-1 shrink-0" title="Remover">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {searching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}

      <div ref={initMap} className="w-full h-56 bg-slate-700 rounded-lg border border-slate-600 shadow-inner" />
    </div>
  );
}

interface AdFormState {
  key: string;
  name: string;
  title: string;
  body: string;
  mediaFile: File | null;
}

interface AdSetFormState {
  key: string;
  name: string;
  budget: string;
  ageMin: string;
  ageMax: string;
  platforms: string[];
  savedAudienceName: string;
  detailedTargeting: string;
  locations: LocationEntry[];
  ads: AdFormState[];
}

function newAd(): AdFormState {
  return { key: nextUid(), name: '', title: '', body: '', mediaFile: null };
}

function newAdSet(): AdSetFormState {
  return {
    key: nextUid(),
    name: '',
    budget: '100.00',
    ageMin: '25',
    ageMax: '65',
    platforms: ['facebook', 'instagram'],
    savedAudienceName: '',
    detailedTargeting: '',
    locations: [{ id: nextUid(), name: 'São Paulo', lat: -23.5505, lng: -46.6333, radius: 15 }],
    ads: [newAd()],
  };
}

// Bloco de UM anúncio dentro de um conjunto — nome/título/texto/mídia.
function AdBlock({ ad, onChange, onRemove, removable }: { ad: AdFormState; onChange: (patch: Partial<AdFormState>) => void; onRemove: () => void; removable: boolean }) {
  return (
    <div className="space-y-3 p-3 border border-slate-700/70 rounded-lg bg-slate-900/30">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-400">Nome do Anúncio</Label>
        {removable && (
          <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-300" title="Remover anúncio">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <Input
        value={ad.name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ name: e.target.value })}
        placeholder="Ex: Ad 01 - Criativo Oferta"
        className="bg-slate-700 border-slate-600 text-slate-200"
      />
      <div>
        <Label className="text-xs text-slate-400">Título (Headline)</Label>
        <Input
          value={ad.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ title: e.target.value })}
          placeholder="Ex: Compre Agora e Ganhe Desconto!"
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-400">Texto Principal</Label>
        <Textarea
          value={ad.body}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ body: e.target.value })}
          rows={2}
          placeholder="Use gatilhos de escassez e urgência."
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-400 block mb-1">Mídia (imagem ou vídeo)</Label>
        <label className="flex items-center gap-2 text-sm text-sky-300 cursor-pointer hover:text-sky-200">
          <ImagePlus className="w-4 h-4" />
          {ad.mediaFile ? ad.mediaFile.name : 'Selecionar arquivo'}
          <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onChange({ mediaFile: e.target.files?.[0] || null })} />
        </label>
      </div>
    </div>
  );
}

// Bloco de UM conjunto de anúncios — nome/orçamento/público/idade/mapa +
// seus anúncios (1 ou mais). O "Duplicar Conjunto"/"Duplicar Anúncio" do
// legado viram, aqui, "Adicionar Conjunto" (na barra de ações do modal) e
// "Adicionar Anúncio" (dentro de cada conjunto).
function AdSetBlock({
  adSet,
  index,
  onChange,
  onRemove,
  removable,
}: {
  adSet: AdSetFormState;
  index: number;
  onChange: (patch: Partial<AdSetFormState>) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const togglePlatform = (value: string) =>
    onChange({ platforms: adSet.platforms.includes(value) ? adSet.platforms.filter((p) => p !== value) : [...adSet.platforms, value] });

  const updateAd = (adKey: string, patch: Partial<AdFormState>) =>
    onChange({ ads: adSet.ads.map((a) => (a.key === adKey ? { ...a, ...patch } : a)) });
  const addAd = () => onChange({ ads: [...adSet.ads, newAd()] });
  const removeAd = (adKey: string) => onChange({ ads: adSet.ads.filter((a) => a.key !== adKey) });

  return (
    <section className="space-y-4 p-4 border border-slate-700 rounded-lg">
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <h4 className="text-lg font-bold text-teal-400">Conjunto {index + 1}</h4>
        {removable && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-red-400 hover:text-red-300 hover:bg-red-900/30">
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover Conjunto
          </Button>
        )}
      </div>
      <div>
        <Label className="text-xs text-slate-400">Nome do Conjunto</Label>
        <Input
          value={adSet.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ name: e.target.value })}
          placeholder="Ex: Idade 25-45 - SP Capital"
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-400">Orçamento Diário (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={adSet.budget}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ budget: e.target.value })}
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-400">Público Salvo (nome, opcional)</Label>
        <Input
          value={adSet.savedAudienceName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ savedAudienceName: e.target.value })}
          placeholder="Em branco para usar segmentação detalhada"
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-400">Direcionamento Detalhado (interesses, opcional)</Label>
        <Textarea
          value={adSet.detailedTargeting}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ detailedTargeting: e.target.value })}
          rows={2}
          placeholder="Ex: Marketing Digital, Compras Online"
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-slate-400">Idade Mínima</Label>
          <Input
            type="number"
            min={13}
            max={65}
            value={adSet.ageMin}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ageMin: e.target.value })}
            className="bg-slate-700 border-slate-600 text-slate-200"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-400">Idade Máxima</Label>
          <Input
            type="number"
            min={17}
            max={65}
            value={adSet.ageMax}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ageMax: e.target.value })}
            className="bg-slate-700 border-slate-600 text-slate-200"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs text-slate-400 block mb-2">Segmentação Geográfica (mapa)</Label>
        <LocationMapPicker locations={adSet.locations} onChange={(locations) => onChange({ locations })} />
      </div>
      <div>
        <Label className="text-xs text-slate-400 block mb-1">Plataformas</Label>
        <div className="flex gap-4">
          {PLATFORM_OPTIONS.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <Checkbox checked={adSet.platforms.includes(p.value)} onCheckedChange={() => togglePlatform(p.value)} />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-700 pt-4">
        <h5 className="text-sm font-semibold text-yellow-400">Anúncios deste conjunto</h5>
        {adSet.ads.map((ad) => (
          <AdBlock key={ad.key} ad={ad} onChange={(patch) => updateAd(ad.key, patch)} onRemove={() => removeAd(ad.key)} removable={adSet.ads.length > 1} />
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addAd} className="border-slate-600 text-teal-400 hover:bg-slate-700">
          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Anúncio
        </Button>
      </div>
    </section>
  );
}

function CreateCampaignModal({
  open,
  onOpenChange,
  adAccountId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adAccountId: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('PAUSED');
  const [objectiveKey, setObjectiveKey] = useState<ObjectiveKey>('messages');
  const [link, setLink] = useState('');
  const [adSets, setAdSets] = useState<AdSetFormState[]>(() => [newAdSet()]);

  const [saving, setSaving] = useState(false);

  const objectiveMeta = OBJECTIVE_MAP[objectiveKey];

  // Reseta pro estado inicial (1 conjunto + 1 anúncio) toda vez que o modal
  // abre — mesmo comportamento do showCreateCampaignModal do legado.
  useEffect(() => {
    if (open) {
      setName('');
      setStatus('PAUSED');
      setObjectiveKey('messages');
      setLink('');
      setAdSets([newAdSet()]);
    }
  }, [open]);

  const updateAdSet = (key: string, patch: Partial<AdSetFormState>) =>
    setAdSets((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  const addAdSet = () => setAdSets((prev) => [...prev, newAdSet()]);
  const removeAdSet = (key: string) => setAdSets((prev) => prev.filter((a) => a.key !== key));

  const handleCreate = async () => {
    if (!adAccountId) {
      toast.error('Selecione uma conta de anúncio primeiro para criar uma campanha.');
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Preencha o Nome da Campanha.');
      return;
    }

    for (const adSet of adSets) {
      const trimmedAdSetName = adSet.name.trim();
      const budgetValue = parseFloat(adSet.budget.replace(',', '.'));
      if (!trimmedAdSetName || !(budgetValue > 0)) {
        toast.error(`Preencha o Nome e o Orçamento Diário do conjunto "${trimmedAdSetName || adSet.name}".`);
        return;
      }
      const ageMinNum = parseInt(adSet.ageMin, 10);
      const ageMaxNum = parseInt(adSet.ageMax, 10);
      if (ageMinNum > ageMaxNum) {
        toast.error(`Idade mínima não pode ser maior que a máxima (conjunto "${trimmedAdSetName}").`);
        return;
      }
      if (adSet.locations.length === 0) {
        toast.error(`Adicione pelo menos uma localização geográfica no conjunto "${trimmedAdSetName}".`);
        return;
      }
      for (const ad of adSet.ads) {
        if (!ad.name.trim()) {
          toast.error(`Preencha o Nome do Anúncio (conjunto "${trimmedAdSetName}").`);
          return;
        }
        if (!ad.mediaFile) {
          toast.error(`Carregue uma imagem ou vídeo pro anúncio "${ad.name}" (conjunto "${trimmedAdSetName}").`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const adsetsPayload = await Promise.all(
        adSets.map(async (adSet) => {
          const budgetValue = parseFloat(adSet.budget.replace(',', '.'));
          const detailedTargetingManual = adSet.detailedTargeting
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          const geoCities = adSet.locations.map((loc) => ({
            key: 'custom_location_pin',
            name: loc.name,
            radius: loc.radius,
            distance_unit: 'kilometer',
            latitude: loc.lat,
            longitude: loc.lng,
          }));

          const adsPayload = await Promise.all(
            adSet.ads.map(async (ad) => ({
              ad_name: ad.name.trim(),
              ad_status: status,
              title: ad.title.trim() || undefined,
              body: ad.body.trim() || undefined,
              asset_base64: await fileToBase64(ad.mediaFile as File),
              asset_mimetype: (ad.mediaFile as File).type || 'image/jpeg',
            })),
          );

          return {
            adset_name: adSet.name.trim(),
            adset_status: status,
            daily_budget: Math.round(budgetValue * 100).toString(),
            optimization_goal: objectiveMeta.optimizationGoal,
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            targeting: {
              age_min: parseInt(adSet.ageMin, 10),
              age_max: parseInt(adSet.ageMax, 10),
              publisher_platforms: adSet.platforms.length > 0 ? adSet.platforms : ['facebook', 'instagram'],
              custom_audience_id: adSet.savedAudienceName.trim() || undefined,
              detailed_targeting_manual: detailedTargetingManual.length > 0 ? detailedTargetingManual : undefined,
              geo_locations: {
                location_types: ['home', 'recent'],
                // `cities` aqui carrega os pins do mapa (key=custom_location_pin) —
                // o backend (Meta::AdsManagerService#normalize_geo) converte pra
                // geo_locations.custom_locations no formato real da Graph API.
                cities: geoCities,
              },
            },
            ads: adsPayload,
          };
        }),
      );

      const campanha: CreateCampaignPayload = {
        name: trimmedName,
        status,
        objective: objectiveMeta.objective,
        link: objectiveMeta.needsLink ? link.trim() || undefined : undefined,
        adsets: adsetsPayload,
      };

      await metaAdsManagerService.createCampaign(adAccountId, campanha);
      toast.success(`Campanha '${trimmedName}' criada e publicada com sucesso!`);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(apiErrorMessage(error) || `Erro ao tentar criar a campanha '${trimmedName}'.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Estrutura de Campanha</DialogTitle>
        </DialogHeader>

        <div className="space-y-8 py-2">
          <section className="space-y-4 p-4 border border-slate-700 rounded-lg">
            <h4 className="text-lg font-bold text-sky-400 border-b border-slate-700 pb-2">Campanha</h4>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-300">Status Ativo</Label>
              <Checkbox checked={status === 'ACTIVE'} onCheckedChange={(checked) => setStatus(checked ? 'ACTIVE' : 'PAUSED')} />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Nome da Campanha</Label>
              <Input
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Ex: CBO - Vendas WhatsApp - Verão"
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Objetivo</Label>
              <Select value={objectiveKey} onValueChange={(v) => setObjectiveKey(v as ObjectiveKey)}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {(Object.keys(OBJECTIVE_MAP) as ObjectiveKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {OBJECTIVE_MAP[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {objectiveMeta.needsLink && (
              <div>
                <Label className="text-xs text-slate-400">Link de Destino (URL do site)</Label>
                <Input
                  type="url"
                  value={link}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLink(e.target.value)}
                  placeholder="https://seusite.com.br"
                  className="bg-slate-700 border-slate-600 text-slate-200"
                />
              </div>
            )}
          </section>

          {adSets.map((adSet, index) => (
            <AdSetBlock
              key={adSet.key}
              adSet={adSet}
              index={index}
              onChange={(patch) => updateAdSet(adSet.key, patch)}
              onRemove={() => removeAdSet(adSet.key)}
              removable={adSets.length > 1}
            />
          ))}

          <Button type="button" variant="outline" onClick={addAdSet} className="border-slate-600 text-teal-400 hover:bg-slate-700 w-full">
            <Plus className="w-4 h-4 mr-2" /> Adicionar Conjunto de Anúncios
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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

  // Clique único (detalhes no lugar) vs duplo clique (navegar) — só um card
  // expandido por vez, igual o legado.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const [editTarget, setEditTarget] = useState<{ item: AggregatedItem; level: 'campaigns' | 'adsets' | 'ads' } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ item: AggregatedItem; level: 'campaigns' | 'adsets' | 'ads' } | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<{ item: AggregatedItem; level: 'campaigns' | 'adsets' | 'ads' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ item: AggregatedItem; level: 'campaigns' | 'adsets' | 'ads' } | null>(null);
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);

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
    setExpandedId(null);
    loadTree(account.id);
  };

  const refreshTree = () => {
    if (selectedAccount) loadTree(selectedAccount.id);
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
  // Todos os conjuntos da conta (não só os da campanha aberta) — usado como
  // lista de destino ao duplicar um anúncio pra outro conjunto.
  const allAdSets = useMemo(() => aggregateDataForLevel(treeStructural, treeInsights, 'adset'), [treeStructural, treeInsights]);

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
    setExpandedId(null);
  };
  const openAdSet = (adSet: AggregatedItem) => {
    setAdSetId(adSet.id);
    setLevel('ads');
    setQuery('');
    setExpandedId(null);
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
    setExpandedId(null);
  };

  const toggleExpanded = (itemId: string) => setExpandedId((prev) => (prev === itemId ? null : itemId));

  const openContextMenu = (e: React.MouseEvent, item: AggregatedItem, itemLevel: 'campaigns' | 'adsets' | 'ads') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item, level: itemLevel });
  };

  const handleContextMenuAction = (action: 'status-toggle' | 'edit' | 'duplicate' | 'rename' | 'delete') => {
    if (!contextMenu) return;
    const { item, level: itemLevel } = contextMenu;
    setContextMenu(null);

    if (action === 'status-toggle') {
      const newStatus = item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      const itemType = ITEM_TYPE_LABEL[itemLevel];
      metaAdsManagerService
        .toggleStatus(LEVEL_TO_META_LEVEL[itemLevel], item.id, newStatus)
        .then(() => {
          toast.success(`${itemType} '${item.name}' foi ${newStatus === 'ACTIVE' ? 'ativada' : 'pausada'} com sucesso!`);
          refreshTree();
        })
        .catch((error) => toast.error(apiErrorMessage(error) || `Erro ao tentar mudar o status de '${item.name}'.`));
      return;
    }
    if (action === 'edit') setEditTarget({ item, level: itemLevel });
    else if (action === 'duplicate') setDuplicateTarget({ item, level: itemLevel });
    else if (action === 'rename') setRenameTarget({ item, level: itemLevel });
    else if (action === 'delete') setDeleteTarget({ item, level: itemLevel });
  };

  const openCreateCampaignModal = () => {
    if (!selectedAccount) {
      toast.error('Selecione uma conta de anúncio primeiro para criar uma campanha.');
      return;
    }
    setCreateCampaignOpen(true);
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
      <BaseHeader
        title="Painel Tráfego"
        subtitle="Contas, campanhas, conjuntos e anúncios direto na Meta Ads."
        primaryAction={{
          label: 'Criar Campanha',
          icon: <Plus className="w-4 h-4" />,
          onClick: openCreateCampaignModal,
        }}
      />

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
                  const isExpanded = expandedId === item.id;
                  const drillDown = () => (level === 'campaigns' ? openCampaign(item) : openAdSet(item));
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        // e.detail === 1 isola o primeiro clique de um clique
                        // duplo (que dispara click com detail=1, depois
                        // detail=2, e só então dblclick) — mesmo truque do
                        // painel legado, sem precisar de debounce manual.
                        if (e.detail === 1) toggleExpanded(item.id);
                      }}
                      onDoubleClick={canDrill ? drillDown : undefined}
                      onContextMenu={(e) => openContextMenu(e, item, level)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canDrill) drillDown();
                      }}
                      className={`${cardBaseClass} ${cardInteractiveClass}`}
                    >
                      <div className="flex items-start justify-between mb-2 pb-1 border-b border-slate-700">
                        <h3 className={`text-sm font-bold line-clamp-2 leading-tight pr-1 ${LEVEL_TITLE_COLOR[level]}`} title={item.name}>
                          {item.name}
                        </h3>
                        <StatusDot status={item.status} />
                      </div>
                      {isExpanded ? (
                        <CardDetails item={item} level={level} />
                      ) : (
                        <div className="space-y-1 pt-2">
                          {METRIC_ORDER.filter((k) => k !== 'balance').map((key) => (
                            <MetricRow key={key} metricKey={key} value={values[key] ?? 0} visible={visibility[key]} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {contextMenu && <ContextMenu state={contextMenu} onClose={() => setContextMenu(null)} onAction={handleContextMenuAction} />}

      <EditCampaignModal
        item={editTarget?.level === 'campaigns' ? editTarget.item : null}
        open={editTarget?.level === 'campaigns'}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={refreshTree}
      />
      <EditAdSetModal
        item={editTarget?.level === 'adsets' ? editTarget.item : null}
        open={editTarget?.level === 'adsets'}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={refreshTree}
      />
      <EditAdModal
        item={editTarget?.level === 'ads' ? editTarget.item : null}
        open={editTarget?.level === 'ads'}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={refreshTree}
      />

      <RenameModal
        item={renameTarget?.item || null}
        level={renameTarget?.level || null}
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        onSaved={refreshTree}
      />

      <DuplicateModal
        item={duplicateTarget?.item || null}
        level={duplicateTarget?.level || null}
        currentBmId={selectedBm?.id || null}
        adAccountId={selectedAccount?.id || null}
        dateStart={dateStart}
        dateStop={dateStop}
        campaigns={campaigns}
        allAdSets={allAdSets}
        open={!!duplicateTarget}
        onOpenChange={(open) => !open && setDuplicateTarget(null)}
        onSaved={refreshTree}
      />

      <DeleteConfirmDialog
        item={deleteTarget?.item || null}
        level={deleteTarget?.level || null}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onDeleted={refreshTree}
      />

      <CreateCampaignModal
        open={createCampaignOpen}
        onOpenChange={setCreateCampaignOpen}
        adAccountId={selectedAccount?.id || null}
        onCreated={refreshTree}
      />
    </div>
  );
}
