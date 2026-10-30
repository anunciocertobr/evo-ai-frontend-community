import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

// Espelha Api::V1::Reports::AdLeadsController#serialize — a base INTERNA
// de atribuição de lead de WhatsApp (capturada pelo próprio webhook oficial
// da Meta, ver Whatsapp::AdReferralCapture), diferente da Helena/WTS
// (sistema externo, ver rastreamentosService.ts). Nomes de campo em
// português/mistos porque o endpoint também serve um relatório HTML legado
// com esses nomes fixos — não mudar sem checar esse relatório também.
export interface AdLead {
  id: string;
  telefone: string | null;
  nome: string | null;
  email: string | null;
  data_criacao: string;
  plataforma: string;
  canal: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  Anuncio_title: string | null;
  Anuncio_body: string | null;
  Anuncio_thumbnail_url: string | null;
  ctwaclid: string | null;
  gclid: string | null;
  ttclid: string | null;
  igclid: string | null;
  mesengerclid: string | null;
  msclkid: string | null;
  fbp: string | null;
  fbc: string | null;
  externalid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  utm_id: string | null;
  status: string;
  valor_venda: string | null;
  enriched: boolean;
}

export const adLeadsService = {
  async list(): Promise<AdLead[]> {
    const response = await api.get('/reports/ad_leads', { params: { channel: 'whatsapp' } });
    return extractData<AdLead[]>(response);
  },
};
