import api from '../core/api';
import { extractData } from '../../utils/apiHelpers';

// Um canal é destino número (whatsapp_number) OU grupo (group_jid) — nunca
// os dois. group_name é só pra exibir no editor sem precisar buscar de novo.
// content_sections é o que vai na mensagem DESSE canal — cada canal pode
// mandar um resumo diferente do mesmo lead; null/ausente = todas as seções
// (mesmo padrão de sempre quando nunca configurado).
export interface NotifyChannel {
  inbox_id: string;
  whatsapp_number?: string;
  group_jid?: string;
  group_name?: string;
  content_sections?: string[] | null;
}

export interface MetaLeadNotificationSetting {
  form_id: string;
  page_id: string | null;
  form_name: string | null;
  enabled: boolean;
  inbox_id: string | null;
  whatsapp_number: string | null;
  // Já vem resolvido com o fallback do canal legado (inbox_id/whatsapp_number
  // acima) quando a lista nunca foi salva no formato novo — ver
  // MetaLeadNotificationSetting#effective_channels no backend. Cada item traz
  // seu próprio content_sections (ver NotifyChannel) — não existe mais uma
  // escolha única pra todos os canais do mesmo formulário.
  channels: NotifyChannel[];
}

export interface MetaLeadNotificationSettingPayload {
  page_id?: string;
  form_name?: string;
  enabled: boolean;
  channels: NotifyChannel[];
}

export const metaLeadNotificationSettingsService = {
  async list(formIds?: string[]): Promise<MetaLeadNotificationSetting[]> {
    const response = await api.get('/admin/meta_lead_notification_settings', {
      params: formIds?.length ? { form_ids: formIds } : undefined,
    });
    return extractData<MetaLeadNotificationSetting[]>(response);
  },

  async upsert(formId: string, payload: MetaLeadNotificationSettingPayload): Promise<MetaLeadNotificationSetting> {
    const response = await api.put(`/admin/meta_lead_notification_settings/${formId}`, payload);
    return extractData<MetaLeadNotificationSetting>(response);
  },

  async remove(formId: string): Promise<void> {
    await api.delete(`/admin/meta_lead_notification_settings/${formId}`);
  },
};
