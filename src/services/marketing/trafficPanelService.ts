import api from '@/services/core/api';
import type { RawInsightRow, StructuralCampaign } from '@/utils/marketing/trafficMetrics';

const ENDPOINT = '/reports/meta_ads_manager';

export interface TrafficAccount {
  id: string;
  name: string;
  balance?: string;
  spend_cap?: string;
  is_prepay_account?: boolean;
  amount_spent?: string;
  currency?: string;
  insights: RawInsightRow[];
  insights_30d: RawInsightRow[];
}

export interface CampaignsTreeResult {
  structural: StructuralCampaign[];
  insights: RawInsightRow[];
}

class TrafficPanelService {
  async listAccounts(businessId: string, dateStart?: string, dateStop?: string): Promise<TrafficAccount[]> {
    const response = await api.post<Array<{ lista_final_contas_de_anuncios: TrafficAccount[] }>>(ENDPOINT, {
      acao: 'lista_de_contas',
      id_bm: businessId,
      date_start: dateStart,
      date_stop: dateStop,
    });
    return response.data?.[0]?.lista_final_contas_de_anuncios || [];
  }

  async getCampaignsTree(adAccountId: string, dateStart: string, dateStop: string): Promise<CampaignsTreeResult> {
    const response = await api.post<Array<{ 'dados campanhas': { data: StructuralCampaign[] }; insights: { data: RawInsightRow[] } }>>(
      ENDPOINT,
      {
        acao: 'campanhas',
        id_conta_anuncio: adAccountId,
        date_start: dateStart,
        date_stop: dateStop,
      },
    );
    const payload = response.data?.[0];
    return {
      structural: payload?.['dados campanhas']?.data || [],
      insights: payload?.insights?.data || [],
    };
  }
}

export const trafficPanelService = new TrafficPanelService();
