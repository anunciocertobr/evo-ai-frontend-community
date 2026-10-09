import api from '../core/api';
import { extractData } from '../../utils/apiHelpers';

export interface MetaLeadNotificationSetting {
  form_id: string;
  page_id: string | null;
  form_name: string | null;
  enabled: boolean;
  inbox_id: string | null;
  whatsapp_number: string | null;
}

export interface MetaLeadNotificationSettingPayload {
  page_id?: string;
  form_name?: string;
  enabled: boolean;
  inbox_id?: string | null;
  whatsapp_number?: string | null;
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
