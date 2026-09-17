// Definições de exibição das métricas do Painel Tráfego nativo — chaves,
// rótulos, cores, ícones e formatação. Cores/ícones replicam 1:1 o painel
// legado (getMetricColor/getMetricIcon em dashboards-src/painel_trafego.html)
// a pedido do usuário — o visual do original era exatamente o que ele queria
// manter, só a página por trás que virou nativa.
import {
  Wallet,
  Banknote,
  Eye,
  Target,
  RefreshCw,
  MousePointerClick,
  CircleDollarSign,
  Percent,
  MessageCircle,
  MailOpen,
  UserPlus,
  HandCoins,
  Link2,
  Ticket,
  type LucideIcon,
} from 'lucide-react';

// Mensagens/CP-Msg/Leads/CP-Lead só aparecem no card quando há atividade
// daquele tipo (mesmo comportamento do legado).
export type MetricKey =
  | 'balance'
  | 'spend'
  | 'impressions'
  | 'reach'
  | 'frequency'
  | 'clicks'
  | 'cpc'
  | 'ctr'
  | 'messaging'
  | 'cpMsg'
  | 'leads'
  | 'cpLead'
  | 'linkClicks'
  | 'cpm';

export const METRIC_ORDER: MetricKey[] = [
  'balance',
  'spend',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'cpc',
  'ctr',
  'messaging',
  'cpMsg',
  'leads',
  'cpLead',
  'linkClicks',
  'cpm',
];

export const METRIC_LABELS: Record<MetricKey, string> = {
  balance: 'Saldo',
  spend: 'Gasto',
  impressions: 'Impressões',
  reach: 'Alcance',
  frequency: 'Frequência',
  clicks: 'Cliques',
  cpc: 'CPC',
  ctr: 'CTR',
  messaging: 'Mensagens',
  cpMsg: 'CP/Msg',
  leads: 'Leads',
  cpLead: 'CP/Lead',
  linkClicks: 'Cliques em Link',
  cpm: 'CPM',
};

// Cor de texto por métrica — idêntico ao getMetricColor do legado.
export const METRIC_COLORS: Record<MetricKey, string> = {
  balance: 'text-green-400',
  spend: 'text-red-400',
  impressions: 'text-sky-400',
  reach: 'text-teal-400',
  frequency: 'text-indigo-400',
  clicks: 'text-yellow-400',
  cpc: 'text-orange-400',
  ctr: 'text-pink-400',
  messaging: 'text-blue-400',
  cpMsg: 'text-violet-400',
  leads: 'text-lime-400',
  cpLead: 'text-amber-400',
  linkClicks: 'text-indigo-400',
  cpm: 'text-purple-400',
};

// Ícone por métrica — equivalente lucide-react do FontAwesome usado no
// legado (getMetricIcon).
export const METRIC_ICONS: Record<MetricKey, LucideIcon> = {
  balance: Wallet,
  spend: Banknote,
  impressions: Eye,
  reach: Target,
  frequency: RefreshCw,
  clicks: MousePointerClick,
  cpc: CircleDollarSign,
  ctr: Percent,
  messaging: MessageCircle,
  cpMsg: MailOpen,
  leads: UserPlus,
  cpLead: HandCoins,
  linkClicks: Link2,
  cpm: Ticket,
};

const CURRENCY_METRICS: MetricKey[] = ['balance', 'spend', 'cpc', 'cpMsg', 'cpLead', 'cpm'];
const PERCENT_METRICS: MetricKey[] = ['ctr'];
const DECIMAL_METRICS: MetricKey[] = ['frequency'];

export const ZERO_HIDDEN_METRICS: MetricKey[] = ['messaging', 'cpMsg', 'leads', 'cpLead'];

export const DEFAULT_METRIC_VISIBILITY: Record<MetricKey, boolean> = {
  balance: true,
  spend: true,
  impressions: true,
  reach: true,
  frequency: true,
  clicks: true,
  cpc: false,
  ctr: false,
  messaging: true,
  cpMsg: true,
  leads: true,
  cpLead: true,
  linkClicks: false,
  cpm: false,
};

export function formatMetricValue(key: MetricKey, value: number): string {
  if (CURRENCY_METRICS.includes(key)) return `R$ ${value.toFixed(2).replace('.', ',')}`;
  if (PERCENT_METRICS.includes(key)) return `${(value * 100).toFixed(2).replace('.', ',')}%`;
  if (DECIMAL_METRICS.includes(key)) return value.toFixed(2);
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
