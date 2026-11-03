import api from '@/services/core/api';
import { LeadTargetingContext } from '@/services/marketing/metaCreationService';

export interface HelenaAdCreative {
  imagem?: string | null;
  video?: string | null;
  thumbnail_url?: string | null;
  titulo?: string | null;
  texto_principal?: string | null;
  criativo_nome?: string | null;
}

export interface HelenaAdContext {
  ad_id: string;
  ad_name?: string | null;
  adset_id?: string | null;
  adset_name?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  criativo?: HelenaAdCreative;
  publico_alvo?: LeadTargetingContext;
}

export interface SendConversionResult {
  success: boolean;
  error?: string;
}

export interface HelenaAccount {
  id: string;
  label: string;
}

export const rastreamentosService = {
  // Contas Helena conectadas (Configurações > Integrações > Helena) —
  // pro seletor da aba Externo, quando há mais de uma.
  async accounts(): Promise<HelenaAccount[]> {
    const res = await api.get('/reports/helena_wts/accounts');
    return res.data?.items ?? [];
  },

  async allContacts(limit = 100, hookId?: string) {
    const res = await api.get('/reports/helena_wts/all_contacts', { params: { limit, hook_id: hookId || undefined } });
    return res.data?.items ?? [];
  },

  // Best-effort — anúncio apagado/sem permissão não deve travar a tabela
  // inteira, só aquela linha fica sem o enriquecimento.
  async adContext(adId: string): Promise<HelenaAdContext | null> {
    try {
      const res = await api.get('/reports/helena_wts/ad_context', { params: { ad_id: adId } });
      return res.data?.success ? res.data.data : null;
    } catch {
      return null;
    }
  },

  async sendConversion(payload: {
    ad_id: string;
    ctwa_clid?: string;
    phone?: string;
    event_name: string;
  }): Promise<SendConversionResult> {
    const res = await api.post('/reports/helena_wts/send_conversion', payload);
    return res.data as SendConversionResult;
  },
};
