import api from '../core/api';
import { extractData } from '../../utils/apiHelpers';
import type { NotifyChannel } from './metaLeadNotificationSettingsService';
import type { MetaLeadFormPipelineTarget } from './metaLeadFormsService';

export interface MetaLeadPageSetting {
  page_id: string;
  channels: NotifyChannel[];
  dataset_ids: string[];
  pipelines: MetaLeadFormPipelineTarget[];
}

export interface MetaLeadPageSettingPayload {
  channels: NotifyChannel[];
  dataset_ids: string[];
  pipelines: Array<{ pipeline_id: string; pipeline_stage_id: string }>;
}

export const metaLeadPageSettingsService = {
  // Nunca 404 — página sem padrão configurado ainda devolve tudo vazio.
  async get(pageId: string): Promise<MetaLeadPageSetting> {
    const response = await api.get(`/admin/meta_lead_page_settings/${pageId}`);
    return extractData<MetaLeadPageSetting>(response);
  },

  async upsert(pageId: string, payload: MetaLeadPageSettingPayload): Promise<MetaLeadPageSetting> {
    const response = await api.put(`/admin/meta_lead_page_settings/${pageId}`, payload);
    return extractData<MetaLeadPageSetting>(response);
  },
};
