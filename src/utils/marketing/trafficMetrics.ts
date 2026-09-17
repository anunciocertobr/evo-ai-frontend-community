// Portado do Painel Tráfego legado (dashboards-src/painel_trafego.html no
// backend crm_certo) na migração pra nativo — mesma lógica de agregação e
// de "gating" de leads/mensagens por optimization_goal do conjunto de
// anúncios, já com as correções aplicadas em produção em 2026-09-17:
// - Ordenação sempre agrupa ativos antes de pausados, em qualquer critério.
// - "Mensagens" prioriza 'messaging_conversation_started_7d' (Conversas
//   iniciadas, o que o Gerenciador de Anúncios mostra como Resultado) sobre
//   'total_messaging_connection' (métrica bem mais ampla).
// - "Leads" e "Mensagens" são mutuamente exclusivos por conjunto: um
//   conjunto otimizado pra Conversas só conta pra mensagens, um otimizado
//   pra Formulário/Cadastro só conta pra leads — evita "leads fantasma"
//   quando a Meta reporta o mesmo evento de conversa também como
//   action_type de lead.

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface RawInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions?: string;
  reach?: string;
  spend?: string;
  clicks?: string;
  actions?: MetaAction[];
}

export interface StructuralAd {
  id: string;
  name: string;
  status: string;
}

export interface StructuralAdSet {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  optimization_goal?: string;
  bid_strategy?: string;
  start_time?: string;
  end_time?: string;
  ads?: { data: StructuralAd[] };
}

export interface StructuralCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  adsets?: { data: StructuralAdSet[] };
}

export type AggregationLevel = 'campaign' | 'adset' | 'ad';

export interface AggregatedItem {
  id: string;
  name: string;
  status: string;
  objective?: string;
  optimization_goal?: string;
  parentName?: string;
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  totalAdSets?: number;
  activeAdSetsCount?: number;
  totalAds?: number;
  activeAdsCount?: number;
  impressions: number;
  reach: number;
  spend: number;
  clicks: number;
  cpc: number;
  ctr: number;
  frequency: number;
  cpm: number;
  linkClicks: number;
  messaging: number;
  cpMsg: number;
  leads: number;
  cpLead: number;
}

export const LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'onsite_conversion.lead',
  'onsite_web_lead',
  'offsite_complete_registration_add_meta_leads',
];

export const MESSAGING_ACTION_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.total_messaging_connection',
];

export const LEAD_OPTIMIZATION_GOALS = ['LEAD_GENERATION', 'QUALITY_LEAD'];
export const MESSAGING_OPTIMIZATION_GOALS = ['CONVERSATIONS'];

export function extractActionValue(actions: MetaAction[], types: string[]): number {
  for (const type of types) {
    const found = actions.find((a) => a.action_type === type);
    if (found) return parseFloat(found.value || '0');
  }
  return 0;
}

function findActionValue(actions: MetaAction[] | undefined, type: string): number {
  const found = (actions || []).find((a) => a.action_type === type);
  return found ? parseFloat(found.value || '0') : 0;
}

export function aggregateDataForLevel(
  structural: StructuralCampaign[],
  insights: RawInsightRow[],
  level: AggregationLevel,
  filterId?: string,
): AggregatedItem[] {
  interface RawBucket {
    impressions: number;
    reach: number;
    spend: number;
    clicks: number;
    actions: Record<string, number>;
    messagingGoalActions: Record<string, number>;
    leadGoalActions: Record<string, number>;
  }

  const emptyBucket = (): RawBucket => ({
    impressions: 0,
    reach: 0,
    spend: 0,
    clicks: 0,
    actions: {},
    messagingGoalActions: {},
    leadGoalActions: {},
  });

  const aggregatedMap = new Map<string, { base: Partial<AggregatedItem>; raw: RawBucket }>();
  const adSetGoalById = new Map<string, string | undefined>();

  structural.forEach((campaign) => {
    (campaign.adsets?.data || []).forEach((adset) => {
      adSetGoalById.set(adset.id, adset.optimization_goal);
    });
  });

  structural.forEach((campaign) => {
    const totalAdSets = campaign.adsets?.data?.length || 0;
    const activeAdSetsCount = (campaign.adsets?.data || []).filter((a) => a.status === 'ACTIVE').length;

    if (level === 'campaign') {
      if (!aggregatedMap.has(campaign.id)) {
        aggregatedMap.set(campaign.id, {
          base: {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            totalAdSets,
            activeAdSetsCount,
          },
          raw: emptyBucket(),
        });
      }
    }

    (campaign.adsets?.data || []).forEach((adset) => {
      const totalAds = adset.ads?.data?.length || 0;
      const activeAdsCount = (adset.ads?.data || []).filter((a) => a.status === 'ACTIVE').length;

      if (level === 'adset' && (!filterId || filterId === campaign.id)) {
        if (!aggregatedMap.has(adset.id)) {
          aggregatedMap.set(adset.id, {
            base: {
              id: adset.id,
              name: adset.name,
              status: adset.status,
              campaignId: campaign.id,
              campaignName: campaign.name,
              parentName: campaign.name,
              optimization_goal: adset.optimization_goal,
              totalAds,
              activeAdsCount,
            },
            raw: emptyBucket(),
          });
        }
      }

      (adset.ads?.data || []).forEach((ad) => {
        if (level === 'ad' && (!filterId || filterId === adset.id)) {
          if (!aggregatedMap.has(ad.id)) {
            aggregatedMap.set(ad.id, {
              base: {
                id: ad.id,
                name: ad.name,
                status: ad.status,
                parentName: adset.name,
                adSetId: adset.id,
                campaignId: campaign.id,
              },
              raw: emptyBucket(),
            });
          }
        }
      });
    });
  });

  insights.forEach((insight) => {
    let targetKey: string | undefined;
    if (level === 'campaign' && insight.campaign_id && aggregatedMap.has(insight.campaign_id)) targetKey = insight.campaign_id;
    else if (level === 'adset' && insight.adset_id && aggregatedMap.has(insight.adset_id)) targetKey = insight.adset_id;
    else if (level === 'ad' && insight.ad_id && aggregatedMap.has(insight.ad_id)) targetKey = insight.ad_id;
    if (!targetKey) return;

    const entry = aggregatedMap.get(targetKey)!;
    const raw = entry.raw;
    raw.impressions += parseFloat(insight.impressions || '0');
    raw.reach += parseFloat(insight.reach || '0');
    raw.spend += parseFloat(insight.spend || '0');
    raw.clicks += parseFloat(insight.clicks || '0');
    (insight.actions || []).forEach((action) => {
      raw.actions[action.action_type] = (raw.actions[action.action_type] || 0) + parseFloat(action.value || '0');
    });

    const goal = insight.adset_id ? adSetGoalById.get(insight.adset_id) : undefined;
    const isMessagingGoal = !!goal && MESSAGING_OPTIMIZATION_GOALS.includes(goal);
    const isLeadGoal = !!goal && LEAD_OPTIMIZATION_GOALS.includes(goal);
    const accumulate = (bucket: Record<string, number>) => {
      (insight.actions || []).forEach((action) => {
        bucket[action.action_type] = (bucket[action.action_type] || 0) + parseFloat(action.value || '0');
      });
    };
    if (isMessagingGoal) accumulate(raw.messagingGoalActions);
    else if (isLeadGoal) accumulate(raw.leadGoalActions);
    else {
      accumulate(raw.messagingGoalActions);
      accumulate(raw.leadGoalActions);
    }
  });

  return Array.from(aggregatedMap.values()).map(({ base, raw }) => {
    const actionsArr: MetaAction[] = Object.entries(raw.actions).map(([type, value]) => ({ action_type: type, value: value.toString() }));
    const messagingArr: MetaAction[] = Object.entries(raw.messagingGoalActions).map(([type, value]) => ({ action_type: type, value: value.toString() }));
    const leadArr: MetaAction[] = Object.entries(raw.leadGoalActions).map(([type, value]) => ({ action_type: type, value: value.toString() }));

    const messaging = extractActionValue(messagingArr, MESSAGING_ACTION_TYPES);
    const leads = extractActionValue(leadArr, LEAD_ACTION_TYPES);
    const linkClicks = findActionValue(actionsArr, 'link_click');
    const cpc = raw.clicks > 0 ? raw.spend / raw.clicks : 0;
    const ctr = raw.impressions > 0 ? raw.clicks / raw.impressions : 0;
    const frequency = raw.reach > 0 ? raw.impressions / raw.reach : 0;
    const cpm = raw.impressions > 0 ? (raw.spend / raw.impressions) * 1000 : 0;
    const cpMsg = messaging > 0 ? raw.spend / messaging : 0;
    const cpLead = leads > 0 ? raw.spend / leads : 0;

    return {
      ...base,
      impressions: raw.impressions,
      reach: raw.reach,
      spend: raw.spend,
      clicks: raw.clicks,
      cpc,
      ctr,
      frequency,
      cpm,
      linkClicks,
      messaging,
      cpMsg,
      leads,
      cpLead,
    } as AggregatedItem;
  });
}

export type SortKey = 'name' | 'spend' | 'cpc' | 'ctr' | 'messaging';
export type SortDirection = 'asc' | 'desc';

// Ativos sempre antes de pausados/outros, em QUALQUER critério — era o bug
// original: ordenar por Nome saía puramente alfabético, misturando ativas e
// pausadas.
export function sortAggregatedItems(items: AggregatedItem[], sortKey: SortKey, direction: SortDirection): AggregatedItem[] {
  const order = direction === 'desc' ? -1 : 1;
  const statusRank = (item: AggregatedItem) => (item.status === 'ACTIVE' ? 0 : 1);

  return [...items].sort((a, b) => {
    const statusDiff = statusRank(a) - statusRank(b);
    if (statusDiff !== 0) return statusDiff;

    if (sortKey === 'name') return order * a.name.localeCompare(b.name);

    const valA = a[sortKey === 'spend' ? 'spend' : sortKey];
    const valB = b[sortKey === 'spend' ? 'spend' : sortKey];
    if (valA !== valB) return (valA < valB ? -1 : 1) * order;
    return a.name.localeCompare(b.name);
  });
}
