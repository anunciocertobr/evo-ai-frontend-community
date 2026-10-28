import api from '../core/api';
import { extractData } from '../../utils/apiHelpers';

// Schema completo da Conversions API da Meta (Payload Helper oficial) —
// campos de "Dados do Cliente". A hashagem (em/ph/fn/ln/ge/db/ct/st/zp/
// country/external_id) é feita no backend, aqui vai sempre texto puro.
export interface MetaCrmUserData {
  em?: string; // e-mail
  ph?: string; // telefone
  fn?: string; // nome
  ln?: string; // sobrenome
  ge?: string; // gênero (m/f)
  db?: string; // data de nascimento (AAAAMMDD)
  ct?: string; // cidade
  st?: string; // estado
  zp?: string; // CEP
  country?: string;
  external_id?: string; // ID do cliente no seu sistema
  lead_id?: string; // preenchido automaticamente com o leadgen_id
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string; // Facebook click ID (cookie _fbc)
  fbp?: string; // Facebook browser ID (cookie _fbp)
}

// "Dados do Produto/Pedido" — nunca hasheado.
export interface MetaCrmCustomData {
  currency?: string;
  value?: string;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  order_id?: string;
  num_items?: string;
  search_string?: string;
  status?: string;
  delivery_category?: string;
  predicted_ltv?: string;
}

export interface SendToMetaCrmPayload {
  leadgen_id: string;
  dataset_ids: string[];
  event_name: string;
  action_source: string;
  user_data: MetaCrmUserData;
  custom_data: MetaCrmCustomData;
}

export interface SendToMetaCrmResult {
  dataset_id: string;
  success: boolean;
  error: string | null;
  meta_response: unknown;
}

export const metaConversionLeadsService = {
  // Envio manual, único — nunca grava nada no banco, cada chamada é
  // independente (ver Meta::ConversionsApiCrmService#send_manual_event).
  async sendToMetaCrm(payload: SendToMetaCrmPayload): Promise<SendToMetaCrmResult[]> {
    const response = await api.post('/admin/meta_lead_submissions/send_to_meta_crm', payload);
    return extractData<SendToMetaCrmResult[]>(response);
  },
};
