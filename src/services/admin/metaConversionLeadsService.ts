import api from '../core/api';
import { extractData } from '../../utils/apiHelpers';

export interface SendToMetaCrmPayload {
  leadgen_id: string;
  dataset_ids: string[];
  event_name: string;
  email?: string;
  phone?: string;
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
