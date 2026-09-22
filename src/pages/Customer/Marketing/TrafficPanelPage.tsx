import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setStatus(item.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED');
      setBudget((parseFloat(item.dailyBudget || '0') / 100).toFixed(2));
    }
  }, [item]);

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
    setSaving(true);
    try {
      const edicao: Record<string, string> = {};
      if (trimmed !== item.name) edicao.name = trimmed;
      if (status !== item.status) edicao.status = status;
      const budgetCents = Math.round(budgetValue * 100).toString();
      if (budgetCents !== item.dailyBudget) edicao.daily_budget = budgetCents;
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
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>Editar Conjunto de Anúncios</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-slate-400">Nome do Conjunto</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
          </div>
          <div>
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
function DuplicateModal({
  item,
  level,
  adAccountId,
  campaigns,
  allAdSets,
  open,
  onOpenChange,
  onSaved,
}: {
  item: AggregatedItem | null;
  level: 'campaigns' | 'adsets' | 'ads' | null;
  adAccountId: string | null;
  campaigns: AggregatedItem[];
  allAdSets: AggregatedItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [newObjectiveKey, setNewObjectiveKey] = useState<ObjectiveKey | ''>('');
  const [targetCampaignId, setTargetCampaignId] = useState('');
  const [targetAdSetId, setTargetAdSetId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(`${item.name} - Cópia`);
      setNewObjectiveKey('');
      setTargetCampaignId(item.campaignId || campaigns[0]?.id || '');
      setTargetAdSetId(allAdSets[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const handleSave = async () => {
    if (!item || !level || !adAccountId) return;
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
          adAccountId,
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
          adAccountId,
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
          adAccountId,
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
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-sm">
        <DialogHeader>
          <DialogTitle>Duplicar {level ? ITEM_TYPE_LABEL[level] : ''}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Recria do zero com o mesmo público e criativo, dentro da mesma conta de anúncio.
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

          {level === 'adsets' && (
            <div>
              <Label className="text-xs text-slate-400">Campanha de destino</Label>
              <Select value={targetCampaignId} onValueChange={setTargetCampaignId}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="Selecione a campanha" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {level === 'ads' && (
            <div>
              <Label className="text-xs text-slate-400">Conjunto de destino</Label>
              <Select value={targetAdSetId} onValueChange={setTargetAdSetId}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="Selecione o conjunto" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {allAdSets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
      toast.success(`${ITEM_TYPE_LABEL[level]} '${item.name}' excluída com sucesso.`);
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
          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            Tem certeza que deseja excluir permanentemente {level ? ITEM_TYPE_LABEL[level].toLowerCase() : 'este item'} &quot;{item?.name}
            &quot;? Esta ação é irreversível.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting} className="border-slate-600 text-slate-300 bg-transparent">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Excluir Permanentemente
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

// Modal "Criar Campanha" — versão simplificada de 1 conjunto + 1 anúncio
// (sem o construtor dinâmico de múltiplos conjuntos/anúncios do legado, e
// sem o mapa interativo — geolocalização aqui é por país, ver relatório
// final pra detalhes da simplificação).
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

  const [adSetName, setAdSetName] = useState('');
  const [adSetBudget, setAdSetBudget] = useState('100.00');
  const [ageMin, setAgeMin] = useState('25');
  const [ageMax, setAgeMax] = useState('65');
  const [country, setCountry] = useState('BR');
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram']);
  const [savedAudienceName, setSavedAudienceName] = useState('');
  const [detailedTargeting, setDetailedTargeting] = useState('');

  const [adName, setAdName] = useState('');
  const [adTitle, setAdTitle] = useState('');
  const [adBody, setAdBody] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);

  const objectiveMeta = OBJECTIVE_MAP[objectiveKey];

  const togglePlatform = (value: string) =>
    setPlatforms((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));

  const handleCreate = async () => {
    if (!adAccountId) {
      toast.error('Selecione uma conta de anúncio primeiro para criar uma campanha.');
      return;
    }
    const trimmedName = name.trim();
    const trimmedAdSetName = adSetName.trim();
    const trimmedAdName = adName.trim();
    if (!trimmedName) {
      toast.error('Preencha o Nome da Campanha.');
      return;
    }
    const budgetValue = parseFloat(adSetBudget.replace(',', '.'));
    if (!trimmedAdSetName || !(budgetValue > 0)) {
      toast.error('Preencha o Nome e o Orçamento Diário do Conjunto.');
      return;
    }
    const ageMinNum = parseInt(ageMin, 10);
    const ageMaxNum = parseInt(ageMax, 10);
    if (ageMinNum > ageMaxNum) {
      toast.error('Idade mínima não pode ser maior que a máxima.');
      return;
    }
    if (!country.trim()) {
      toast.error('Informe o país de segmentação.');
      return;
    }
    if (!trimmedAdName) {
      toast.error('Preencha o Nome do Anúncio.');
      return;
    }
    if (!mediaFile) {
      toast.error('Carregue uma imagem ou vídeo para o Anúncio.');
      return;
    }

    setSaving(true);
    try {
      const assetBase64 = await fileToBase64(mediaFile);
      const detailedTargetingManual = detailedTargeting
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const campanha: CreateCampaignPayload = {
        name: trimmedName,
        status,
        objective: objectiveMeta.objective,
        link: objectiveMeta.needsLink ? link.trim() || undefined : undefined,
        adsets: [
          {
            adset_name: trimmedAdSetName,
            adset_status: status,
            daily_budget: Math.round(budgetValue * 100).toString(),
            optimization_goal: objectiveMeta.optimizationGoal,
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            targeting: {
              age_min: ageMinNum,
              age_max: ageMaxNum,
              publisher_platforms: platforms.length > 0 ? platforms : ['facebook', 'instagram'],
              custom_audience_id: savedAudienceName.trim() || undefined,
              detailed_targeting_manual: detailedTargetingManual.length > 0 ? detailedTargetingManual : undefined,
              geo_locations: {
                location_types: ['home', 'recent'],
                countries: [country.trim().toUpperCase()],
              },
            },
            ads: [
              {
                ad_name: trimmedAdName,
                ad_status: status,
                title: adTitle.trim() || undefined,
                body: adBody.trim() || undefined,
                asset_base64: assetBase64,
                asset_mimetype: mediaFile.type || 'image/jpeg',
              },
            ],
          },
        ],
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
            <h4 className="text-lg font-bold text-sky-400 border-b border-slate-700 pb-2">1. Campanha</h4>
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

          <section className="space-y-4 p-4 border border-slate-700 rounded-lg">
            <h4 className="text-lg font-bold text-teal-400 border-b border-slate-700 pb-2">2. Conjunto de Anúncios</h4>
            <div>
              <Label className="text-xs text-slate-400">Nome do Conjunto</Label>
              <Input
                value={adSetName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdSetName(e.target.value)}
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
                value={adSetBudget}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdSetBudget(e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Público Salvo (nome, opcional)</Label>
              <Input
                value={savedAudienceName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSavedAudienceName(e.target.value)}
                placeholder="Em branco para usar segmentação detalhada"
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Direcionamento Detalhado (interesses, opcional)</Label>
              <Textarea
                value={detailedTargeting}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDetailedTargeting(e.target.value)}
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
            <div>
              <Label className="text-xs text-slate-400">País de segmentação (código, ex: BR)</Label>
              <Input
                value={country}
                maxLength={2}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value.toUpperCase())}
                className="bg-slate-700 border-slate-600 text-slate-200 w-24"
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
          </section>

          <section className="space-y-4 p-4 border border-slate-700 rounded-lg">
            <h4 className="text-lg font-bold text-yellow-400 border-b border-slate-700 pb-2">3. Anúncio e Criativo</h4>
            <div>
              <Label className="text-xs text-slate-400">Nome do Anúncio</Label>
              <Input
                value={adName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdName(e.target.value)}
                placeholder="Ex: Ad 01 - Criativo Oferta"
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Título (Headline)</Label>
              <Input
                value={adTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdTitle(e.target.value)}
                placeholder="Ex: Compre Agora e Ganhe Desconto!"
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Texto Principal</Label>
              <Textarea
                value={adBody}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAdBody(e.target.value)}
                rows={3}
                placeholder="Use gatilhos de escassez e urgência."
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400 block mb-1">Mídia (imagem ou vídeo)</Label>
              <label className="flex items-center gap-2 text-sm text-sky-300 cursor-pointer hover:text-sky-200">
                <ImagePlus className="w-4 h-4" />
                {mediaFile ? mediaFile.name : 'Selecionar arquivo'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </section>
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
        adAccountId={selectedAccount?.id || null}
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
