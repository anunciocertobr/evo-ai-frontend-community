import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import {
  AdSetBudgetFields,
  AdSetDescriptionField,
  AdSetMetaFields,
  AdSetPlatformPositionsFields,
  BudgetMode,
} from '@/components/marketing/AdSetMetaFields';
import {
  AdAccountPageOption,
  AdSetMetaValues,
  AGE_RANGES,
  ageRangeFor,
  ConversaoTipo,
  conversaoTiposFor,
  emptyAdSetMeta,
  FACEBOOK_POSITION_OPTIONS,
  INSTAGRAM_POSITION_OPTIONS,
  optimizationGoalFor,
  pendingWhatsappValidation,
  PLATFORM_OPTIONS,
} from '@/components/marketing/adSetMetaOptions';
import { AudienceCreateDialog } from '@/components/marketing/AudienceCreateDialog';
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
  Building2,
  ChevronLeft,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  ImagePlus,
  Images,
  Loader2,
  MousePointerClick,
  Pause,
  PlayCircle,
  PenLine,
  Play,
  Plus,
  Search,
  Settings2,
  Trash2,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import { trafficPanelService, type TrafficAccount } from '@/services/marketing/trafficPanelService';
import {
  DEFAULT_OBJECTIVE,
  metaAdsManagerService,
  OBJECTIVE_BY_KEY,
  OBJECTIVES,
  objectiveKeyForValue,
  type ObjectiveKey,
  type CreateCampaignPayload,
  type MetaLevel,
  type CreativeDetails,
  type WhatsappNumberOption,
} from '@/services/marketing/metaAdsManagerService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { metaCreationService, type SavedAudience, type TargetingItem } from '@/services/marketing/metaCreationService';
import { MediaLibraryPickerDialog } from '@/components/marketing/MediaLibraryPickerDialog';
import {
  aggregateDataForLevel,
  sortAggregatedItems,
  type AggregatedItem,
  type StructuralAd,
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

// null = tem saldo mas sem gasto nos últimos 30 dias (não dá pra projetar);
// 0 = sem saldo; >0 = dias estimados.
function computeDaysLeft(account: TrafficAccount): number | null {
  const balance = parseFloat(account.balance || '0');
  const periodSpend = parseFloat(account.insights_30d?.[0]?.spend || '0');
  const dailySpend = periodSpend / DAYS_LEFT_SPEND_WINDOW;
  if (!(balance > 0)) return 0;
  if (!(dailySpend > 0)) return null;
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
    let radiusDetail = 'N/D';
    if (geo?.cities?.length) {
      const city = geo.cities[0];
      locationDetail = city.name || 'N/D';
      radiusDetail = city.radius ? `${city.radius} ${city.distance_unit === 'kilometer' ? 'km' : 'mi'}` : 'N/D';
    } else if (geo?.places?.length) {
      const place = geo.places[0];
      locationDetail = place.name || 'N/D';
      radiusDetail = place.radius ? `${place.radius} ${place.distance_unit === 'kilometer' ? 'km' : 'mi'}` : 'N/D';
    } else if (geo?.countries?.length) {
      locationDetail = geo.countries.join(', ');
      radiusDetail = 'País Completo';
    }

    const platforms = item.targeting?.publisher_platforms || [];
    const platformDetail = platforms.length > 0 ? platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') : 'Automático';

    const positions: string[] = [];
    if (item.targeting?.facebook_positions?.length) positions.push(`FB: ${item.targeting.facebook_positions.join(', ')}`);
    if (item.targeting?.instagram_positions?.length) positions.push(`IG: ${item.targeting.instagram_positions.join(', ')}`);
    const placementDetail = positions.length > 0 ? positions.join(', ') : 'Automático / N/D';

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
          <span className="font-medium text-slate-400">Raio:</span>
          <span className="font-semibold text-red-400 text-right">{radiusDetail}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Plataformas:</span>
          <span className="font-semibold text-sky-400 text-right">{platformDetail}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium text-slate-400">Posicionamentos:</span>
          <span className="font-semibold text-indigo-400 text-right text-[0.65rem] leading-tight max-w-[50%] line-clamp-2">{placementDetail}</span>
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
      <div className="pt-2 text-center text-slate-500 text-[0.7rem] italic">Clique duplo para ver Criativo</div>
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
      toast.error(apiErrorMessage(error, true) || `Erro ao tentar editar a campanha '${item.name}'.`);
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
  adAccountId,
  onOpenChange,
  onSaved,
}: {
  item: AggregatedItem | null;
  open: boolean;
  adAccountId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('PAUSED');
  const [budget, setBudget] = useState('');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');
  const [savedAudience, setSavedAudience] = useState<SavedAudience | null>(null);
  const [savedAudiences, setSavedAudiences] = useState<SavedAudience[] | null>(null);
  const [loadingSavedAudiences, setLoadingSavedAudiences] = useState(false);
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
      setSavedAudience(null);
      setDetailedTargeting('');
      const geo = item.targeting?.geo_locations;
      const firstCity = geo?.cities?.[0];
      const firstPlace = geo?.places?.[0];
      setGeoLocationName(firstCity?.name || firstPlace?.name || geo?.countries?.join(', ') || '');
      setGeoRadius(String(firstCity?.radius || firstPlace?.radius || ''));
      setPlatforms(item.targeting?.publisher_platforms?.length ? item.targeting.publisher_platforms : ['facebook', 'instagram']);
    }
  }, [item]);

  // Puxa os públicos salvos direto da Meta (mesmos criados na aba
  // Direcionamento) pra o seletor de público salvo deste conjunto.
  useEffect(() => {
    if (!open || !adAccountId) return;
    setLoadingSavedAudiences(true);
    metaCreationService
      .listSavedAudiences(adAccountId)
      .then(setSavedAudiences)
      .catch(() => toast.error('Erro ao carregar públicos salvos da Meta'))
      .finally(() => setLoadingSavedAudiences(false));
  }, [open, adAccountId]);

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
      // Público salvo selecionado da Meta: aplica o direcionamento inteiro
      // que está salvo lá (a Graph API não tem campo de "referência" a
      // público salvo num adset — o adset recebe o targeting expandido).
      // Só as plataformas continuam vindo do formulário.
      const targeting: Record<string, unknown> = savedAudience?.targeting
        ? {
            ...savedAudience.targeting,
            publisher_platforms: platforms.length > 0 ? platforms : ['facebook', 'instagram'],
          }
        : {
            age_min: ageMinNum,
            age_max: ageMaxNum,
            publisher_platforms: platforms.length > 0 ? platforms : ['facebook', 'instagram'],
          };
      if (!savedAudience?.targeting) {
        const manualTargeting = targeting as Record<string, unknown>;
        if (detailedTargetingManual.length > 0) manualTargeting.detailed_targeting_manual = detailedTargetingManual;
        if (geoLocationName.trim()) {
          manualTargeting.geo_locations = {
            location_types: ['home', 'recent'],
            cities: [{ name: geoLocationName.trim(), radius: radiusNum > 0 ? radiusNum : 15, distance_unit: 'kilometer' }],
          };
        }
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
      toast.error(apiErrorMessage(error, true) || `Erro ao tentar editar o conjunto '${item.name}'.`);
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
              <Label className="text-xs text-slate-400">Público Salvo (da Meta)</Label>
              <Select
                value={savedAudience?.id ?? '__none__'}
                onValueChange={(v: string) =>
                  setSavedAudience(v === '__none__' ? null : (savedAudiences?.find((s) => s.id === v) ?? null))
                }
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder={loadingSavedAudiences ? 'Carregando públicos da Meta...' : 'Nenhum (público personalizado)'} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  <SelectItem value="__none__">Nenhum (público personalizado)</SelectItem>
                  {savedAudiences?.map((sa) => (
                    <SelectItem key={sa.id} value={sa.id}>
                      {sa.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {savedAudience && (
                <p className="text-xs text-slate-500 mt-1">
                  Usando o público salvo na Meta — idade, localização e interesses abaixo são ignorados.
                </p>
              )}
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
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isVideo = !!item?.adCreative?.video_id;

  useEffect(() => {
    if (item) {
      setName(item.name);
      setStatus(item.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED');
      setTitle(item.adCreative?.title || '');
      setBody(item.adCreative?.body || '');
      setNewImageFile(null);
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

      const creativeEdit: Record<string, string> = {};
      if (body.trim() !== (item.adCreative?.body || '')) creativeEdit.body = body.trim();
      if (title.trim() !== (item.adCreative?.title || '')) creativeEdit.title = title.trim();
      if (newImageFile) {
        creativeEdit.asset_base64 = await fileToBase64(newImageFile);
        creativeEdit.asset_mimetype = newImageFile.type;
      }
      if (Object.keys(creativeEdit).length > 0) edicao.ad_creative = JSON.stringify(creativeEdit);

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
      toast.error(apiErrorMessage(error, true) || `Erro ao tentar editar o anúncio '${item.name}'.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Anúncio</DialogTitle>
          <DialogDescription className="text-slate-400">
            Trocar o criativo cria um novo criativo na Meta e aponta o anúncio pra ele — o anterior continua existindo, só deixa de ser usado.
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
          <div>
            <Label className="text-xs text-slate-400">Título</Label>
            <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Texto (corpo do anúncio)</Label>
            <Textarea value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} rows={3} className="bg-slate-700 border-slate-600 text-slate-200" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Imagem</Label>
            {isVideo ? (
              <p className="text-xs text-amber-400 mt-1">Este anúncio usa vídeo — trocar o vídeo não é suportado por aqui.</p>
            ) : (
              <>
                {item?.adCreative?.image_url && !newImageFile && (
                  <img src={item.adCreative.image_url} alt="Criativo atual" className="w-24 h-24 object-cover rounded-md border border-slate-600 mt-1 mb-2" />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                  className="bg-slate-700 border-slate-600 text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="flex items-center gap-2 text-sm text-teal-300 hover:text-teal-200 mt-2"
                >
                  <Images className="w-4 h-4" /> Escolher da biblioteca
                </button>
                {newImageFile && <p className="text-xs text-slate-400 mt-1">Nova imagem: {newImageFile.name}</p>}
                <MediaLibraryPickerDialog
                  open={libraryOpen}
                  onOpenChange={setLibraryOpen}
                  onPick={(file) => {
                    if (file.type.startsWith('image/')) setNewImageFile(file);
                    else toast.error('Trocar o criativo por vídeo não é suportado — escolha uma imagem.');
                  }}
                />
              </>
            )}
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
      toast.error(apiErrorMessage(error, true) || `Erro ao tentar renomear '${item.name}'.`);
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
  structural,
  open,
  onOpenChange,
  onSaved,
  onAvancarParaCriacao,
}: {
  item: AggregatedItem | null;
  level: 'campaigns' | 'adsets' | 'ads' | null;
  currentBmId: string | null;
  adAccountId: string | null;
  dateStart: string;
  dateStop: string;
  campaigns: AggregatedItem[];
  allAdSets: AggregatedItem[];
  structural: StructuralCampaign[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  // "Avançar" da tela de duplicar campanha: abre a tela de criação já
  // preenchida com a campanha de origem.
  onAvancarParaCriacao: (prefill: CampaignPrefill) => void;
}) {
  const [conversaoEscolhida, setConversaoEscolhida] = useState<ConversaoTipo>('NENHUMA');
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

  // Campos do nível do conjunto na cópia: a duplicação reusa o público e o
  // criativo da origem, mas o destino (página/conversa/conversão) e o
  // orçamento são escolhidos aqui — senão a cópia sai na página/destino da
  // campanha original e a Meta recusa com incompatibilidade de criativo.
  const [pages, setPages] = useState<AdAccountPageOption[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [metaValues, setMetaValues] = useState<AdSetMetaValues>(() => emptyAdSetMeta());
  const [budgetOverride, setBudgetOverride] = useState('');
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('DIARIO');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  // Números de WhatsApp que a conta já usa na página escolhida — vêm do
  // backend (que lê os promoted_object dos conjuntos da própria conta, porque
  // a WABA não é legível pelo token de página).
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsappNumberOption[]>([]);
  const [loadingWhatsappNumbers, setLoadingWhatsappNumbers] = useState(false);

  // Objetivo usado para decidir quais campos de conjunto aparecem: o novo, se
  // a pessoa escolheu, senão o da campanha de origem.
  const objetivoDoDup: ObjectiveKey = newObjectiveKey || objectiveKeyForValue(item?.objective);

  useEffect(() => {
    if (!open || !targetAccountId) return;
    setLoadingPages(true);
    metaAdsManagerService
      .listPages(targetAccountId)
      .then((lista) =>
        setPages(lista.map((p) => ({ id: p.id, name: p.name, hasInstagram: Boolean(p.instagram_business_account?.id) }))),
      )
      .catch(() => toast.error('Erro ao carregar as páginas da conta de anúncios'))
      .finally(() => setLoadingPages(false));
  }, [open, targetAccountId]);

  // Números de WhatsApp da conta para a página escolhida. Sem isso o campo
  // "Onde a conversa acontece" obriga a digitar o número de cabeça.
  useEffect(() => {
    const conta = targetAccountId || adAccountId;
    if (!open || !metaValues.pageId || !conta) {
      setWhatsappNumbers([]);
      return;
    }
    let cancelado = false;
    setLoadingWhatsappNumbers(true);
    metaAdsManagerService
      .listWhatsappNumbers(conta, metaValues.pageId)
      .then((lista) => {
        if (cancelado) return;
        setWhatsappNumbers(lista);
        // Já vem preenchido quando a origem usava aquele número.
        if (!metaValues.whatsappPhone && lista.length === 1) {
          setMetaValues((prev) => ({ ...prev, whatsappPhone: lista[0].phone_number }));
        }
      })
      .catch(() => {
        if (!cancelado) setWhatsappNumbers([]);
      })
      .finally(() => {
        if (!cancelado) setLoadingWhatsappNumbers(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, metaValues.pageId, targetAccountId, adAccountId]);

  useEffect(() => {
    if (!item || !open) return;
    setName(`${item.name} - Cópia`);
    setNewObjectiveKey('');
    setBudgetMode('DIARIO');
    setEndDate('');
    setDescription(item.description || '');
    // Pré-seleciona a página/conversa/número que JÁ estão na campanha de origem:
    // o usuário reclamou de ter que escolher tudo de novo ao duplicar. A página
    // vem do `promoted_object` que o painel já traz no item.
    const origem = item.promotedObject;
    setMetaValues({
      ...emptyAdSetMeta(),
      pageId: origem?.page_id || '',
      mensagemDestino:
        origem?.whatsapp_phone_number ? 'WHATSAPP' : origem?.page_id ? 'MESSENGER' : emptyAdSetMeta().mensagemDestino,
      whatsappPhone: origem?.whatsapp_phone_number || '',
      conversaoTipo: origem?.pixel_id ? 'SITE' : origem?.whatsapp_phone_number ? 'WHATSAPP' : 'NENHUMA',
    });
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
      // Sem isso o select "Conta de anúncio" abre vazio: só o estado do id é
      // preenchido, mas a LISTA de contas da BM (targetAccounts) nunca é
      // buscada até o usuário trocar a BM manualmente.
      loadAccountsForBm(currentBmId, adAccountId || undefined);
    }
    if (adAccountId) setTargetAccountId(adAccountId);
    setConversaoEscolhida('NENHUMA');
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
    // Só o que a pessoa mexeu vai no overrides — campo vazio não pode ser
    // enviado, senão o backend entende "escolha explícita" onde a intenção era
    // "mantém o da origem".
    const destinoEscolhido: Record<string, unknown> = {
      page_id: metaValues.pageId || undefined,
      daily_budget: budgetMode === 'DIARIO' && budgetOverride.trim() && level !== 'ads' ? budgetOverride.trim().replace(',', '.') : undefined,
    };
    // Destino de conversa/local de conversão só faz sentido com o objetivo novo
    // já escolhido — mandar WhatsApp numa cópia de tráfego é erro garantido.
    const objetivoEfetivo: ObjectiveKey = newObjectiveKey || objectiveKeyForValue(item?.objective);
    const metaConversa = optimizationGoalFor(objetivoEfetivo, metaValues) === 'CONVERSATIONS';
    if (metaConversa) {
      destinoEscolhido.mensagem_destino = metaValues.mensagemDestino;
      if (metaValues.mensagemDestino === 'WHATSAPP' && metaValues.whatsappPhone.trim()) {
        destinoEscolhido.whatsapp_phone_number = metaValues.whatsappPhone.trim();
      }
    } else if (metaValues.conversaoTipo === 'SITE' && metaValues.conversionLocation.trim()) {
      destinoEscolhido.conversion_location = metaValues.conversionLocation.trim();
      destinoEscolhido.conversion_event = metaValues.conversionEvent;
    }
    if (metaValues.conversaoTipo === 'FORMULARIO') {
      destinoEscolhido.optimization_goal = 'LEAD_GENERATION';
    }
    if (budgetMode === 'VITALICIO' && budgetOverride.trim()) {
      destinoEscolhido.lifetime_budget = budgetOverride.trim().replace(',', '.');
      destinoEscolhido.daily_budget = undefined;
      if (endDate) destinoEscolhido.end_time = endDate;
    }
    if (description.trim()) destinoEscolhido.description = description.trim();

    setSaving(true);
    try {
      if (level === 'campaigns') {
        const objMap = OBJECTIVE_BY_KEY[objetivoEfetivo];
        await metaAdsManagerService.duplicateCampaignWithObjective({
          campaignId: item.id,
          adAccountId: effectiveAdAccountId,
          newName: trimmed,
          newObjective: newObjectiveKey ? objMap.objective : item.objective || '',
          newOptimizationGoal: newObjectiveKey ? optimizationGoalFor(objetivoEfetivo, metaValues) : undefined,
          overrides: destinoEscolhido,
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
          newOptimizationGoal: optimizationGoalFor(objetivoEfetivo, metaValues),
          overrides: destinoEscolhido,
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
      toast.error(apiErrorMessage(error, true) || `Erro ao tentar duplicar '${item.name}'.`);
    } finally {
      setSaving(false);
    }
  };

  // Tela de duplicar CAMPANHA: só uma pergunta — onde acontecem as conversões.
  // O resto não aparece aqui: ao avançar, abre a tela de criação preenchida
  // com a campanha de origem, com tudo editável.
  if (level === 'campaigns' && item) {
    const tiposConversao = conversaoTiposFor(objetivoDoDup).filter((t) => t.value !== 'NENHUMA');
    const avancar = () => {
      const prefill = buildPrefillFromSource({ item, level: 'campaigns', structural, conversaoTipo: conversaoEscolhida });
      if (!prefill) {
        toast.error('Não consegui ler os conjuntos desta campanha para montar a cópia. Atualize o painel e tente de novo.');
        return;
      }
      const nomeFinal = name.trim() && name !== item.name ? name.trim() : prefill.name;
      onAvancarParaCriacao({ ...prefill, name: nomeFinal });
      onOpenChange(false);
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle>Duplicar campanha</DialogTitle>
            <DialogDescription className="text-slate-400">
              Escolha onde as conversões acontecem. Na próxima tela a campanha abre preenchida e você pode mudar o que quiser.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-slate-400">Novo nome</Label>
              <Input
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400 block">Onde acontecem as conversões</Label>
              {tiposConversao.length === 0 ? (
                <p className="text-xs text-slate-500">
                  O objetivo desta campanha ({OBJECTIVE_BY_KEY[objetivoDoDup]?.label}) não registra conversão — a cópia mantém o destino atual.
                </p>
              ) : (
                tiposConversao.map((tipo) => (
                  <label
                    key={tipo.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                      conversaoEscolhida === tipo.value ? 'border-teal-500 bg-teal-900/20' : 'border-slate-600 hover:bg-slate-700/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="conversao-duplicar"
                      className="mt-1"
                      checked={conversaoEscolhida === tipo.value}
                      onChange={() => setConversaoEscolhida(tipo.value)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-200">{tipo.label}</span>
                      <span className="block text-xs text-slate-400">{tipo.hint}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
              Cancelar
            </Button>
            <Button onClick={avancar}>Avançar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
                  {OBJECTIVES.map((o) => (
                    <SelectItem key={o.objective} value={objectiveKeyForValue(o.objective)}>
                      {o.label} — {o.hint.split('.')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Recria a campanha do zero com o mesmo público e criativo, só trocando o objetivo.</p>
            </div>
          )}

          {(level === 'campaigns' || level === 'adsets') && (
            <div className="space-y-3 border-t border-slate-700 pt-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {level === 'adsets' ? 'Ajustes do conjunto' : 'Página e destino do anúncio'}
              </p>
              <AdSetDescriptionField value={description} onChange={setDescription} />
              {level === 'campaigns' && (
                <AdSetBudgetFields
                  mode={budgetMode}
                  onModeChange={setBudgetMode}
                  value={budgetOverride}
                  onValueChange={setBudgetOverride}
                  endDate={endDate}
                  onEndDateChange={setEndDate}
                  hint="Vazio = mesmo orçamento da origem."
                />
              )}
              <AdSetMetaFields
                objectiveKey={objetivoDoDup}
                whatsappNumbers={whatsappNumbers}
                loadingWhatsappNumbers={loadingWhatsappNumbers}
                pages={pages}
                loadingPages={loadingPages}
                values={metaValues}
                onChange={(patch) => setMetaValues((prev) => ({ ...prev, ...patch }))}
              />
              <p className="text-xs text-slate-500">
                Escolher a página e o destino é o que evita o erro da Meta: em campanha de mensagens o criativo, o conjunto e o
                botão precisam apontar para a mesma conversa.
              </p>
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
      toast.error(apiErrorMessage(error, true) || `Erro ao tentar excluir '${item.name}'.`);
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

// Réplica do "Ver Criativo" do painel legado (fetchCreativeDetails) — imagem
// em preview real, vídeo como thumbnail + link externo (a Graph API não dá
// um player embutido de graça sem token assinado), e carrossel como grid de
// cartões. Nenhum dos três formatos existia na versão React antes disso.
function CreativeViewerModal({ item, open, onOpenChange }: { item: AggregatedItem | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [details, setDetails] = useState<CreativeDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) {
      setDetails(null);
      return;
    }
    setLoading(true);
    metaAdsManagerService
      .getCreativeDetails(item.id)
      .then(setDetails)
      .catch(() => toast.error(`Não foi possível carregar o criativo de '${item.name}'.`))
      .finally(() => setLoading(false));
  }, [open, item]);

  const mediaType = details?.carrossel?.length
    ? 'Carrossel'
    : details?.imagem
      ? 'Imagem'
      : details?.video
        ? 'Vídeo (Reel/Story)'
        : 'Nenhum';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criativo do Anúncio</DialogTitle>
          <DialogDescription className="text-slate-400">{item?.name}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando criativo...
          </div>
        ) : (
          <div className="space-y-4">
            {details?.carrossel && details.carrossel.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {details.carrossel.map((card, i) => (
                  <div key={i} className="rounded-lg border border-slate-700 overflow-hidden bg-slate-700/50">
                    {card.imagem ? (
                      <img src={card.imagem} alt={card.nome || `Cartão ${i + 1}`} className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 flex items-center justify-center text-slate-500 text-xs">Sem imagem</div>
                    )}
                    <div className="p-2">
                      <p className="text-xs font-semibold text-slate-200 truncate">{card.nome || 'N/D'}</p>
                      {card.descricao && <p className="text-[0.7rem] text-slate-400 truncate">{card.descricao}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : details?.imagem ? (
              <img
                src={details.imagem}
                alt="Criativo"
                className="w-full h-auto max-h-[400px] object-contain rounded-lg shadow-lg border border-slate-700"
              />
            ) : details?.video ? (
              <div
                className="w-full h-56 rounded-lg border border-slate-700 flex flex-col items-center justify-center gap-3 bg-slate-700/50 bg-cover bg-center"
                style={details.thumbnail_url ? { backgroundImage: `url(${details.thumbnail_url})` } : undefined}
              >
                <PlayCircle className="w-16 h-16 text-white/90 drop-shadow-lg" />
                <a
                  href={details.video}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold py-2 px-4 rounded-md transition-colors shadow-lg"
                >
                  <ExternalLink className="w-4 h-4" /> Abrir Mídia
                </a>
              </div>
            ) : (
              <div className="h-32 bg-slate-700/50 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                Nenhum criativo encontrado
              </div>
            )}

            <div className="space-y-3">
              <div className="border border-slate-700 p-3 rounded-lg bg-slate-700/50">
                <p className="text-slate-400 font-medium mb-1 text-xs">Título:</p>
                <p className="text-slate-200 text-sm italic">{details?.titulo || 'N/D'}</p>
              </div>
              <div className="border border-slate-700 p-3 rounded-lg bg-slate-700/50">
                <p className="text-slate-400 font-medium mb-1 text-xs">Texto Principal:</p>
                <p className="text-slate-200 text-sm whitespace-pre-wrap">{details?.texto_principal || 'N/D'}</p>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-slate-300">Nome do Criativo:</span>
                <span className="text-sky-400 font-medium text-right max-w-[60%] truncate">{details?.criativo_nome || 'N/D'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-slate-300">Tipo de Mídia:</span>
                <span className="text-sky-400 font-medium">{mediaType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-slate-300">ID do Anúncio:</span>
                <span className="text-slate-400 text-sm truncate max-w-[60%]">{item?.id || 'N/D'}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
// Faixa de idade: as 6 faixas padrão do Gerenciador de Anúncios (a última é o
// "65+" — `age_max: 65` é o que a Meta entende como 65 ou mais) e, quando a
// faixa não bate com nenhuma delas, os dois campos numéricos.
function AgeRangeFields({
  ageMin,
  ageMax,
  onChange,
}: {
  ageMin: string;
  ageMax: string;
  onChange: (patch: { ageMin?: string; ageMax?: string }) => void;
}) {
  const faixaAtual = ageRangeFor(ageMin, ageMax);
  return (
    <div>
      <Label className="text-xs text-slate-400 block mb-2">Idade</Label>
      <div className="grid grid-cols-2 gap-4 items-end">
        <Select value={faixaAtual} onValueChange={(v: string) => {
          const faixa = AGE_RANGES.find((r) => r.value === v);
          if (!faixa) {
            onChange({ ageMin: '25', ageMax: '65' });
            return;
          }
          onChange({ ageMin: faixa.min, ageMax: faixa.max });
        }}>
          <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
            <SelectValue placeholder="Escolha a faixa" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
            {AGE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
            <SelectItem value="custom" disabled>
              Personalizada (abaixo)
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-slate-500">Mínima</Label>
            <Input
              type="number"
              min={18}
              max={65}
              value={ageMin}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ageMin: e.target.value })}
              className="bg-slate-700 border-slate-600 text-slate-200"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Máxima</Label>
            <Input
              type="number"
              min={18}
              max={65}
              value={ageMax}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ageMax: e.target.value })}
              className="bg-slate-700 border-slate-600 text-slate-200"
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-1">Máxima 65 = 65 ou mais.</p>
    </div>
  );
}

// "Direcionamento Detalhado" com sugestão: o campo recebe texto livre separado
// por vírgula, mas agora busca no endpoint `buscar_direcionamento` da Meta ao
// digitar (interesses e comportamentos). Sem isso o usuário escreve no escuro
// e só descobre o termo inválido quando a Meta recusa o conjunto.
function DetailedTargetingField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [termo, setTermo] = useState('');
  const [sugestoes, setSugestoes] = useState<TargetingItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selecionados = useMemo(
    () => value.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
    [value],
  );

  useEffect(() => {
    if (termo.trim().length < 2) {
      setSugestoes([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const [interesses, comportamentos] = await Promise.all([
          metaCreationService.searchTargeting('interests', termo.trim()),
          metaCreationService.searchTargeting('behaviors', termo.trim()),
        ]);
        setSugestoes([...interesses, ...comportamentos].slice(0, 12));
      } catch {
        setSugestoes([]);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [termo]);

  // Fecha a lista de sugestões ao clicar fora, senão ela cobre os campos de baixo.
  useEffect(() => {
    const fecha = (evento: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) setSugestoes([]);
    };
    document.addEventListener('mousedown', fecha);
    return () => document.removeEventListener('mousedown', fecha);
  }, []);

  const adicionar = (nome: string) => {
    const limpo = nome.trim();
    if (!limpo || selecionados.some((s) => s.toLowerCase() === limpo.toLowerCase())) return;
    onChange([...selecionados, limpo].join(', '));
    setTermo('');
    setSugestoes([]);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label className="text-xs text-slate-400">Direcionamento Detalhado (interesses e comportamentos, opcional)</Label>
      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selecionados.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-sky-900/50 text-sky-200 border border-sky-700">
              {s}
              <button
                type="button"
                onClick={() => onChange(selecionados.filter((x) => x !== s).join(', '))}
                className="hover:text-white"
                title="Remover"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={termo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTermo(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter' && termo.trim()) {
                e.preventDefault();
                adicionar(termo);
              }
            }}
            placeholder="Digite e escolha a sugestão. Ex: moda, fitness,不离 compras online"
            className="bg-slate-700 border-slate-600 text-slate-200"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => adicionar(termo)} className="shrink-0 border-slate-600 text-slate-300">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        {buscando && <Loader2 className="w-3.5 h-3.5 mt-1 animate-spin text-slate-400" />}
        {sugestoes.length > 0 && (
          <div className="absolute w-full z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
            {sugestoes.map((s, i) => (
              <button
                key={`${s.id}-${i}`}
                type="button"
                onClick={() => adicionar(s.name)}
                className="w-full text-left p-3 cursor-pointer hover:bg-sky-700/50 transition-colors text-sm border-b border-slate-700 last:border-b-0 truncate text-slate-200"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LocationMapPicker({
  locations,
  onChange,
  excludedLocations,
  onExcludedChange,
}: {
  locations: LocationEntry[];
  onChange: (locations: LocationEntry[]) => void;
  excludedLocations: LocationEntry[];
  onExcludedChange: (locations: LocationEntry[]) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const extraLayersRef = useRef<L.Layer[]>([]);
  // A exclusão entra no mesmo mapa/pin da inclusão, então o desenho das
  // camadas extras lê as DUAS listas daqui.
  const locationsRef = useRef(locations);
  const excludedRef = useRef(excludedLocations);
  locationsRef.current = locations;
  excludedRef.current = excludedLocations;

  // Inclusão (verde) ou exclusão (vermelho) — o resto do componente opera na
  // lista do modo ativo, que é o que faltava pra poder excluir localizações.
  const [mode, setMode] = useState<'INCLUIR' | 'EXCLUIR'>('INCLUIR');
  const listaAtual = mode === 'INCLUIR' ? locations : excludedLocations;
  const setListaAtual = mode === 'INCLUIR' ? onChange : onExcludedChange;

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
    const desenha = (lista: LocationEntry[], cor: string, prefixo: string) =>
      lista.forEach((loc) => {
        const marker = L.marker([loc.lat, loc.lng], { opacity: 0.6, title: `${prefixo}${loc.name} (${loc.radius}km)` }).addTo(map);
        const circle = L.circle([loc.lat, loc.lng], { radius: loc.radius * 1000, color: cor, fillColor: cor, fillOpacity: 0.08, weight: 1.5 }).addTo(map);
        extraLayersRef.current.push(marker, circle);
      });
    desenha(locationsRef.current, '#10b981', '');
    desenha(excludedRef.current, '#ef4444', 'EXCLUIR: ');
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
  }, [locations, excludedLocations]);

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

  // Clicar na sugestão já ADICIONA na lista do modo ativo (antes só movia o
  // pin e exigia o clique em "Adicionar", o que fazia a segunda cidade ser
  // improdutiva). O pin continua sendo a última adicionada pra ajustar o raio.
  const selectSuggestion = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const displayName = result.display_name.split(',').slice(0, 3).map((s) => s.trim()).join(', ');
    const entry: LocationEntry = { id: nextUid(), name: displayName, lat, lng, radius: pin.radius };
    if (listaAtual.some((loc) => loc.name === displayName)) {
      toast.error('Esta localização já está na lista.');
    } else {
      setListaAtual([...listaAtual, entry]);
    }
    setPin({ name: displayName, lat, lng, radius: pin.radius });
    setSearchQuery('');
    setSuggestions([]);
  };

  const addLocation = () => {
    if (!(pin.radius > 0)) {
      toast.error('Informe um raio maior que 0.');
      return;
    }
    if (listaAtual.some((loc) => loc.name === pin.name)) {
      toast.error('Esta localização já está na lista.');
      return;
    }
    setListaAtual([...listaAtual, { id: nextUid(), name: pin.name, lat: pin.lat, lng: pin.lng, radius: pin.radius }]);
  };

  const removeLocation = (id: string) => setListaAtual(listaAtual.filter((loc) => loc.id !== id));

  // Clicar numa localização da lista carrega ela no pin pra mexer só no raio,
  // sem precisar desarrastar o marcador no mapa.
  const editarRaio = (loc: LocationEntry) => setPin({ name: loc.name, lat: loc.lat, lng: loc.lng, radius: loc.radius });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('INCLUIR')}
          className={`flex-1 text-xs px-3 py-1.5 rounded-md border ${
            mode === 'INCLUIR' ? 'bg-emerald-900/40 border-emerald-600 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          Anunciar Nestes Lugares ({locations.length})
        </button>
        <button
          type="button"
          onClick={() => setMode('EXCLUIR')}
          className={`flex-1 text-xs px-3 py-1.5 rounded-md border ${
            mode === 'EXCLUIR' ? 'bg-red-900/40 border-red-600 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          Excluir Lugares ({excludedLocations.length})
        </button>
      </div>
      {mode === 'EXCLUIR' && (
        <p className="text-xs text-slate-500">
          Lugares de exclusão não recebem anúncio: a Meta retira quem mora ou esteve aí da veiculação.
        </p>
      )}
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
          <Plus className="w-3.5 h-3.5 mr-1" /> {mode === 'INCLUIR' ? 'Adicionar' : 'Excluir'}
        </Button>
      </div>

      <div className="space-y-2 max-h-32 overflow-y-auto border border-slate-700 p-2 rounded-lg bg-slate-900/50">
        {listaAtual.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center">
            {mode === 'INCLUIR' ? 'Nenhuma localização adicionada.' : 'Nenhuma localização excluída.'}
          </p>
        ) : (
          listaAtual.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between p-2 text-sm bg-slate-700/70 rounded-md border border-slate-600"
            >
              <button type="button" onClick={() => editarRaio(loc)} className="truncate pr-2 text-left flex-1" title="Ajustar o raio">
                <span className={mode === 'INCLUIR' ? 'font-semibold text-sky-300' : 'font-semibold text-red-300'}>
                  {mode === 'EXCLUIR' && 'Não anunciar: '}
                  {loc.name}
                </span>{' '}
                <span className="text-xs text-slate-400">({loc.radius} km)</span>
              </button>
              <button
                type="button"
                onClick={() => removeLocation(loc.id)}
                className="text-red-400 hover:text-red-300 p-1 shrink-0"
                title="Remover localização"
              >
                <X className="w-3.5 h-3.5" />
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
  // Texto de apoio do anúncio (`link_data.description`). A Meta só mostra em
  // anúncio com link no feed.
  description: string;
  mediaFile: File | null;
  // "Duplicar" não tem o arquivo da origem no navegador: manda o id do
  // anúncio de origem e o backend resolve a mídia (imagem OU vídeo) dele.
  mediaFromAdId?: string;
}

interface AdSetFormState {
  key: string;
  name: string;
  budget: string;
  ageMin: string;
  ageMax: string;
  platforms: string[];
  // Posições por plataforma. A Meta recusa `facebook_positions` com a
  // plataforma Facebook desligada em `publisher_platforms`, então os dois
  // campos andam juntos.
  facebookPositions: string[];
  instagramPositions: string[];
  audienceNetworkPositions: string[];
  savedAudience: SavedAudience | null;
  detailedTargeting: string;
  locations: LocationEntry[];
  // Localizações de exclusão (`excluded_geo_locations`): a Meta não anuncia
  // para quem mora ou esteve nestes lugares.
  excludedLocations: LocationEntry[];
  // Texto livre que identifica o conjunto no Gerenciador de Anúncios.
  description: string;
  // Diário ou vitalício. Vitalício exige `endDate` — a Meta recusa sem data de
  // término (subcode 1487094) — e nunca existe junto com CBO.
  budgetMode: BudgetMode;
  endDate: string;
  // Campos do nível do conjunto que a Meta decide por objetivo: página,
  // destino de mensagens e local de conversão. Ver AdSetMetaFields.
  meta: AdSetMetaValues;
  ads: AdFormState[];
}

// O que o "Duplicar" entrega para a tela de criação abrir preenchida. É o
// mesmo formato de `AdSetFormState`, então quem abrir o formulário de
// criação a partir da duplicação vê exatamente a tela de "Criar Campanha",
// com os dados da campanha de origem e tudo editável.
export interface CampaignPrefill {
  name: string;
  objectiveKey: ObjectiveKey;
  status: 'ACTIVE' | 'PAUSED';
  adSets: AdSetFormState[];
}

// A cidade/raio que veio da origem vira um pin no mapa: o mapa não aceita
// cidade por nome, e o backend converte o pin pra `custom_locations`.
function pinsFromOrigin(entries: Array<{ name?: string; lat?: number; lng?: number; radius?: number }> | undefined): LocationEntry[] {
  return (entries || [])
    .filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number')
    .map((e) => ({
      id: nextUid(),
      name: e.name || `${e.lat}, ${e.lng}`,
      lat: e.lat as number,
      lng: e.lng as number,
      radius: e.radius || 15,
    }));
}

// Lê a campanha (ou um conjunto/anúncio dela) da árvore estrutural e monta o
// formulário de criação preenchido. A escolha de "onde acontecem as
// conversões" feita na tela de duplicar tem prioridade: é ela que troca o
// destino do anúncio.
function buildPrefillFromSource({
  item,
  level,
  structural,
  conversaoTipo,
}: {
  item: AggregatedItem;
  level: 'campaigns' | 'adsets' | 'ads';
  structural: StructuralCampaign[];
  conversaoTipo: ConversaoTipo;
}): CampaignPrefill | null {
  const campanha = structural.find((c) => c.id === (level === 'campaigns' ? item.id : item.campaignId));
  if (!campanha) return null;

  const conjuntosOrigem =
    level === 'adsets'
      ? campanha.adsets?.data.filter((s) => s.id === item.id) || []
      : level === 'ads'
        ? campanha.adsets?.data.filter((s) => s.id === item.adSetId) || []
        : campanha.adsets?.data || [];
  if (conjuntosOrigem.length === 0) return null;

  const objetivo = objectiveKeyForValue(campanha.objective);
  const adSets = conjuntosOrigem.map((origem) => {
    const targeting = origem.targeting || {};
    const promovido = origem.promoted_object || {};
    const base = newAdSet();

    const geo = targeting.geo_locations || {};
    const pins = pinsFromOrigin([
      ...(geo.cities || []).map((c) => ({ name: c.name, lat: c.lat, lng: c.lng, radius: c.radius })),
      ...(geo.places || []).map((c) => ({ name: c.name, lat: c.lat, lng: c.lng, radius: c.radius })),
      ...(geo.custom_locations || []).map((c) => ({ lat: c.latitude, lng: c.longitude, radius: c.radius })),
    ]);

    const adsOrigem =
      level === 'ads' ? origem.ads?.data.filter((a) => a.id === item.id) || [] : origem.ads?.data || [];

    return {
      ...base,
      name: origem.name,
      description: origem.description || '',
      budget: origem.daily_budget && parseFloat(origem.daily_budget) > 0 ? (parseFloat(origem.daily_budget) / 100).toFixed(2) : base.budget,
      budgetMode: origem.lifetime_budget && parseFloat(origem.lifetime_budget) > 0 ? ('VITALICIO' as const) : ('DIARIO' as const),
      endDate: origem.lifetime_budget && parseFloat(origem.lifetime_budget) > 0 ? (origem.end_time || '').slice(0, 10) : '',
      ageMin: String(targeting.age_min || base.ageMin),
      ageMax: String(targeting.age_max || base.ageMax),
      platforms: targeting.publisher_platforms || base.platforms,
      facebookPositions: targeting.facebook_positions || base.facebookPositions,
      instagramPositions: targeting.instagram_positions || base.instagramPositions,
      audienceNetworkPositions: targeting.audience_network_positions || [],
      locations: pins.length > 0 ? pins : base.locations,
      excludedLocations: pinsFromOrigin(targeting.excluded_geo_locations),
      meta: {
        ...base.meta,
        pageId: promovido.page_id || '',
        whatsappPhone: promovido.whatsapp_phone_number || '',
        // "Trocar formulário por conversa no WhatsApp" é o caminho mais comum
        // aqui: quando a resposta for WhatsApp, o destino tem que ser o
        // WhatsApp, senão a cópia sai como conversa no Messenger.
        mensagemDestino:
          conversaoTipo === 'WHATSAPP' ? 'WHATSAPP' : promovido.whatsapp_phone_number ? 'WHATSAPP' : promovido.page_id ? 'MESSENGER' : base.meta.mensagemDestino,
        conversionLocation: promovido.pixel_id || '',
        conversaoTipo: conversaoTipo === 'NENHUMA' ? base.meta.conversaoTipo : conversaoTipo,
      },
      ads: adsOrigem.length > 0 ? adsOrigem.map((a) => adFromSource(a, base.ads[0])) : base.ads,
    };
  });

  return {
    name: `${item.name} - Cópia`,
    objectiveKey: objetivo,
    status: campanha.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
    adSets,
  };
}

function adFromSource(origem: StructuralAd, modelo: AdFormState): AdFormState {
  const criativo = origem.adcreative || {};
  const link = criativo.object_story_spec?.link_data;
  const video = criativo.object_story_spec?.video_data;
  return {
    ...modelo,
    name: origem.name,
    title: criativo.title || link?.name || video?.title || '',
    body: criativo.body || link?.message || video?.message || '',
    description: link?.description || '',
    mediaFile: null,
    // A mídia do anúncio original é resolvida pelo backend a partir deste id
    // (imagem OU vídeo) — o arquivo não existe no navegador.
    mediaFromAdId: origem.id,
  };
}

// Só manda a plataforma que tem posição marcada — ver comentário no payload.
function plataformasComPosicoes(adSet: AdSetFormState): string[] {
  return adSet.platforms.filter((p) =>
    p === 'facebook'
      ? adSet.facebookPositions.length > 0
      : p === 'instagram'
        ? adSet.instagramPositions.length > 0
        : adSet.audienceNetworkPositions.length > 0,
  );
}

function newAd(): AdFormState {
  return { key: nextUid(), name: '', title: '', body: '', description: '', mediaFile: null };
}

function newAdSet(): AdSetFormState {
  return {
    key: nextUid(),
    name: '',
    budget: '100.00',
    ageMin: '25',
    ageMax: '65',
    // Plataforma Audience Network já vem ligada, mas as POSIÇÕES dela
    // começam desligadas (o padrão pedido) — marcar a plataforma liga as
    // posições, e desligar a plataforma desliga as posições.
    platforms: ['facebook', 'instagram', 'audience_network'],
    facebookPositions: [...FACEBOOK_POSITION_OPTIONS.map((p) => p.value)],
    instagramPositions: [...INSTAGRAM_POSITION_OPTIONS.map((p) => p.value)],
    audienceNetworkPositions: [],
    savedAudience: null,
    detailedTargeting: '',
    locations: [{ id: nextUid(), name: 'São Paulo', lat: -23.5505, lng: -46.6333, radius: 15 }],
    excludedLocations: [],
    description: '',
    budgetMode: 'DIARIO',
    endDate: '',
    meta: emptyAdSetMeta(),
    ads: [newAd()],
  };
}

// Bloco de UM anúncio dentro de um conjunto. Ordem dos campos: primeiro o
// texto principal (é o que a pessoa lê no feed), depois o título e a
// descrição — a mesma ordem do Gerenciador de Anúncios. `description` vai
// para o `link_data.description` do criativo.
function AdBlock({ ad, onChange, onRemove, removable }: { ad: AdFormState; onChange: (patch: Partial<AdFormState>) => void; onRemove: () => void; removable: boolean }) {
  const [libraryOpen, setLibraryOpen] = useState(false);
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
        <Label className="text-xs text-slate-400">Título</Label>
        <Input
          value={ad.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ title: e.target.value })}
          placeholder="Ex: Compre Agora e Ganhe Desconto!"
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-400">Descrição</Label>
        <Textarea
          value={ad.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ description: e.target.value })}
          rows={2}
          placeholder="Texto de apoio que aparece abaixo do link (ex: Frete grátis para todo o Brasil)."
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
        <p className="text-xs text-slate-500 mt-1">
          Aparece só em anúncios com link no feed. Em anúncio de conversa (WhatsApp/Messenger) a Meta ignora este campo.
        </p>
      </div>
      <div>
        <Label className="text-xs text-slate-400 block mb-1">Mídia (imagem ou vídeo)</Label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-sky-300 cursor-pointer hover:text-sky-200">
            <ImagePlus className="w-4 h-4" />
            {ad.mediaFile ? ad.mediaFile.name : 'Selecionar arquivo'}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onChange({ mediaFile: e.target.files?.[0] || null })} />
          </label>
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="flex items-center gap-2 text-sm text-teal-300 hover:text-teal-200"
          >
            <Images className="w-4 h-4" /> Escolher da biblioteca
          </button>
        </div>
        <MediaLibraryPickerDialog open={libraryOpen} onOpenChange={setLibraryOpen} onPick={(file) => onChange({ mediaFile: file })} />
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
  savedAudiences,
  loadingSavedAudiences,
  pages,
  loadingPages,
  objectiveKey,
  whatsappNumbers,
  loadingWhatsappNumbers,
  cboAtivo,
  creatingAudience,
  onCreateNewAudience,
}: {
  adSet: AdSetFormState;
  index: number;
  onChange: (patch: Partial<AdSetFormState>) => void;
  onRemove: () => void;
  removable: boolean;
  savedAudiences: SavedAudience[] | null;
  loadingSavedAudiences: boolean;
  pages: AdAccountPageOption[];
  loadingPages: boolean;
  objectiveKey: ObjectiveKey;
  whatsappNumbers: WhatsappNumberOption[];
  loadingWhatsappNumbers: boolean;
  cboAtivo: boolean;
  creatingAudience: boolean;
  onCreateNewAudience: (kind: 'site' | 'lookalike') => void;
}) {
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
      <AdSetDescriptionField value={adSet.description} onChange={(description) => onChange({ description })} />
      {/* "Onde a conversa acontece" e "Onde acontecem as conversões" vêm
          ANTES do orçamento e do público, como pedido: primeiro se decide
          onde o lead é registrado e quanto se gasta nele, só depois quem é a
          pessoa que vai ver isso. */}
      <AdSetMetaFields
        objectiveKey={objectiveKey}
        pages={pages}
        loadingPages={loadingPages}
        whatsappNumbers={whatsappNumbers}
        loadingWhatsappNumbers={loadingWhatsappNumbers}
        values={adSet.meta}
        onChange={(meta) => onChange({ meta: { ...adSet.meta, ...meta } })}
        requirePage
      />

      <div className="border-t border-slate-700/70 pt-4">
        <AdSetBudgetFields
          mode={adSet.budgetMode}
          onModeChange={(budgetMode) => onChange({ budgetMode })}
          value={adSet.budget}
          onValueChange={(budget) => onChange({ budget })}
          endDate={adSet.endDate}
          onEndDateChange={(endDate) => onChange({ endDate })}
          disabled={cboAtivo}
          hint={cboAtivo ? 'Com CBO o valor vem da campanha, então o campo do conjunto fica desligado.' : undefined}
        />
      </div>

      <div className="space-y-4 border-t border-slate-700 pt-4">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <Label className="text-xs text-slate-400">Público</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCreateNewAudience('site')}
                disabled={creatingAudience}
                className="border-teal-600 text-teal-300 hover:bg-teal-900/30"
              >
                <Users className="w-3.5 h-3.5 mr-1" /> Criar público
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCreateNewAudience('lookalike')}
                disabled={creatingAudience}
                className="border-violet-600 text-violet-300 hover:bg-violet-900/30"
              >
                <Wand2 className="w-3.5 h-3.5 mr-1" /> Criar público semelhante
              </Button>
            </div>
          </div>
          <Select
            value={adSet.savedAudience?.id ?? '__none__'}
            onValueChange={(v: string) =>
              onChange({ savedAudience: v === '__none__' ? null : (savedAudiences?.find((s) => s.id === v) ?? null) })
            }
          >
            <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
              <SelectValue placeholder={loadingSavedAudiences ? 'Carregando públicos da Meta...' : 'Nenhum (público personalizado)'} />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
              <SelectItem value="__none__">Nenhum (público personalizado)</SelectItem>
              {savedAudiences?.map((sa) => (
                <SelectItem key={sa.id} value={sa.id}>
                  {sa.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {adSet.savedAudience && (
            <p className="text-xs text-slate-500 mt-1">
              Usando o público salvo na Meta — idade, localizações e interesses abaixo são ignorados.
            </p>
          )}
        </div>
        <DetailedTargetingField
          value={adSet.detailedTargeting}
          onChange={(detailedTargeting) => onChange({ detailedTargeting })}
        />
        <AgeRangeFields
          ageMin={adSet.ageMin}
          ageMax={adSet.ageMax}
          onChange={(patch) => onChange({ ageMin: patch.ageMin ?? adSet.ageMin, ageMax: patch.ageMax ?? adSet.ageMax })}
        />
        <div>
          <Label className="text-xs text-slate-400 block mb-2">Segmentação Geográfica (mapa)</Label>
          <LocationMapPicker
            locations={adSet.locations}
            onChange={(locations) => onChange({ locations })}
            excludedLocations={adSet.excludedLocations}
            onExcludedChange={(excludedLocations) => onChange({ excludedLocations })}
          />
        </div>
        <AdSetPlatformPositionsFields
          platforms={adSet.platforms}
          onPlatformsChange={(platforms) => onChange({ platforms })}
          positions={{
            facebook: adSet.facebookPositions,
            instagram: adSet.instagramPositions,
            audienceNetwork: adSet.audienceNetworkPositions,
          }}
          onPositionsChange={(patch) =>
            onChange({
              facebookPositions: patch.facebook ?? adSet.facebookPositions,
              instagramPositions: patch.instagram ?? adSet.instagramPositions,
              audienceNetworkPositions: patch.audienceNetwork ?? adSet.audienceNetworkPositions,
            })
          }
        />
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
  prefill = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adAccountId: string | null;
  onCreated: () => void;
  // Presente = a tela veio do "Duplicar": abre o MESMO formulário de criação,
  // preenchido com a campanha de origem e todo campo editável.
  prefill?: CampaignPrefill | null;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('PAUSED');
  const [objectiveKey, setObjectiveKey] = useState<ObjectiveKey>(DEFAULT_OBJECTIVE);
  const [link, setLink] = useState('');
  const [adSets, setAdSets] = useState<AdSetFormState[]>(() => [newAdSet()]);

  const [saving, setSaving] = useState(false);

  const [savedAudiences, setSavedAudiences] = useState<SavedAudience[] | null>(null);
  const [loadingSavedAudiences, setLoadingSavedAudiences] = useState(false);

  // NÍVEL DO ORÇAMENTO — escolha explícita pedida pelo usuário: o dinheiro pode
  // ficar na campanha (CBO, a Meta divide entre os conjuntos) ou em cada
  // conjunto. Com CBO a Meta exige limite de lance por conjunto e recusa
  // orçamento vitalício (subcodes 4834002/4834011).
  const [budgetLevel, setBudgetLevel] = useState<'CONJUNTO' | 'CAMPANHA'>('CONJUNTO');
  const [campaignBudget, setCampaignBudget] = useState('');
  const [bidCap, setBidCap] = useState('');

  const [pages, setPages] = useState<AdAccountPageOption[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  // "+ Criar novo público" dentro do seletor de cada conjunto. O público é
  // criado na conta da campanha e recarregado na lista; como o painel consome
  // o público por NOME (o backend procura em saved_audiences/customaudiences),
  // o recém-criado já entra utilizável.
  const [audienceDialogAdSetKey, setAudienceDialogAdSetKey] = useState<string | null>(null);
  // Qual atalho abriu o diálogo de público: "site" (criar público) ou
  // "lookalike" (criar público semelhante).
  const [audienceDialogKind, setAudienceDialogKind] = useState<'site' | 'lookalike'>('site');


  const objectiveMeta = OBJECTIVE_BY_KEY[objectiveKey];
  const cboAtivo = budgetLevel === 'CAMPANHA' && campaignBudget.trim().length > 0;
  // Números de WhatsApp por conjunto (a lista vem da conta, ver backend).
  const [whatsappNumbers, setWhatsappNumbers] = useState<Record<string, WhatsappNumberOption[]>>({});
  const [loadingWhatsappKey, setLoadingWhatsappKey] = useState<string | null>(null);

  // Cada conjunto tem sua própria página, então cada um busca os números de
  // WhatsApp daquela página (a lista vem da conta, ver backend). Uma
  // requisição por combinação página+conjunto, cancelada quando muda.
  useEffect(() => {
    if (!open || !adAccountId) return;
    const pendentes = adSets
      .map((adSet) => ({ key: adSet.key, pageId: adSet.meta.pageId }))
      .filter((x) => x.pageId);
    if (pendentes.length === 0) return;

    const controller = new AbortController();
    const buscar = async () => {
      for (const { key, pageId } of pendentes) {
        setLoadingWhatsappKey(key);
        try {
          const lista = await metaAdsManagerService.listWhatsappNumbers(adAccountId, pageId);
          setWhatsappNumbers((prev) => ({ ...prev, [key]: lista }));
        } catch {
          setWhatsappNumbers((prev) => ({ ...prev, [key]: [] }));
        } finally {
          setLoadingWhatsappKey((atual) => (atual === key ? null : atual));
        }
      }
    };
    buscar();
    return () => controller.abort();
  }, [open, adAccountId, adSets]);

  // Reseta pro estado inicial (1 conjunto + 1 anúncio) toda vez que o modal
  // abre — mesmo comportamento do showCreateCampaignModal do legado.
  useEffect(() => {
    if (!open) return;
    if (prefill) {
      setName(prefill.name);
      setStatus(prefill.status);
      setObjectiveKey(prefill.objectiveKey);
      setLink('');
      setBudgetLevel('CONJUNTO');
      setCampaignBudget('');
      setBidCap('');
      setAdSets(prefill.adSets);
      return;
    }
    setName('');
    setStatus('PAUSED');
    setObjectiveKey(DEFAULT_OBJECTIVE);
    setLink('');
    setBudgetLevel('CONJUNTO');
    setCampaignBudget('');
    setBidCap('');
    setAdSets([newAdSet()]);
  }, [open, prefill]);

  // Puxa os públicos salvos direto da Meta (aba Direcionamento criou/salvou
  // eles lá) pra alimentar o seletor de cada conjunto.
  useEffect(() => {
    if (!open || !adAccountId) return;
    setSavedAudiences(null);
    setLoadingSavedAudiences(true);
    metaCreationService
      .listSavedAudiences(adAccountId)
      .then(setSavedAudiences)
      .catch(() => toast.error('Erro ao carregar públicos salvos da Meta'))
      .finally(() => setLoadingSavedAudiences(false));
  }, [open, adAccountId]);

  // Páginas que podem veicular nesta conta de anúncios. A Meta resolve as
  // páginas pela BM dona da conta, não pela conta — por isso a lista muda
  // junto com a conta selecionada, e não com a campanha.
  useEffect(() => {
    if (!open || !adAccountId) return;
    setLoadingPages(true);
    metaAdsManagerService
      .listPages(adAccountId)
      .then((lista) => {
        setPages(
          lista.map((p) => ({ id: p.id, name: p.name, hasInstagram: Boolean(p.instagram_business_account?.id) })),
        );
      })
      .catch(() => toast.error('Erro ao carregar as páginas desta conta de anúncios'))
      .finally(() => setLoadingPages(false));
  }, [open, adAccountId]);

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
        toast.error(
          `Preencha o Nome e o ${adSet.budgetMode === 'VITALICIO' ? 'Orçamento Vitalício' : 'Orçamento Diário'} do conjunto "${
            trimmedAdSetName || adSet.name
          }".`,
        );
        return;
      }
      // Conversa no WhatsApp sem número: a Meta devolve erro genérico de
      // objeto promovido, então a validação acontece antes do envio.
      if (pendingWhatsappValidation(adSet.meta, optimizationGoalFor(objectiveKey, adSet.meta))) {
        toast.error(`Escolha o número de WhatsApp do conjunto "${trimmedAdSetName}" (ou troque o destino da conversa).`);
        return;
      }
      // A Meta recusa orçamento vitalício sem data de término (subcode 1487094)
      // e nunca aceita vitalício junto com CBO.
      if (adSet.budgetMode === 'VITALICIO' && !cboAtivo && !adSet.endDate) {
        toast.error(`Escolha a data final do orçamento vitalício do conjunto "${trimmedAdSetName}".`);
        return;
      }
      if (adSet.budgetMode === 'VITALICIO' && cboAtivo) {
        toast.error('Orçamento vitalício não existe com CBO: escolha "No conjunto" ou "Na campanha" acima.');
        return;
      }
      if (cboAtivo && !bidCap.trim()) {
        toast.error('Com o orçamento na campanha a Meta exige o Limite de Lance por conjunto.');
        return;
      }
      const ageMinNum = parseInt(adSet.ageMin, 10);
      const ageMaxNum = parseInt(adSet.ageMax, 10);
      if (ageMinNum > ageMaxNum) {
        toast.error(`Idade mínima não pode ser maior que a máxima (conjunto "${trimmedAdSetName}").`);
        return;
      }
      if (adSet.locations.length === 0 && !adSet.savedAudience) {
        toast.error(`Adicione pelo menos uma localização geográfica no conjunto "${trimmedAdSetName}".`);
        return;
      }
      for (const ad of adSet.ads) {
        if (!ad.name.trim()) {
          toast.error(`Preencha o Nome do Anúncio (conjunto "${trimmedAdSetName}").`);
          return;
        }
        if (!ad.mediaFile && !ad.mediaFromAdId) {
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
          const pin = (loc: LocationEntry) => ({
            key: 'custom_location_pin',
            name: loc.name,
            radius: loc.radius,
            distance_unit: 'kilometer',
            latitude: loc.lat,
            longitude: loc.lng,
          });
          const geoCities = adSet.locations.map(pin);
          const geoExcluidas = adSet.excludedLocations.map(pin);

          const adsPayload = await Promise.all(
            adSet.ads.map(async (ad) => {
              const base = {
                ad_name: ad.name.trim(),
                ad_status: status,
                // Ordem dos campos do anúncio: texto principal, título e
                // descrição — `description` só existe no `link_data`.
                title: ad.title.trim() || undefined,
                body: ad.body.trim() || undefined,
                description: ad.description.trim() || undefined,
              };
              // "Duplicar": sem arquivo no navegador, o backend puxa a mídia
              // do anúncio de origem (imagem ou vídeo).
              if (!ad.mediaFile && ad.mediaFromAdId) return { ...base, ad_id_origem: ad.mediaFromAdId };
              return {
                ...base,
                asset_base64: await fileToBase64(ad.mediaFile as File),
                asset_mimetype: (ad.mediaFile as File).type || 'image/jpeg',
              };
            }),
          );

          // A meta de desempenho do conjunto vem do objetivo DA CAMPANHA mais a
          // escolha de conversa/conversão feita no bloco do conjunto — é a
          // única combinação que a Meta aceita (uma meta por conjunto).
          const optimizationGoal = optimizationGoalFor(objectiveKey, adSet.meta);
          const metaEhConversa = optimizationGoal === 'CONVERSATIONS';
          const metaEhPixel = optimizationGoal === 'OFFSITE_CONVERSIONS';
          const orcamentoVitalicio = adSet.budgetMode === 'VITALICIO' && !cboAtivo && budgetValue > 0;

          return {
            adset_name: adSet.name.trim(),
            adset_status: status,
            description: adSet.description.trim() || undefined,
            // Com CBO quem manda o valor é a campanha; mandar junto faz a Meta
            // usar o do conjunto e silenciar o da campanha.
            daily_budget: cboAtivo ? undefined : orcamentoVitalicio ? undefined : budgetValue.toFixed(2),
            lifetime_budget: orcamentoVitalicio ? budgetValue.toFixed(2) : undefined,
            end_time: orcamentoVitalicio ? adSet.endDate || undefined : undefined,
            optimization_goal: optimizationGoal,
            // CBO exige teto de lance por conjunto — sem ele a Meta recusa com
            // 1815857. O valor vai no formato de exibição: quem converte para
            // centavos inteiros é o backend (bid_amount_cents).
            bid_strategy: cboAtivo ? 'LOWEST_COST_WITH_BID_CAP' : 'LOWEST_COST_WITHOUT_CAP',
            bid_amount: cboAtivo && bidCap.trim() ? bidCap.trim().replace(',', '.') : undefined,
            page_id: adSet.meta.pageId || undefined,
            // `mensagem_destino` só vai quando a meta é conversa: mandar
            // destino de mensagem numa compra de pixel é recusado pela Meta.
            mensagem_destino: metaEhConversa ? adSet.meta.mensagemDestino : undefined,
            whatsapp_phone_number: metaEhConversa && adSet.meta.mensagemDestino === 'WHATSAPP' ? adSet.meta.whatsappPhone.trim() || undefined : undefined,
            conversion_location: metaEhPixel ? adSet.meta.conversionLocation.trim() || undefined : undefined,
            conversion_event: metaEhPixel ? adSet.meta.conversionEvent : undefined,
            targeting: {
              age_min: parseInt(adSet.ageMin, 10),
              age_max: parseInt(adSet.ageMax, 10),
              // Plataforma e posições não podem divergir: a Meta recusa
              // `audience_network` em `publisher_platforms` sem nenhuma
              // posição de AN marcada (e o mesmo vale para FB/IG). Como o AN
              // vem marcado mas com as posições desligadas por padrão, ele
              // só entra no payload quando tiver posição.
              publisher_platforms: plataformasComPosicoes(adSet),
              facebook_positions: adSet.platforms.includes('facebook') && adSet.facebookPositions.length > 0 ? adSet.facebookPositions : undefined,
              instagram_positions: adSet.platforms.includes('instagram') && adSet.instagramPositions.length > 0 ? adSet.instagramPositions : undefined,
              audience_network_positions: adSet.audienceNetworkPositions.length > 0 ? adSet.audienceNetworkPositions : undefined,
              saved_audience_name: adSet.savedAudience?.name ?? undefined,
              detailed_targeting_manual: detailedTargetingManual.length > 0 ? detailedTargetingManual : undefined,
              geo_locations: {
                // `cities` aqui carrega os pins do mapa (key=custom_location_pin) —
                // o backend (Meta::AdsManagerService#normalize_geo) converte pra
                // geo_locations.custom_locations no formato real da Graph API.
                // `location_types` NÃO vai: a Graph API atual recusa o array com
                // o subcode 1870199.
                cities: geoCities,
                // Exclusão: o backend converte estes pins para
                // `excluded_geo_locations`, que é o campo de "não anunciar
                // aqui" da Graph API.
                excluded_cities: geoExcluidas.length > 0 ? geoExcluidas : undefined,
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
        // Orçamento diário da campanha (CBO). Só entra quando o nível escolhido
        // é CAMPANHA e o valor foi preenchido.
        campaign_daily_budget: cboAtivo ? campaignBudget.trim().replace(',', '.') : undefined,
        adsets: adsetsPayload,
      };

      await metaAdsManagerService.createCampaign(adAccountId, campanha);
      toast.success(`Campanha '${trimmedName}' criada e publicada com sucesso!`);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(apiErrorMessage(error, true) || `Erro ao tentar criar a campanha '${trimmedName}'.`);
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
                  {OBJECTIVES.map((o) => (
                    <SelectItem key={o.objective} value={objectiveKeyForValue(o.objective)}>
                      {o.label} — {o.hint.split('.')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">{objectiveMeta.hint}</p>
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
            <div>
              <Label className="text-xs text-slate-400">Onde fica o orçamento</Label>
              <div className="flex gap-4 mt-1">
                {(['CONJUNTO', 'CAMPANHA'] as const).map((nivel) => (
                  <label key={nivel} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="budget-level"
                      checked={budgetLevel === nivel}
                      onChange={() => setBudgetLevel(nivel)}
                      className="accent-sky-500"
                    />
                    {nivel === 'CONJUNTO' ? 'No conjunto (cada um com o seu)' : 'Na campanha (CBO)'}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {budgetLevel === 'CAMPANHA'
                  ? 'A Meta divide o dinheiro entre os conjuntos e exige limite de lance em cada um. Nesse modo o orçamento é sempre diário.'
                  : 'Cada conjunto usa o orçamento que está no bloco dele, diário ou vitalício.'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {budgetLevel === 'CAMPANHA' && (
                <div>
                  <Label className="text-xs text-slate-400">Orçamento Diário da Campanha (CBO)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={campaignBudget}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCampaignBudget(e.target.value)}
                    placeholder="Ex: 200,00"
                    className="bg-slate-700 border-slate-600 text-slate-200"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Com CBO o orçamento de cada conjunto é ignorado pela Meta.
                  </p>
                </div>
              )}
              {cboAtivo && (
                <div>
                  <Label className="text-xs text-slate-400">Limite de Lance por Conjunto (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bidCap}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBidCap(e.target.value)}
                    placeholder="Ex: 15,00"
                    className="bg-slate-700 border-slate-600 text-slate-200"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    A Meta exige limite de lance em cada conjunto quando o orçamento está na campanha.
                  </p>
                </div>
              )}
            </div>
          </section>

          {adSets.map((adSet, index) => (
            <AdSetBlock
              key={adSet.key}
              adSet={adSet}
              index={index}
              onChange={(patch) => updateAdSet(adSet.key, patch)}
              onRemove={() => removeAdSet(adSet.key)}
              removable={adSets.length > 1}
              savedAudiences={savedAudiences}
              loadingSavedAudiences={loadingSavedAudiences}
              pages={pages}
              loadingPages={loadingPages}
              objectiveKey={objectiveKey}
              whatsappNumbers={whatsappNumbers[adSet.key] ?? []}
              loadingWhatsappNumbers={loadingWhatsappKey === adSet.key}
              cboAtivo={cboAtivo}
              creatingAudience={audienceDialogAdSetKey !== null}
              onCreateNewAudience={(kind) => {
                setAudienceDialogAdSetKey(adSet.key);
                setAudienceDialogKind(kind);
              }}
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

        {/* O Radix não aninha dois `Dialog` — o segundo sempre aria pro body e
            perderia o contexto do modal de criação. Por isso o diálogo de
            público só monta quando o atalho é clicado. */}
        {audienceDialogAdSetKey && adAccountId && (
          <AudienceCreateDialog
            open={Boolean(audienceDialogAdSetKey)}
            initialKind={audienceDialogKind}
            onOpenChange={(open) => {
              if (!open) setAudienceDialogAdSetKey(null);
            }}
            adAccountId={adAccountId}
            existingAudiences={[]}
            onCustomerListCreated={() => setAudienceDialogAdSetKey(null)}
            onCreated={() => {
              metaCreationService
                .listSavedAudiences(adAccountId)
                .then((lista) => {
                  setSavedAudiences(lista);
                  toast.success('Público criado. Se não aparecer na lista, recarregue a página.');
                })
                .catch(() => toast.error('Público criado, mas não consegui recarregar a lista.'))
                .finally(() => setAudienceDialogAdSetKey(null));
            }}
          />
        )}
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
  // "Avançar" no duplicar: a tela de criação abre com a campanha de origem
  // preenchida (e editável) em vez de o modal antigo mandar a duplicação
  // direto pra Meta.
  const [createPrefill, setCreatePrefill] = useState<CampaignPrefill | null>(null);
  const [viewCreativeTarget, setViewCreativeTarget] = useState<AggregatedItem | null>(null);

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
    setQuery('');
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

  // Navegação por breadcrumb clicável (BM / Contas / Campanhas / Conjuntos /
  // Anúncios) — igual renderBreadcrumb/handleBackButtonClick do legado.
  const goToLevel = (target: 'bm' | 'accounts' | 'campaigns' | 'adsets') => {
    if (target === 'bm') {
      setSelectedBm(null);
      setAccounts(null);
      setSelectedAccount(null);
      setLevel('accounts');
      setCampaignId(null);
      setAdSetId(null);
    } else if (target === 'accounts') {
      setSelectedAccount(null);
      setLevel('accounts');
      setCampaignId(null);
      setAdSetId(null);
    } else if (target === 'campaigns') {
      setLevel('campaigns');
      setCampaignId(null);
      setAdSetId(null);
    } else {
      setLevel('adsets');
      setAdSetId(null);
    }
    setQuery('');
    setExpandedId(null);
  };

  const breadcrumbSteps: Array<{ key: 'bm' | 'accounts' | 'campaigns' | 'adsets' | 'ads'; label: string }> = [
    { key: 'bm', label: 'BM' },
    { key: 'accounts', label: 'Contas' },
    { key: 'campaigns', label: 'Campanhas' },
    { key: 'adsets', label: 'Conjuntos' },
    { key: 'ads', label: 'Anúncios' },
  ];
  const currentStepKey: 'bm' | 'accounts' | 'campaigns' | 'adsets' | 'ads' = !selectedBm ? 'bm' : level;
  const currentStepIndex = breadcrumbSteps.findIndex((st) => st.key === currentStepKey);

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
        .catch((error) => toast.error(apiErrorMessage(error, true) || `Erro ao tentar mudar o status de '${item.name}'.`));
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
    setCreatePrefill(null);
    setCreateCampaignOpen(true);
  };

  const abrirCriacaoApartirDaDuplicacao = (prefill: CampaignPrefill) => {
    setCreatePrefill(prefill);
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

  // justify-start (não justify-between): cards do mesmo grid-row têm altura
  // igual (grid stretch), mas o número de métricas visíveis varia por item
  // (ZERO_HIDDEN_METRICS esconde métricas zeradas) — com justify-between, o
  // bloco de métricas ficava colado embaixo, então "Gasto:" aparecia numa
  // altura diferente em cada card dependendo de quantas linhas ele tinha.
  // Com justify-start + min-height no título, todo card começa as métricas
  // exatamente na mesma posição, alinhado ao original.
  const cardBaseClass =
    'text-left rounded-lg p-4 shadow-xl flex flex-col justify-start bg-slate-800 border border-slate-700 transition-all duration-300';
  const cardInteractiveClass = 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sky-500/10 active:scale-[0.98]';

  return (
    <div className="pb-8">
      <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 p-4 sm:p-6 space-y-4">
        {/* Cabeçalho com o breadcrumb no canto esquerdo: título + trilha
            (BM / Contas / Campanhas / Conjuntos / Anúncios) + nome do contexto
            selecionado, com o botão "Criar Campanha" à direita. O passo atual
            é texto; os anteriores são atalhos que saltam direto praquele
            nível (mesmo papel do renderBreadcrumb do legado). */}
        <header className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-slate-200">Painel Tráfego</h1>
            <nav className="mt-2 text-sm font-medium flex items-center flex-wrap gap-1">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  title="Voltar"
                  onClick={() => goToLevel(breadcrumbSteps[currentStepIndex - 1].key as 'bm' | 'accounts' | 'campaigns' | 'adsets')}
                  className="text-slate-300 hover:text-sky-400 transition-colors mr-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {breadcrumbSteps.slice(0, currentStepIndex + 1).map((st, idx) => (
                <span key={st.key} className="flex items-center gap-1">
                  {idx > 0 && <span className="mx-1 text-slate-600">/</span>}
                  {idx === currentStepIndex ? (
                    <span className="text-slate-400">{st.label}</span>
                  ) : (
                    <button
                      type="button"
                      className="text-sky-400 hover:underline cursor-pointer"
                      onClick={() => goToLevel(st.key as 'bm' | 'accounts' | 'campaigns' | 'adsets')}
                    >
                      {st.label}
                    </button>
                  )}
                </span>
              ))}
            </nav>
            {selectedBm && (
              <p className="text-slate-400 text-sm mt-1 truncate">
                {selectedBm.name}
                {selectedAccount ? ` › ${selectedAccount.name}` : ''}
              </p>
            )}
            {!selectedBm && <p className="text-slate-400 text-sm mt-1">Selecione uma Business Manager</p>}
          </div>
          <Button onClick={openCreateCampaignModal} className="shrink-0">
            <Plus className="w-4 h-4 mr-1" /> Criar Campanha
          </Button>
        </header>

        {!selectedBm ? (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar Business Manager..."
                className="pl-8 bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500 focus-visible:ring-sky-500"
              />
            </div>
            {loadingBms ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              (() => {
                const filteredBms = (bms || []).filter((bm) => bm.name.toLowerCase().includes(query.toLowerCase()));
                return filteredBms.length === 0 ? (
                  <div className="text-center text-sm text-slate-400 py-10 border border-dashed border-slate-700 rounded-md">
                    Nenhuma Business Manager encontrada.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredBms.map((bm) => (
                      <button
                        key={bm.id}
                        type="button"
                        onClick={() => selectBm(bm)}
                        className={`${cardBaseClass} ${cardInteractiveClass}`}
                      >
                        <h3 className="text-sm font-bold text-slate-200 line-clamp-2 leading-tight flex items-center gap-2 min-h-[2.25rem]" title={bm.name}>
                          <Building2 className="w-4 h-4 text-sky-400 shrink-0" /> {bm.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                          <MousePointerClick className="w-3 h-3" /> Toque para ver as contas
                        </p>
                      </button>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div />
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
                          <h3 className={`text-sm font-bold line-clamp-2 leading-tight min-h-[2.25rem] ${LEVEL_TITLE_COLOR.accounts}`} title={account.name}>
                            {account.name}
                          </h3>
                          {account.is_prepay_account && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold ${daysLeft === null ? 'text-slate-400' : getDaysLeftColor(daysLeft)} bg-slate-700/50 px-2 py-0.5 rounded-full mt-1`}
                              title={daysLeft === null ? 'Tem saldo, mas sem gasto nos últimos 30 dias — não dá pra estimar' : `Orçamento dura ${daysLeft.toFixed(1)} dias`}
                            >
                              <Clock className="w-3 h-3" />{' '}
                              {daysLeft === null ? 'sem gasto recente' : daysLeft <= 0 ? 'sem saldo' : `${daysLeft.toFixed(0)} dias restantes`}
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
                  const isExpanded = expandedId === item.id;
                  const drillDown = () => {
                    if (level === 'campaigns') openCampaign(item);
                    else if (level === 'adsets') openAdSet(item);
                    else setViewCreativeTarget(item);
                  };
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
                      onDoubleClick={drillDown}
                      onContextMenu={(e) => openContextMenu(e, item, level)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') drillDown();
                      }}
                      className={`${cardBaseClass} ${cardInteractiveClass}`}
                    >
                      <div className="flex items-start justify-between mb-2 pb-1 border-b border-slate-700 min-h-[3rem]">
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
        adAccountId={selectedAccount?.id ?? null}
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
        structural={treeStructural}
        open={!!duplicateTarget}
        onOpenChange={(open) => !open && setDuplicateTarget(null)}
        onSaved={refreshTree}
        onAvancarParaCriacao={abrirCriacaoApartirDaDuplicacao}
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
        onOpenChange={(open) => {
          setCreateCampaignOpen(open);
          // Ao fechar, joga fora o prefill: senão a próxima criação em branco
          // abriria preenchida com a campanha duplicada.
          if (!open) setCreatePrefill(null);
        }}
        adAccountId={selectedAccount?.id || null}
        onCreated={refreshTree}
        prefill={createPrefill}
      />

      <CreativeViewerModal
        item={viewCreativeTarget}
        open={!!viewCreativeTarget}
        onOpenChange={(open) => !open && setViewCreativeTarget(null)}
      />
    </div>
  );
}
