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

export interface AdCreative {
  name?: string;
  body?: string;
  title?: string;
  image_url?: string;
  video_id?: string;
  // A descrição do anúncio só existe dentro do spec do criativo — é de lá
  // que o "Duplicar" lê pra pré-preencher a tela de criação.
  object_story_spec?: {
    link_data?: { description?: string; name?: string; message?: string };
    video_data?: { title?: string; message?: string };
  };
}

export interface AdSetTargeting {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: {
    // A Graph API devolve a cidade real sem coordenada, e o pin do mapa com
    // coordenada em `custom_locations`. Os dois aparecem aqui porque o
    // "Duplicar" só consegue pré-preencher o mapa com o que tem lat/lng.
    cities?: Array<{ name?: string; radius?: number; distance_unit?: string; lat?: number; lng?: number }>;
    places?: Array<{ name?: string; radius?: number; distance_unit?: string; lat?: number; lng?: number }>;
    custom_locations?: Array<{ latitude?: number; longitude?: number; radius?: number; distance_unit?: string }>;
    countries?: string[];
  };
  publisher_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  // Posições de Audience Network e locais de exclusão — o "Duplicar" copia
  // para a tela de criação já preenchida.
  audience_network_positions?: string[];
  excluded_geo_locations?: Array<{ latitude?: number; longitude?: number; radius?: number; distance_unit?: string }>;
  // `optimization_goal` do conjunto é o que decide o destino aceito pela Meta
  // (conversa / conversão / formulário). Sem ele no tipo, o painel não
  // consegue mostrar o destino certo no modal de duplicação.
  optimization_goal?: string;
}

export interface PromotedObject {
  whatsapp_phone_number?: string;
  pixel_id?: string;
  custom_event_type?: string;
  page_id?: string;
}

export interface StructuralAd {
  id: string;
  name: string;
  status: string;
  adcreative?: AdCreative;
}

export interface StructuralAdSet {
  id: string;
  name: string;
  status: string;
  description?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: AdSetTargeting;
  promoted_object?: PromotedObject;
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
  description?: string;
  adsets?: { data: StructuralAdSet[] };
}

export type AggregationLevel = 'campaign' | 'adset' | 'ad';

export interface AggregatedItem {
  id: string;
  name: string;
  status: string;
  objective?: string;
  optimization_goal?: string;
  // Descrição do objeto (campo `description` da Graph API) — o modal de
  // duplicação copia para a nova peça e o painel mostra nos detalhes.
  description?: string;
  parentName?: string;
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  totalAdSets?: number;
  activeAdSetsCount?: number;
  totalAds?: number;
  activeAdsCount?: number;
  // Campos crus (não agregados) — usados pelo painel de detalhes (1 clique)
  // e pelos modais de editar, que precisam do estado atual do objeto na
  // Graph API, não da métrica somada.
  dailyBudget?: string;
  targeting?: AdSetTargeting;
  promotedObject?: PromotedObject;
  adCreative?: AdCreative;
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
        // `promoted_object` e `optimization_goal` vem do primeiro conjunto: a
        // campanha em si não devolve o destino da conversa, e sem isso o modal
        // de duplicação abriria sem página nenhuma e obrigaria a pessoa a
        // escolher de novo o que a campanha de origem já usava.
        const primeiroConjunto = (campaign.adsets?.data || [])[0];
        aggregatedMap.set(campaign.id, {
          base: {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            description: campaign.description,
            optimization_goal: primeiroConjunto?.optimization_goal,
            promotedObject: primeiroConjunto?.promoted_object,
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
              description: adset.description,
              campaignId: campaign.id,
              campaignName: campaign.name,
              parentName: campaign.name,
              optimization_goal: adset.optimization_goal,
              totalAds,
              activeAdsCount,
              dailyBudget: adset.daily_budget,
              targeting: adset.targeting,
              promotedObject: adset.promoted_object,
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
                adCreative: ad.adcreative,
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
