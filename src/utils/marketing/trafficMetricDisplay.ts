// Definições de exibição das métricas do Painel Tráfego nativo — chaves,
// rótulos, formatação e quais ficam escondidas quando valem zero (mesmo
// comportamento do legado: Mensagens/CP-Msg/Leads/CP-Lead só aparecem no
// card quando há alguma atividade daquele tipo).
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
